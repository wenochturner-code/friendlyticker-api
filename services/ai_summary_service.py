# services/ai_summary_service.py


from typing import List, Dict, Any, Optional

# ✅ Step 8 fix: make OpenAI import optional so missing package doesn't crash app
try:
    from openai import OpenAI  # type: ignore
except ModuleNotFoundError:
    OpenAI = None  # type: ignore

from config import AI_API_KEY, AI_MODEL

# ✅ Step 8: Only initialize OpenAI client if:
#   - openai package is installed
#   - AND a key exists
client: Optional["OpenAI"] = OpenAI(api_key=AI_API_KEY) if (OpenAI and AI_API_KEY) else None


def _derive_regime(trend_label: str) -> str:
    """
    Convert your internal momentum label into a simple swing-trader regime:
    Uptrend / Sideways / Downtrend
    """
    label = (trend_label or "").strip().lower()

    # Heuristic mapping (MVP-safe). If your labels are already "Uptrend/Downtrend/Sideways",
    # this will still map correctly.
    if "up" in label or "bull" in label or "strong" in label and "down" not in label:
        return "Uptrend"
    if "down" in label or "bear" in label or "weak" in label:
        return "Downtrend"
    if "side" in label or "range" in label or "flat" in label or "chop" in label:
        return "Sideways"

    # Default (neutral)
    return "Sideways"


