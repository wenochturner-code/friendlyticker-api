from typing import Any, Dict, List, Optional

# ✅ STEP 2: load environment variables
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).with_name(".env"), override=False)

import os
import threading
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.analysis_service import analyze_ticker
from services.watchlist_service import (
    add_to_watchlist,
    remove_from_watchlist,
    get_watchlist_with_analysis,
    ProRequiredError,
)

# ✅ Step 4 import (Pro hook / waitlist)
from services.waitlist_service import save_waitlist_email

# ✅ Phase 1: Use backend validation rules for ticker format
from logic.validation import validate_ticker

# ✅ Alerts wiring
from services.alert_store import init_db, upsert_rule, get_rules, get_rules_for_email, delete_rule
from services.alerts_service import run_alerts_once
from services.alert_delivery import send_email

try:
    from auth.session import get_current_user
except ImportError:
    def get_current_user() -> str:  # type: ignore
        return "demo-user-1"


app = FastAPI(
    title="FriendlyTicker API",
    description="Beginner-friendly stock momentum + AI explanation service.",
    version="0.1.0",
)

origins = [
    "https://friendlyticker-frontend.vercel.app",
    "https://friendlyticker-frontend-*.vercel.app",  # optional, but wildcard won't work in allow_origins list
    "http://127.0.0.1:5500",
    "http://localhost:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://friendlyticker-frontend(-.*)?\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



class AnalyzeRequest(BaseModel):
    ticker: str


class WatchlistModifyRequest(BaseModel):
    ticker: str


class WaitlistRequest(BaseModel):
    email: Optional[str] = None
    user_id: Optional[str] = None
    intent: Optional[str] = None
    source: Optional[str] = None


class AlertUpsertRequest(BaseModel):
    email: str
    ticker: str
    enabled: bool = True


class AlertToggleRequest(BaseModel):
    enabled: bool


def _format_alert_email(ticker: str, signals: Dict[str, Any], reasons: List[str]) -> Dict[str, str]:
    subject = f"FriendlyTicker alert: {ticker}"
    lines = []
    lines.append(f"Ticker: {ticker}")
    lines.append("")
    if reasons:
        lines.append("Triggered because:")
        for r in reasons:
            lines.append(f"- {r}")
        lines.append("")
    lines.append("Signals:")
    lines.append(f"- regime: {signals.get('regime')}")
    lines.append(f"- trend_score: {signals.get('trend_score')}")
    lines.append(f"- delta_1d: {signals.get('delta_1d')}")
    lines.append(f"- momentum_decay: {signals.get('momentum_decay')}")
    body = "\n".join(lines)
    return {"subject": subject, "body": body}


def _alerts_loop() -> None:
    interval = int(os.getenv("ALERTS_INTERVAL_SECONDS", "900"))
    while True:
        try:
            triggered = run_alerts_once()
            for t in triggered:
                email = t.get("email")
                ticker = t.get("ticker")
                signals = t.get("signals") or {}
                reasons = t.get("reasons") or []
                if email and ticker:
                    msg = _format_alert_email(ticker, signals, reasons)
                    send_email(email, msg["subject"], msg["body"])
        except Exception as e:
            print(f"[alerts] scheduler error: {e}")
        time.sleep(interval)


@app.on_event("startup")
def _startup() -> None:
    # ✅ alerts db init
    try:
        init_db()
    except Exception as e:
        print(f"[alerts] init_db error: {e}")

    # ✅ scheduler (every 10–15 mins; default 900s)
    if os.getenv("ALERTS_SCHEDULER_ENABLED", "1") == "1":
        t = threading.Thread(target=_alerts_loop, daemon=True)
        t.start()


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze")
def analyze_stock(body: AnalyzeRequest) -> Dict[str, Any]:
    """
    Analyze a single stock ticker.
    """

    # 🔴 STEP 1: HARD LOGGING
    print("🚨 /api/analyze route hit")
    print("payload:", body.dict())

    ticker = (body.ticker or "").strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required.")

    try:
        validate_ticker(ticker)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = analyze_ticker(ticker)

    if isinstance(result, dict) and (result.get("ok") is False):
        raise HTTPException(status_code=400, detail=result.get("error") or "Invalid ticker.")

    return result


@app.get("/api/watchlist")
def get_user_watchlist() -> List[Dict[str, Any]]:
    user_id = get_current_user()
    return get_watchlist_with_analysis(user_id)


@app.post("/api/watchlist/add")
def add_watchlist_item(body: WatchlistModifyRequest) -> Dict[str, Any]:
    ticker = (body.ticker or "").strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required.")

    user_id = get_current_user()
    try:
        updated = add_to_watchlist(user_id, ticker)
        return {"ok": True, "watchlist": updated, "error": None}
    except ProRequiredError as e:
        return {"ok": False, "watchlist": [], "error": str(e), "code": e.code}
    except ValueError as e:
        return {"ok": False, "watchlist": [], "error": str(e)}


@app.post("/api/watchlist/remove")
def remove_watchlist_item(body: WatchlistModifyRequest) -> Dict[str, Any]:
    ticker = (body.ticker or "").strip()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required.")

    user_id = get_current_user()
    updated = remove_from_watchlist(user_id, ticker)
    return {"ok": True, "watchlist": updated}


@app.post("/api/waitlist")
def waitlist(body: WaitlistRequest) -> Dict[str, Any]:
    email = (body.email or "").strip().lower()

    if email:
        if ("@" not in email) or (len(email) >= 200):
            raise HTTPException(status_code=400, detail="Please enter a valid email address.")
        save_waitlist_email(email)

    return {"ok": True}


@app.post("/api/waitlist/join")
def join_waitlist(body: WaitlistRequest) -> Dict[str, Any]:
    email = (body.email or "").strip().lower()

    if (not email) or ("@" not in email) or (len(email) >= 200):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    save_waitlist_email(email)
    return {"ok": True}


@app.get("/api/alerts")
def api_get_alerts(email: str) -> Dict[str, Any]:
    email_v = (email or "").strip().lower()
    if (not email_v) or ("@" not in email_v) or (len(email_v) >= 200):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    rules = get_rules_for_email(email_v)
    return {"ok": True, "rules": rules}


@app.patch("/api/alerts/{ticker}")
def api_patch_alert(ticker: str, email: str, body: AlertToggleRequest) -> Dict[str, Any]:
    email_v = (email or "").strip().lower()
    ticker_v = (ticker or "").strip().upper()

    if (not email_v) or ("@" not in email_v) or (len(email_v) >= 200):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if not ticker_v:
        raise HTTPException(status_code=400, detail="Ticker is required.")

    try:
        validate_ticker(ticker_v)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    upsert_rule(email=email_v, ticker=ticker_v, enabled=bool(body.enabled))
    return {"ok": True}


@app.delete("/api/alerts/{ticker}")
def api_delete_alert(ticker: str, email: str) -> Dict[str, Any]:
    email_v = (email or "").strip().lower()
    ticker_v = (ticker or "").strip().upper()

    if (not email_v) or ("@" not in email_v) or (len(email_v) >= 200):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if not ticker_v:
        raise HTTPException(status_code=400, detail="Ticker is required.")

    try:
        validate_ticker(ticker_v)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    delete_rule(email=email_v, ticker=ticker_v)
    return {"ok": True}


# ✅ Alerts endpoints (minimal)
@app.post("/alerts/upsert")
def alerts_upsert(body: AlertUpsertRequest) -> Dict[str, Any]:
    email = (body.email or "").strip().lower()
    ticker = (body.ticker or "").strip().upper()

    if (not email) or ("@" not in email) or (len(email) >= 200):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required.")

    try:
        validate_ticker(ticker)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    upsert_rule(email=email, ticker=ticker, enabled=bool(body.enabled))
    return {"ok": True}


@app.get("/alerts/status")
def alerts_status() -> Dict[str, Any]:
    rules = get_rules(enabled_only=False)
    return {"ok": True, "rules": rules}


@app.post("/alerts/run_once")
def alerts_run_once() -> Dict[str, Any]:
    triggered = run_alerts_once()
    sent = 0
    errors: List[str] = []

    for t in triggered:
        try:
            email = t.get("email")
            ticker = t.get("ticker")
            signals = t.get("signals") or {}
            reasons = t.get("reasons") or []
            if email and ticker:
                msg = _format_alert_email(ticker, signals, reasons)
                send_email(email, msg["subject"], msg["body"])
                sent += 1
        except Exception as e:
            errors.append(str(e))

    return {"ok": True, "triggered": triggered, "sent": sent, "errors": errors}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)


