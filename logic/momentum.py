"""
logic/momentum.py (v2 rewrite)
Health Score = weighted subscores:
- Trend Structure
- Momentum
- Risk / Volatility
- Participation (volume-confirmation; optional if volume data available)
"""

import math

HEALTH_WINDOW_DAYS = 200
METRIC_NAME = "Health Score"
WINDOW_LABEL = "Last 200 trading days"


# ----------------------------
# Helpers
# ----------------------------
def _clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def _mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


def _stdev(xs):
    if not xs or len(xs) < 2:
        return 0.0
    m = _mean(xs)
    var = sum((x - m) ** 2 for x in xs) / (len(xs) - 1)
    return math.sqrt(max(0.0, var))


def _ema(values, period):
    if not values or period <= 1:
        return values[-1] if values else 0.0
    k = 2.0 / (period + 1.0)
    e = values[0]
    for v in values[1:]:
        e = (v * k) + (e * (1.0 - k))
    return e


def _sma(values, period):
    if not values:
        return 0.0
    if len(values) < period:
        return _mean(values)
    return _mean(values[-period:])


def _pct_change(a, b):
    if a is None or a == 0:
        return 0.0
    return (b - a) / a


def _max_drawdown(prices):
    if not prices:
        return 0.0
    peak = prices[0]
    mdd = 0.0
    for p in prices:
        if p > peak:
            peak = p
        dd = (peak - p) / peak if peak > 0 else 0.0
        if dd > mdd:
            mdd = dd
    return mdd


def _rsi(prices, period=14):
    if not prices or len(prices) < period + 1:
        return 50.0
    gains = []
    losses = []
    for i in range(1, len(prices)):
        diff = prices[i] - prices[i - 1]
        gains.append(max(0.0, diff))
        losses.append(max(0.0, -diff))

    avg_gain = _mean(gains[:period])
    avg_loss = _mean(losses[:period])

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def _normalize_linear(x, x0, x1):
    if x0 == x1:
        return 0.5
    return _clamp((x - x0) / (x1 - x0))


def _extract_series(price_history):
    prices = []
    vols = []
    has_vol = True

    for item in (price_history or []):
        if isinstance(item, (int, float)) and item > 0:
            prices.append(float(item))
            has_vol = False
        elif isinstance(item, dict):
            c = item.get("close", item.get("price"))
            v = item.get("volume")
            if isinstance(c, (int, float)) and c > 0:
                prices.append(float(c))
                if isinstance(v, (int, float)) and v >= 0:
                    vols.append(float(v))
                else:
                    has_vol = False
            else:
                has_vol = False
        else:
            has_vol = False

    if len(prices) < 10:
        return [], None
    if not has_vol or len(vols) != len(prices):
        return prices, None
    return prices, vols


# ----------------------------
# Subscores
# ----------------------------
def _structure_subscore(prices):
    p = prices[-1]
    ma50 = _sma(prices, 50)
    ma200 = _sma(prices, 200)

    above50 = 1.0 if p >= ma50 else 0.0
    above200 = 1.0 if p >= ma200 else 0.0
    ma_stack = 1.0 if ma50 >= ma200 else 0.0

    look = min(60, len(prices))
    window = prices[-look:]
    lo = min(window)
    hi = max(window)
    range_pos = 0.5 if hi == lo else (p - lo) / (hi - lo)
    range_pos = _clamp(range_pos)

    score = (
        0.30 * above50 +
        0.35 * above200 +
        0.20 * ma_stack +
        0.15 * range_pos
    )
    return _clamp(score)


def _momentum_subscore(prices):
    rsi = _rsi(prices, 14)
    rsi_score = 1.0 - _normalize_linear(abs(rsi - 60.0), 0.0, 30.0)

    if len(prices) >= 21:
        roc20 = _pct_change(prices[-21], prices[-1])
    else:
        roc20 = _pct_change(prices[0], prices[-1])
    roc_score = _normalize_linear(roc20, -0.10, 0.10)

    ema12 = _ema(prices[-60:], 12)
    ema26 = _ema(prices[-60:], 26)
    macd_like = _pct_change(ema26, ema12)
    macd_score = _normalize_linear(macd_like, -0.03, 0.03)

    score = (
        0.40 * rsi_score +
        0.40 * roc_score +
        0.20 * macd_score
    )
    return _clamp(score)


def _risk_subscore(prices):
    rets = []
    for i in range(1, len(prices)):
        rets.append(math.log(prices[i] / prices[i - 1]))

    vol = _stdev(rets)
    mdd = _max_drawdown(prices[-120:])

    vol_score = 1.0 - _normalize_linear(vol, 0.008, 0.030)
    dd_score = 1.0 - _normalize_linear(mdd, 0.05, 0.35)

    score = 0.55 * vol_score + 0.45 * dd_score
    return _clamp(score), vol, mdd


