"""
data/company_info.py
Responsible for retrieving:
    - Basic company profile (name, sector, description)
    - Recent news headlines

Per MVP + product vision:
    - Keep responses small and beginner-friendly.
    - Do NOT overload the user with financial metrics or technical data.
    - Provide only the context needed for AI summaries.
"""

import requests
from config import STOCK_API_KEY


def fetch_company_profile(ticker):
    """
    Fetch basic company information.
    Returns a dict:
        {
            "name": str,
            "sector": str,
            "description": str
        }

    For MVP:
        - Keep the fields minimal.
        - If API fails, return a safe fallback profile.
    """

    url = (
        "https://www.alphavantage.co/query"
        f"?function=OVERVIEW"
        f"&symbol={ticker}"
        f"&apikey={STOCK_API_KEY}"
    )

    try:
        response = requests.get(url, timeout=5)
        data = response.json()

        return {
            "name": data.get("Name", ticker),
            "sector": data.get("Sector", "Unknown Sector"),
            "description": data.get("Description", "No description available."),
        }

    except Exception:
        # Fallback profile to maintain app stability (beginner-friendly)
        return {
            "name": ticker,
            "sector": "Unknown",
            "description": "No company profile available at this time."
        }


def fetch_recent_news(ticker):
    """
    Fetch a small list of recent news headlines.
    Returns a list of dicts:
        [
            { "headline": "...", "url": "..." },
            ...
        ]

    For MVP:
        - Keep it short: 3–5 news items max.
        - Use simple text suitable for AI summaries.
    """

    url = (
        "https://www.alphavantage.co/query"
        f"?function=NEWS_SENTIMENT"
        f"&tickers={ticker}"
        f"&apikey={STOCK_API_KEY}"
    )

    try:
        response = requests.get(url, timeout=5)
        data = response.json()

        articles = data.get("feed", [])
        formatted = []

        for item in articles[:5]:  # small list to maintain simplicity
            formatted.append({
                "headline": item.get("title", "No headline available"),
                "url": item.get("url", None)
            })

        return formatted

    except Exception:
        # Safe fallback — keeps the app friendly and stable
        return [
            {"headline": "No recent news available.", "url": None}
        ]