def generate_ai_summary(
    ticker: str,
    company_profile: Dict[str, Any],
    news: List[Dict[str, Any]],
    momentum: Dict[str, Any],
) -> str:
    """
    Generate a neutral, swing-trader-aligned summary.

    Rules (MVP):
    - No financial advice, no predictions, no hype
    - Allowed terms: uptrend / downtrend / sideways / momentum cooling
    - Must mention Regime + Trend Confidence in ONE sentence max
    - Total output: 2–4 sentences
    - If AI_API_KEY is missing, return deterministic fallback immediately (no cost)
    """

    print("🚨 generate_ai_summary hit")
    print("payload:", {
        "ticker": ticker,
        "company_profile_keys": list((company_profile or {}).keys())[:20],
        "news_len": len(news) if isinstance(news, list) else None,
        "momentum_keys": list((momentum or {}).keys())[:20],
    })

    # ----------------------------
    # Defensive defaults
    # ----------------------------
    ticker = (ticker or "").upper().strip() or "UNKNOWN"

    company_name = (
        (company_profile or {}).get("name")
        or (company_profile or {}).get("company_name")
        or ticker
    )
    sector = (company_profile or {}).get("sector", "an unknown sector")
    description = (company_profile or {}).get(
        "description",
        "The company operates in its industry, but detailed information is limited."
    )

    trend_label = (momentum or {}).get("label", "Sideways")
    trend_score = (momentum or {}).get("score", 0)
    delta_1d = (momentum or {}).get("delta_since_close", None)

    # NEW (prompt-only usage): still reading the backend field "momentum_decay"
    # but we describe it in prompt as "Trend Pressure"
    momentum_decay = (momentum or {}).get("momentum_decay", None)

    regime = _derive_regime(trend_label)

    # Use only the most relevant headline (keep it simple)
    headline = ""
    if news and isinstance(news, list):
        headline = (news[0] or {}).get("headline", "") or ""

    # ✅ Hard fallback: if key missing OR openai not installed, do NOT call OpenAI
    if not AI_API_KEY or client is None:
        return fallback_summary(
            company_name=company_name,
            ticker=ticker,
            sector=sector,
            regime=regime,
            trend_label=trend_label,
            trend_score=trend_score,
            delta_1d=delta_1d,
        )

    # ----------------------------
    # Prompt construction
    # ----------------------------
    system_prompt = (
        "You are an assistant for a swing-trader analytics app. "
        "Write neutral, descriptive context that explains what the user is seeing (not instructions). "
        "You may use: uptrend, downtrend, sideways, momentum cooling/strengthening, trend pressure. "
        "Forbidden: buy/sell language, price targets, predictions, portfolio advice, or hype. "
        "Output must be 2–4 short sentences total. "
        "Sentence 1 MUST include Regime + Trend Confidence (0–100) in ONE sentence max and must not contradict them. "
        "You MUST explain what each metric means in plain English. "
        "News rule: only mention news if a headline is provided; if no headline is provided, do not mention news at all."
    )

    # Provide a compact delta hint (still descriptive, not advice)
    delta_line = ""
    if isinstance(delta_1d, (int, float)):
        if delta_1d <= -8:
            delta_line = "Confidence Delta (1D): sharply lower (cooling)."
        elif delta_1d <= -4:
            delta_line = "Confidence Delta (1D): moderately lower (cooling)."
        elif delta_1d >= 4:
            delta_line = "Confidence Delta (1D): higher (strengthening)."
        else:
            delta_line = "Confidence Delta (1D): roughly unchanged."

    # Trend Pressure mapping guidance (prompt-only; frontend can rename label separately)
    # momentum_decay can be: "None", "Mild", "Elevated" (or missing)
    trend_pressure_value = (str(momentum_decay).strip() if momentum_decay is not None else "")
    if trend_pressure_value.lower() == "none":
        trend_pressure_display = "Stable"
        trend_pressure_help = "No evidence of weakening trend strength."
    elif trend_pressure_value.lower() == "mild":
        trend_pressure_display = "Easing"
        trend_pressure_help = "Trend strength is cooling versus recent sessions."
    elif trend_pressure_value.lower() == "elevated":
        trend_pressure_display = "Elevated"
        trend_pressure_help = "Trend strength is fading more noticeably."
    else:
        trend_pressure_display = "Unknown"
        trend_pressure_help = "Not enough data to describe trend pressure."

    headline_block = headline.strip()
    headline_present = bool(headline_block)

    user_prompt = f"""
Company: {company_name} ({ticker})
Sector: {sector}

What they do (short context):
{description}

Regime (state): {regime}
Trend Confidence (0-100): {trend_score}
Confidence Delta (what changed today): {delta_line or "Confidence Delta (1D): unavailable."}

Trend Pressure (described from momentum_decay):
- Raw momentum_decay: {trend_pressure_value or "missing"}
- Display: {trend_pressure_display}
- Meaning: {trend_pressure_help}

Internal trend label (do not over-focus on this): {trend_label}

Headline provided: {"YES" if headline_present else "NO"}
Headline (only use if provided):
{headline_block if headline_present else "[none]"}

Write 2–4 short sentences total, neutral tone:
1) Sentence 1 MUST include the Regime and Trend Health (0–100) in ONE sentence max.
2) Next sentence: explain in plain English what that Regime + Health means structurally (not a prediction).
3) Next sentence: explain Change in Health (what changed today) AND Trend Pressure (Stable/Easing/Elevated) in context, only if supported by the inputs above.
4) Optional final sentence: ONLY if a headline is provided, include ONE sentence that explains the event and explicitly states whether it DID or DID NOT coincide with a change in regime/Health today.
Do not give advice. Do not predict. Do not add targets. Do not mention news if Headline provided is NO.
"""

    # ----------------------------
    # OpenAI call
    # ----------------------------

    print("🔥 calling OpenAI now")

    try:
        response = client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,  # grounded + consistent
            max_tokens=150,   # keeps it short (2–4 sentences)
        )

        content = response.choices[0].message.content
        return content.strip() if content else fallback_summary(
            company_name=company_name,
            ticker=ticker,
            sector=sector,
            regime=regime,
            trend_label=trend_label,
            trend_score=trend_score,
            delta_1d=delta_1d,
        )

    except Exception as e:
        print("❌ OPENAI ERROR:", repr(e))
        raise


def fallback_summary(
    company_name: str,
    ticker: str,
    sector: str,
    regime: str,
    trend_label: str,
    trend_score: int,
    delta_1d: Any,
) -> str:
    """
    Deterministic fallback if AI is unavailable.
    Must be neutral, short, and not contradictory (2–4 sentences).
    """
    # Describe delta without advice
    delta_sentence = ""
    if isinstance(delta_1d, (int, float)):
        if delta_1d <= -8:
            delta_sentence = "Trend confidence dropped sharply since the last close, which suggests momentum is cooling."
        elif delta_1d <= -4:
            delta_sentence = "Trend confidence fell since the last close, which suggests momentum is cooling."
        elif delta_1d >= 4:
            delta_sentence = "Trend confidence improved since the last close, which suggests momentum is strengthening."
        else:
            delta_sentence = "Trend confidence is roughly unchanged since the last close."

    # Sentence 1 includes Regime + Trend Confidence (ONE sentence)
    s1 = f"{company_name} ({ticker}) is currently in a {regime} with Trend Confidence at {trend_score}/100."
    s2 = f"It operates in the {sector}, and the current state is a descriptive snapshot (not a prediction)."

    if delta_sentence:
        return f"{s1} {s2} {delta_sentence}"
    return f"{s1} {s2}"
