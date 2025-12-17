"""
data/market_data_source.py
Responsible for fetching raw price history for a ticker.
"""

import time
import requests

from config import STOCK_API_KEY, DEFAULT_LOOKBACK_DAYS

# ✅ Step 6: in-memory cache to avoid hammering data provider
# { "AAPL": (timestamp_epoch_seconds, price_history_list) }
_PRICE_CACHE = {}

# TTL = 120s (from config.py if present, otherwise default to 120 per MVP plan)
try:
    from config import MARKET_DATA_TTL_SECONDS  # optional if you add it later
    _CACHE_TTL_SECONDS = int(MARKET_DATA_TTL_SECONDS)
except Exception:
    _CACHE_TTL_SECONDS = 120


def fetch_price_history(ticker):
    """
    Fetch recent price history for the given ticker.

    Returns:
        A list of dicts ordered from oldest → newest.
        Example: [{"close": 172.30, "volume": 1234567}, ...]
    Raises:
        ValueError if no usable market data is found.
    """
    t = (ticker or "").strip().upper()

    # ✅ Step 6: serve cached if fresh
    now = time.time()
    cached = _PRICE_CACHE.get(t)
    if cached:
        cached_ts, cached_prices = cached
        if (now - cached_ts) < _CACHE_TTL_SECONDS:
            return cached_prices

    url = (
        "https://www.alphavantage.co/query"
        f"?function=TIME_SERIES_DAILY"
        f"&symbol={t}"
        f"&apikey={STOCK_API_KEY}"
    )

    try:
        response = requests.get(url, timeout=5)
        data = response.json()

        time_series = data.get("Time Series (Daily)", {}) or {}

        # ✅ Phase 1: NO DATA = ERROR (prevents fake Sideways 50)
        if not time_series:
            raise ValueError("Ticker not found or insufficient price history.")

        price_history = []
        for date, values in sorted(time_series.items()):
            price_history.append(
                {
                    "close": float(values["4. close"]),
                    "volume": float(values.get("5. volume", 0)),
                }
            )

        price_history = price_history[-DEFAULT_LOOKBACK_DAYS:]

        # ✅ Phase 1: Enforce minimum lookback
        if len(price_history) < DEFAULT_LOOKBACK_DAYS:
            raise ValueError("Ticker not found or insufficient price history.")

        # ✅ Step 6: store in cache
        _PRICE_CACHE[t] = (now, price_history)

        return price_history

    except ValueError:
        # Propagate known validation errors upward
        raise

    except Exception:
        # ❌ Phase 1: REMOVE dummy fallback — treat as failure
        raise ValueError("Ticker not found or insufficient price history.")

