import os
import sqlite3
from typing import Any, Dict, List, Optional, Tuple


_DB_PATH = os.getenv("ALERTS_DB_PATH", "alerts.db")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS alert_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                ticker TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT,
                updated_at TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS alert_state (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                ticker TEXT NOT NULL,
                last_regime TEXT,
                last_trend_bucket TEXT,
                last_decay TEXT,
                last_sent_at TEXT,
                created_at TEXT,
                updated_at TEXT,
                UNIQUE(email, ticker)
            )
            """
        )


def get_rules(enabled_only: bool = True) -> List[Dict[str, Any]]:
    q = "SELECT * FROM alert_rules"
    params: Tuple[Any, ...] = ()
    if enabled_only:
        q += " WHERE enabled = ?"
        params = (1,)

    with _connect() as conn:
        rows = conn.execute(q, params).fetchall()
        rules = []
        for r in rows:
            d = dict(r)
            d["enabled"] = bool(d["enabled"])
            rules.append(d)
        return rules


def get_rules_for_email(email: str) -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM alert_rules WHERE email = ?",
            (email,),
        ).fetchall()

        rules = []
        for r in rows:
            d = dict(r)
            d["enabled"] = bool(d["enabled"])
            rules.append(d)
        return rules


def delete_rule(email: str, ticker: str) -> None:
    with _connect() as conn:
        conn.execute(
            "DELETE FROM alert_rules WHERE email = ? AND ticker = ?",
            (email, ticker),
        )


def upsert_rule(email: str, ticker: str, enabled: bool = True) -> None:
    now = sqlite3.datetime.datetime.utcnow().isoformat() + "Z"
    enabled_i = 1 if enabled else 0

    with _connect() as conn:
        existing = conn.execute(
            "SELECT id FROM alert_rules WHERE email = ? AND ticker = ?",
            (email, ticker),
        ).fetchone()

        if existing:
            conn.execute(
                """
                UPDATE alert_rules
                SET enabled = ?, updated_at = ?
                WHERE id = ?
                """,
                (enabled_i, now, existing["id"]),
            )
        else:
            conn.execute(
                """
                INSERT INTO alert_rules (email, ticker, enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (email, ticker, enabled_i, now, now),
            )


def get_state(email: str, ticker: str) -> Optional[Dict[str, Any]]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM alert_state WHERE email = ? AND ticker = ?",
            (email, ticker),
        ).fetchone()
        return dict(row) if row else None


def upsert_state(
    email: str,
    ticker: str,
    last_regime: Optional[str] = None,
    last_trend_bucket: Optional[str] = None,
    last_decay: Optional[str] = None,
) -> None:
    now = sqlite3.datetime.datetime.utcnow().isoformat() + "Z"

    with _connect() as conn:
        existing = conn.execute(
            "SELECT id FROM alert_state WHERE email = ? AND ticker = ?",
            (email, ticker),
        ).fetchone()

        if existing:
            conn.execute(
                """
                UPDATE alert_state
                SET last_regime = ?,
                    last_trend_bucket = ?,
                    last_decay = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (last_regime, last_trend_bucket, last_decay, now, existing["id"]),
            )
        else:
            conn.execute(
                """
                INSERT INTO alert_state
                    (email, ticker, last_regime, last_trend_bucket, last_decay, created_at, updated_at)
                VALUES
                    (?, ?, ?, ?, ?, ?, ?)
                """,
                (email, ticker, last_regime, last_trend_bucket, last_decay, now, now),
            )


def update_last_sent(email: str, ticker: str, last_sent_at: str) -> None:
    now = sqlite3.datetime.datetime.utcnow().isoformat() + "Z"

    with _connect() as conn:
        conn.execute(
            """
            UPDATE alert_state
            SET last_sent_at = ?, updated_at = ?
            WHERE email = ? AND ticker = ?
            """,
            (last_sent_at, now, email, ticker),
        )
