"""
logic/validation.py
Pure logic: validates ticker symbols before any data or AI work happens.
No API calls. No business logic. Simple, beginner-friendly checks.
"""

def validate_ticker(ticker: str) -> str:
    """
    Validates a stock ticker string (MVP rules).

    Rules (from MVP plan):
    - uppercase + strip
    - allow letters + "." + "-"
    - length 1–10
    - else raise ValueError

    Returns:
        cleaned, uppercased ticker symbol.

    Raises:
        ValueError if ticker is invalid.
    """
    if ticker is None:
        raise ValueError("Ticker cannot be empty.")

    cleaned = ticker.strip().upper()
    if cleaned == "":
        raise ValueError("Ticker cannot be empty.")

    if len(cleaned) < 1 or len(cleaned) > 10:
        raise ValueError("Ticker must be 1–10 characters.")

    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ.-")
    for ch in cleaned:
        if ch not in allowed:
            raise ValueError("Ticker may only contain letters, '.' or '-'.")

    return cleaned

