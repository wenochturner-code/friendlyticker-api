# services/analysis_service.py

"""
High-level analysis service for FriendlyTicker.

This module is the "orchestra conductor" that coordinates:
- validation
- data fetching
- momentum logic
- AI summary

It exposes a single main function:

    analyze_ticker(ticker: str) -> dict

which the UI can call to get everything it needs in one shot.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from logic.validation import validate_ticker
from data.market_data_source import fetch_price_history
from data.company_info import fetch_company_profile, fetch_recent_news
from logic.momentum import calculate_momentum_with_delta
from services.ai_summary_service import generate_ai_summary


def analyze_ticker(ticker: str) -> Dict[str, Any]:
    """
    Run the full analysis pipeline for a single stock ticker.

    Returns a clean, stable result object that the UI can display.
    Always returns the same shape, with missing data as explicit nulls.
    """
    # Basic normalization: strip spaces and uppercase the ticker
    raw_ticker = (ticker or "").strip().upper()

    def _utc_iso_z() -> str:
        return datetime.utcnow().isoformat() + "Z"

    # ✅ Stable MVP schema (single contract)
    result: Dict[str, Any] = {
        "ok": False,
        "ticker": raw_ticker,
        "as_of": None,  # set on every return
        "company_name": None,
        "momentum": None,  # { label, score, delta_since_close } or null
        "signals": {
            "regime": None,
            "trend_score": None,
            "delta_1d": None,
            "momentum_decay": None,
        },
        "summary": "",
        "error": None,
    }

    # 1) Validation
    try:
        maybe_cleaned = validate_ticker(raw_ticker)
        cleaned_ticker = maybe_cleaned or raw_ticker
        result["ticker"] = cleaned_ticker
    except ValueError as e:
        result["error"] = str(e) or "Invalid ticker symbol."
        result["as_of"] = _utc_iso_z()
        return result

    # 2) Fetch price history + 3) compute momentum + decay signal
    try:
        price_history = fetch_price_history(cleaned_ticker)
        momentum = calculate_momentum_with_delta(price_history)
        result["momentum"] = momentum

        if isinstance(momentum, dict):
            result["signals"]["trend_score"] = momentum.get("score")
            result["signals"]["delta_1d"] = momentum.get("delta_since_close")
            result["signals"]["regime"] = momentum.get("regime")

        # ✅ Backend-owned momentum decay (MVP rule)
        delta = result["signals"]["delta_1d"]

        if isinstance(delta, (int, float)):
            if delta <= -8:
                decay = "Elevated"
            elif delta <= -4:
                decay = "Mild"
            else:
                decay = "None"
        else:
            decay = None

        result["signals"]["momentum_decay"] = decay

    except Exception as e:
        print(f"[analysis_service] Error in price/momentum step: {e}")
        result["error"] = "We couldn't load recent price data for this ticker right now."
        result["as_of"] = _utc_iso_z()
        return result

    # 4) Fetch company profile + recent news
    try:
        company_profile = fetch_company_profile(cleaned_ticker) or {}
        news_items: List[Dict[str, Any]] = fetch_recent_news(cleaned_ticker) or []

        # extract company name if present (keeps schema stable even if missing)
        company_name: Optional[str] = None
        if isinstance(company_profile, dict):
            company_name = company_profile.get("name") or company_profile.get("companyName")

        result["company_name"] = company_name
        result["company_profile"] = company_profile  # keep if your UI still uses it
        result["news"] = news_items                 # keep if your UI still uses it

    except Exception as e:
        print(f"[analysis_service] Error in company/news step: {e}")
        # Keep these explicit + safe defaults
        result["company_name"] = result.get("company_name") or None
        result["company_profile"] = result.get("company_profile") or {}
        result["news"] = result.get("news") or []
        result["error"] = (
            "We had trouble loading company info or news, "
            "so the explanation may be less detailed."
        )

    # 5) Generate AI summary (even if some data was missing)
    try:
        summary = generate_ai_summary(
            cleaned_ticker,
            result.get("company_profile") or {},
            result.get("news") or [],
            result.get("momentum") or {},
        )
        result["summary"] = summary
    except Exception as e:
        print(f"[analysis_service] Error in AI summary step: {e}")
        if not result["error"]:
            result["error"] = (
                "We had trouble generating the AI explanation. "
                "You can still use the momentum label as a simple trend signal."
            )

    # ✅ Always stamp recency
    result["as_of"] = _utc_iso_z()

    # ok flag based on whether we have momentum
    result["ok"] = True if result["momentum"] else False
    if not result["momentum"] and not result["error"]:
        result["error"] = "Analysis did not complete successfully."

    return result

