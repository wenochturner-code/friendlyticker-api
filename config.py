"""
Centralized settings for FriendlyTicker MVP.

This file reads environment variables (optionally from a .env file)
and provides sane defaults so the app can boot locally.
"""

import os
from dataclasses import dataclass
from typing import Dict, Any
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from the .env file NEXT TO THIS FILE
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_PATH)


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _get_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _get_str(name: str, default: str = "") -> str:
    raw = os.getenv(name)
    return default if raw is None else raw


# ---------------------------
# External API Keys
# ---------------------------
STOCK_API_KEY: str = _get_str("STOCK_API_KEY", "")
AI_API_KEY: str = _get_str("AI_API_KEY", "")

# ---------------------------
# Core Momentum Settings
# ---------------------------
DEFAULT_LOOKBACK_DAYS: int = _get_int("DEFAULT_LOOKBACK_DAYS", 90)
MOMENTUM_SHIFT_THRESHOLD: float = _get_float("MOMENTUM_SHIFT_THRESHOLD", 5.0)

# ---------------------------
# AI Settings
# ---------------------------
AI_MODEL: str = _get_str("AI_MODEL", "gpt-4o-mini")

# ---------------------------
# Monetization / Limits
# ---------------------------
MAX_FREE_WATCHLIST: int = _get_int("MAX_FREE_WATCHLIST", 5)


@dataclass(frozen=True)
class Settings:
    STOCK_API_KEY: str
    AI_API_KEY: str
    DEFAULT_LOOKBACK_DAYS: int
    MOMENTUM_SHIFT_THRESHOLD: float
    AI_MODEL: str
    MAX_FREE_WATCHLIST: int


def get_settings() -> Dict[str, Any]:
    return {
        "STOCK_API_KEY": STOCK_API_KEY,
        "AI_API_KEY": AI_API_KEY,
        "DEFAULT_LOOKBACK_DAYS": DEFAULT_LOOKBACK_DAYS,
        "MOMENTUM_SHIFT_THRESHOLD": MOMENTUM_SHIFT_THRESHOLD,
        "AI_MODEL": AI_MODEL,
        "MAX_FREE_WATCHLIST": MAX_FREE_WATCHLIST,
    }


def get_settings_obj() -> Settings:
    return Settings(**get_settings())