def _participation_subscore(prices, volumes):
    if not volumes:
        return 0.5

    n = min(20, len(prices) - 1)
    if n <= 5:
        return 0.5

    up_vol = 0.0
    down_vol = 0.0
    for i in range(-n, 0):
        if prices[i] >= prices[i - 1]:
            up_vol += volumes[i]
        else:
            down_vol += volumes[i]

    total = up_vol + down_vol
    up_ratio = (up_vol / total) if total > 0 else 0.5

    v_now = volumes[-1]
    v_avg = _mean(volumes[-(n + 1):])
    v_rel = (v_now / v_avg) if v_avg > 0 else 1.0
    v_score = _normalize_linear(v_rel, 0.7, 1.5)

    score = 0.70 * up_ratio + 0.30 * v_score
    return _clamp(score)


# ----------------------------
# Core compute
# ----------------------------
def _compute_components(price_history):
    prices, volumes = _extract_series(price_history)
    if not prices or len(prices) < 10:
        return {
            "label": "Sideways",
            "score": 50,
            "prices": [],
            "subscores": {"structure": 0.5, "momentum": 0.5, "risk": 0.5, "participation": 0.5},
            "vol": 0.0,
            "max_drawdown": 0.0,
            "has_volume": False,
        }

    if len(prices) > HEALTH_WINDOW_DAYS:
        prices = prices[-HEALTH_WINDOW_DAYS:]
        if volumes:
            volumes = volumes[-HEALTH_WINDOW_DAYS:]

    s_structure = _structure_subscore(prices)
    s_momentum = _momentum_subscore(prices)
    s_risk, vol, mdd = _risk_subscore(prices)
    s_part = _participation_subscore(prices, volumes) if volumes else 0.5

    blended = (
        0.35 * s_structure +
        0.25 * s_momentum +
        0.20 * s_risk +
        0.20 * s_part
    )
    blended = _clamp(blended)

    curved = 1.0 / (1.0 + math.exp(-6.0 * (blended - 0.5)))
    score = int(round(100 * curved))

    max_score = int(round(30 + 70 * s_risk))
    score = min(score, max_score)

    if score >= 60 and s_structure >= 0.55:
        label = "Uptrend"
    elif score <= 40 and s_structure <= 0.45:
        label = "Downtrend"
    else:
        label = "Sideways"

    return {
        "label": label,
        "score": score,
        "subscores": {
            "structure": round(s_structure, 3),
            "momentum": round(s_momentum, 3),
            "risk": round(s_risk, 3),
            "participation": round(s_part, 3),
        },
        "vol": round(vol, 4),
        "max_drawdown": round(mdd, 4),
        "has_volume": bool(volumes),
    }


# ----------------------------
# Public API
# ----------------------------
def calculate_momentum_with_delta(price_history):
    comps_now = _compute_components(price_history)

    comps_close = None
    if price_history and len(price_history) >= 11:
        comps_close = _compute_components(price_history[:-1])

    delta = None
    if comps_close:
        delta = comps_now["score"] - comps_close["score"]

    # ✅ Trend Pressure (formerly momentum_decay)
    # Goal: product-grade sensitivity without noise.
    # We compute the change in momentum over LOOKBACK_DAYS, then normalize that change
    # by the recent variability of that change (a simple z-score). This makes the
    # thresholds work consistently across low- and high-volatility tickers.
    momentum_decay = "Stable"
    LOOKBACK_DAYS = 7
    PRESSURE_VOL_WINDOW = 14  # how many recent deltas to estimate variability

    prices, _vols = _extract_series(price_history)
    if prices and len(prices) >= (LOOKBACK_DAYS + PRESSURE_VOL_WINDOW + 20):
        # Use the same momentum definition as the rest of the system.
        momentum_now = _momentum_subscore(prices)
        momentum_past = _momentum_subscore(prices[:-LOOKBACK_DAYS])
        raw_delta = momentum_now - momentum_past

        # Estimate how "big" a delta is for this ticker (recent distribution).
        recent_deltas = []
        for i in range(1, PRESSURE_VOL_WINDOW + 1):
            p_now = prices[:-i]
            p_past = prices[:-(i + LOOKBACK_DAYS)]
            if len(p_past) < 30:
                break
            recent_deltas.append(_momentum_subscore(p_now) - _momentum_subscore(p_past))

        mom_vol = _stdev(recent_deltas) if len(recent_deltas) >= 5 else 0.01
        if mom_vol <= 0:
            mom_vol = 0.01

        z = raw_delta / mom_vol

        # Regime-aware sensitivity: chop and late-stage trends should show pressure sooner.
        if comps_now.get("label") == "Sideways":
            z *= 1.25
        elif comps_now.get("label") == "Uptrend" and comps_now.get("score", 0) > 70:
            z *= 1.15

        # Thresholds tuned for user-facing behavior:
        # - Easing: meaningful cooling (often visible, not spam)
        # - Elevated: stronger deterioration (rare, attention-worthy)
        if z <= -1.25:
            momentum_decay = "Elevated"
        elif z <= -0.60:
            momentum_decay = "Easing"
        else:
            momentum_decay = "Stable"

    return {
        "label": comps_now["label"],
        "score": comps_now["score"],
        "delta_since_close": delta,
        "momentum_decay": momentum_decay,
        "components": {
            "subscores": comps_now["subscores"],
            "vol": comps_now["vol"],
            "max_drawdown": comps_now["max_drawdown"],
        },
    }



