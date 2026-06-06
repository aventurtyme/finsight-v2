import os
import json
from google import genai
from dotenv import load_dotenv
from ai.prompt import build_prompt

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

if not client:
    raise RuntimeError("Missing GEMINI_API_KEY in environment.")

FRAMING_INSTRUCTIONS = {
    "A": "Provide a balanced, objective assessment. Do not bias your recommendation toward optimism or caution.",
    "B": "Analyse conservatively, emphasising downside risks, capital preservation, and margin of safety. Weight negative signals more heavily.",
    "C": "Focus on growth catalysts, upside potential, and momentum. Weight positive signals and forward-looking indicators more heavily.",
}

SYSTEM_PROMPT_TEMPLATE = """You are FinSight, a professional financial analyst AI. Given structured data about a publicly traded company, you will produce a concise, accurate financial intelligence report.

You MUST respond ONLY with a valid JSON object. No preamble, no markdown, no explanation outside the JSON.

JSON schema:
{{
  "sentiment_score": float between -1.0 and 1.0,
  "recommendation": "Buy" | "Hold" | "Reduce",
  "confidence": float between 0.0 and 1.0,
  "bull_case": string,
  "bear_case": string,
  "key_risks": [array of 3-5 short strings],
  "overall_grade": one of "A", "B", "C", "D", "F",
  "grade_rationale": string
}}

{framing_instruction}"""


def generate_report(
    ticker: str,
    price_data: dict,
    news: list[dict],
    prompt_variant: str = "A",
) -> dict:
    """
    Calls Gemini and returns a parsed dict matching the report schema.
    prompt_variant: "A" (Neutral), "B" (Conservative), "C" (Growth-Oriented)
    Raises ValueError if the response cannot be parsed as valid JSON.
    """
    prompt_variant = prompt_variant.upper()
    if prompt_variant not in FRAMING_INSTRUCTIONS:
        raise ValueError(f"Invalid prompt_variant '{prompt_variant}'. Must be A, B, or C.")

    framing = FRAMING_INSTRUCTIONS[prompt_variant]
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(framing_instruction=framing)

    model_id = "gemini-3.5-flash"
    user_prompt = build_prompt(ticker, price_data, news)

    response = client.models.generate_content(
        model=model_id,
        contents=user_prompt,
        config={"system_instruction": system_prompt},
    )

    raw_text = response.text.strip()

    # Strip markdown code fences if Gemini wraps the JSON anyway
    if raw_text.startswith("```"):
        raw_text = raw_text.split("```")[1]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
        raw_text = raw_text.strip()

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Gemini returned non-JSON response: {raw_text[:200]}") from e

    # Validate required keys
    required = {
        "sentiment_score",
        "recommendation",
        "confidence",
        "bull_case",
        "bear_case",
        "key_risks",
        "overall_grade",
    }
    missing = required - result.keys()
    if missing:
        raise ValueError(f"Gemini response missing keys: {missing}")

    # Validate recommendation value
    if result["recommendation"] not in ("Buy", "Hold", "Reduce"):
        raise ValueError(f"Invalid recommendation value: {result['recommendation']}")

    # Clamp confidence to [0.0, 1.0] in case model drifts
    result["confidence"] = max(0.0, min(1.0, float(result["confidence"])))

    # Store which variant was used
    result["prompt_variant"] = prompt_variant

    return result