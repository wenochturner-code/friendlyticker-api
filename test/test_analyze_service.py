# test/test_analysis_service.py

"""
Tests for services/analysis_service.py

Goal (per MVP plan):
- Make sure analyze_ticker(ticker) returns all the required fields
  that the frontend / API contract expects, without caring about
  the exact momentum math or AI wording here.

We stub out (monkeypatch) dependencies so this test never hits
real APIs or real AI.
"""

from typing import Any, Dict, List

import pytest

import services.analysis_service as analysis_service


def test_analyze_ticker_returns_required_fields(monkeypatch: pytest.MonkeyPatch):
    """
    analyze_ticker(ticker) should return a dict with at least:

    {
        "ok": bool,
        "ticker": str,
        "momentum": dict | None,
        "company_profile": dict | None,
        "news": list,
        "summary": str,
        "error": str | None,
    }

    This matches the technical MVP contract that the frontend / API
    relies on, not the exact implementation details.
    """

    # --- Stub dependencies inside services.analysis_service ---

    def fake_validate_ticker(ticker: str) -> str:
        # Just return cleaned ticker, no real validation logic.
        return ticker.strip().upper()

    def fake_fetch_price_history(ticker: str) -> List[float]:
        # Simple upward series to simulate "Uptrend".
        return [10, 11, 12, 13, 14]

    def fake_calculate_momentum(price_history: List[float]) -> Dict[str, Any]:
        return {"label": "Uptrend", "score": 80}

    def fake_fetch_company_profile(ticker: str) -> Dict[str, Any]:
        return {
            "name": "Test Corp",
            "sector": "Technology",
            "description": "A test company used in unit tests.",
        }

    def fake_fetch_recent_news(ticker: str) -> List[Dict[str, Any]]:
        return [
            {
                "headline": "Test Corp announces unit test success",
                "summary": "The company successfully passed all test cases.",
                "url": "https://example.com/test-news",
                "published_at": "2025-01-01T00:00:00Z",
            }
        ]

    def fake_generate_ai_summary(
        ticker: str,
        company_profile: Dict[str, Any],
        news: List[Dict[str, Any]],
        momentum: Dict[str, Any],
    ) -> str:
        return "This is a fake AI summary for testing."

    # Patch the symbols used INSIDE services.analysis_service
    monkeypatch.setattr(analysis_service, "validate_ticker", fake_validate_ticker)
    monkeypatch.setattr(analysis_service, "fetch_price_history", fake_fetch_price_history)
    monkeypatch.setattr(analysis_service, "calculate_momentum", fake_calculate_momentum)
    monkeypatch.setattr(
        analysis_service, "fetch_company_profile", fake_fetch_company_profile
    )
    monkeypatch.setattr(
        analysis_service, "fetch_recent_news", fake_fetch_recent_news
    )
    monkeypatch.setattr(
        analysis_service, "generate_ai_summary", fake_generate_ai_summary
    )

    # --- Call the function under test ---
    result = analysis_service.analyze_ticker("aapl")

    # --- Basic type / shape checks ---
    assert isinstance(result, dict)

    required_keys = {
        "ok",
        "ticker",
        "momentum",
        "company_profile",
        "news",
        "summary",
        "error",
    }
    assert required_keys.issubset(result.keys())

    # --- Specific field expectations for a successful analysis ---
    assert result["ok"] is True
    assert result["ticker"] == "AAPL"  # should be uppercased/normalized
    assert isinstance(result["momentum"], dict)
    assert result["momentum"]["label"] == "Uptrend"
    assert 0 <= result["momentum"]["score"] <= 100

    assert isinstance(result["company_profile"], dict)
    assert result["company_profile"]["name"] == "Test Corp"

    assert isinstance(result["news"], list)
    assert len(result["news"]) >= 1

    assert isinstance(result["summary"], str)
    assert "fake AI summary" in result["summary"]

    # For the happy path, error should normally be None
    assert result["error"] is None
