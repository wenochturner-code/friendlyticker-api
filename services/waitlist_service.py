# services/waitlist_service.py
from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Dict, List

WAITLIST_PATH = os.getenv("WAITLIST_PATH", "data/waitlist.json")


def _load() -> List[Dict[str, str]]:
    if not os.path.exists(WAITLIST_PATH):
        return []
    try:
        with open(WAITLIST_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except Exception:
        return []


def _save(rows: List[Dict[str, str]]) -> None:
    os.makedirs(os.path.dirname(WAITLIST_PATH) or ".", exist_ok=True)
    with open(WAITLIST_PATH, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)


def save_waitlist_email(email: str) -> None:
    """
    Save/append a waitlist email (deduped).
    """
    email = (email or "").strip().lower()
    if not email:
        return

    rows = _load()
    if any(r.get("email") == email for r in rows):
        return

    rows.append({"email": email, "created_at": datetime.utcnow().isoformat() + "Z"})
    _save(rows)
