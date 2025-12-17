# services/watchlist_service.py

"""
Persistent watchlist service for FriendlyTicker (MVP).

Stores watchlists in a JSON file on disk.
Can later be swapped for a database with no API changes.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from services.analysis_service import analyze_ticker

try:
    from billing.feature_flags import is_premium
except ImportError:
    def is_premium(user_id: str) -> bool:  # type: ignore
        return False


# --------------------------------------------------
# Storage
# --------------------------------------------------

WATCHLIST_FILE = Path("data/watchlists.json")


def _load_all() -> Dict[str, List[str]]:
    if not WATCHLIST_FILE.exists():
        return {}
    try:
        with open(WATCHLIST_FILE, "r") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_all(data: Dict[str, List[str]]) -> None:
    WATCHLIST_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(WATCHLIST_FILE, "w") as f:
        json.dump(data, f)


# --------------------------------------------------
# Limits
# --------------------------------------------------

FREE_WATCHLIST_LIMIT = 3
PREMIUM_WATCHLIST_LIMIT = 50


class ProRequiredError(Exception):
    code = "PRO_REQUIRED"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def _normalize_ticker(ticker: str) -> str:
    return (ticker or "").strip().upper()


def _get_limit_for_user(user_id: str) -> int:
    return PREMIUM_WATCHLIST_LIMIT if is_premium(user_id) else FREE_WATCHLIST_LIMIT


def _utc_iso_z() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _analysis_fallback(ticker: str, error_msg: str) -> Dict[str, Any]:
    t = _normalize_ticker(ticker)
    return {
        "ok": False,
        "ticker": t,
        "as_of": _utc_iso_z(),
        "company_name": None,
        "momentum": None,
        "signals": {"momentum_decay": None},
        "summary": "",
        "error": error_msg,
    }


# --------------------------------------------------
# Public API
# --------------------------------------------------

def add_to_watchlist(user_id: str, ticker: str) -> List[str]:
    user_id = str(user_id)
    ticker = _normalize_ticker(ticker)
    if not ticker:
        raise ValueError("Ticker cannot be empty.")

    data = _load_all()
    watchlist = data.setdefault(user_id, [])

    watchlist = [_normalize_ticker(t) for t in watchlist]
    data[user_id] = watchlist

    if ticker in watchlist:
        return list(watchlist)

    limit = _get_limit_for_user(user_id)
    if len(watchlist) >= limit:
        if not is_premium(user_id):
            raise ProRequiredError(
                "Pro required to add more than 3 tickers to your watchlist."
            )
        raise ValueError(f"Watchlist limit reached (max {limit}).")

    watchlist.append(ticker)
    _save_all(data)
    return list(watchlist)


def remove_from_watchlist(user_id: str, ticker: str) -> List[str]:
    user_id = str(user_id)
    ticker = _normalize_ticker(ticker)

    data = _load_all()
    watchlist = data.get(user_id, [])

    if ticker in watchlist:
        watchlist.remove(ticker)
        _save_all(data)

    return list(watchlist)


def get_watchlist(user_id: str) -> List[str]:
    user_id = str(user_id)
    data = _load_all()
    return list(data.get(user_id, []))


def get_watchlist_with_analysis(user_id: str) -> List[Dict[str, Any]]:
    tickers = get_watchlist(user_id)
    results: List[Dict[str, Any]] = []

    for ticker in tickers:
        try:
            results.append(analyze_ticker(ticker))
        except Exception as e:
            print(f"[watchlist_service] Error analyzing {ticker}: {e}")
            results.append(_analysis_fallback(ticker, "Failed to analyze ticker."))

    return results


