# services/alerts_service.py

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List

from services.analysis_service import analyze_ticker
from services.alert_store import (
    get_rules,
    get_state,
    upsert_state,
    update_last_sent,
)

# Hard cooldown: 6 hours
COOLDOWN_SECONDS = 6 * 60 * 60

# Trend score buckets (stable + coarse)
def _trend_bucket(score: Any) -> str:
    try:
        s = float(score)
    except Exception:
        return "unknown"

    if s >= 70:
        return "strong"
    if s >= 50:
        return "moderate"
    return "weak"


DECAY_ORDER = {"None": 0, "Mild": 1, "Elevated": 2}


def run_alerts_once() -> List[Dict[str, Any]]:
    """
    Runs alert evaluation once.
    Returns a list of triggered alerts (delivery handled elsewhere).
    """
    triggered: List[Dict[str, Any]] = []
    now = datetime.utcnow()

    rules = get_rules(enabled_only=True)

    # Group rules by (email, ticker)
    grouped = defaultdict(list)
    for r in rules:
        grouped[(r["email"], r["ticker"])].append(r)

    for (email, ticker), _rules in grouped.items():
        analysis = analyze_ticker(ticker)
        signals = analysis.get("signals") or {}

        regime = signals.get("regime")
        trend_score = signals.get("trend_score")
        delta_1d = signals.get("delta_1d")
        decay = signals.get("momentum_decay")

        bucket = _trend_bucket(trend_score)

        state = get_state(email, ticker)

        # First-time initialization: store state, do NOT alert
        if not state:
            upsert_state(
                email=email,
                ticker=ticker,
                last_regime=regime,
                last_trend_bucket=bucket,
                last_decay=decay,
            )
            continue

        # Cooldown enforcement
        last_sent = state.get("last_sent_at")
        if last_sent:
            try:
                last_dt = datetime.fromisoformat(last_sent.replace("Z", ""))
                if (now - last_dt).total_seconds() < COOLDOWN_SECONDS:
                    continue
            except Exception:
                pass

        reasons = []

        # 1) Regime flip
        if regime and regime != state.get("last_regime"):
            reasons.append(f"Regime changed to {regime}")

        # 2) Trend bucket change
        if bucket != state.get("last_trend_bucket"):
            reasons.append(f"Trend strength changed to {bucket}")

        # 3) Decay worsened only
        prev_decay = state.get("last_decay")
        if decay and prev_decay:
            if DECAY_ORDER.get(decay, 0) > DECAY_ORDER.get(prev_decay, 0):
                reasons.append(f"Momentum decay worsened to {decay}")

        if reasons:
            triggered.append(
                {
                    "email": email,
                    "ticker": ticker,
                    "signals": signals,
                    "reasons": reasons,
                }
            )

            update_last_sent(
                email=email,
                ticker=ticker,
                last_sent_at=now.isoformat() + "Z",
            )

        # Always update stored state
        upsert_state(
            email=email,
            ticker=ticker,
            last_regime=regime,
            last_trend_bucket=bucket,
            last_decay=decay,
        )

    return triggered
