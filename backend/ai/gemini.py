import os
import json
from google import genai
from dotenv import load_dotenv
from ai.prompt import build_prompt

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

if not client:
    raise RuntimeError("Missing GEMINI_API_KEY in environment.")

SYSTEM_PROMPT = """You are FinSight, a professional financial analyst AI. Given structured data about a publicly traded company, you will produce a concise, accurate financial intelligence report.

You MUST respond ONLY with a valid JSON object. No preamble, no markdown, no explanation outside the JSON.

JSON schema:
{
  "sentiment_score": float between -1.0 and 1.0,
  "bull_case": string,
  "bear_case": string,
  "key_risks": [array of 3-5 short strings],
  "overall_grade": one of "A", "B", "C", "D", "F",
  "grade_rationale": string
}"""


def generate_report(ticker: str, price_data: dict, news: list[dict]) -> dict:
    """
    Calls Gemini and returns a parsed dict matching the report schema.
    Raises ValueError if the response cannot be parsed as valid JSON.
    """
    model_id = "gemini-2.5-flash-preview"
    user_prompt = build_prompt(ticker, price_data, news)

    response = client.models.generate_content(
        model=model_id,
        contents=user_prompt,
        config={'system_instruction': SYSTEM_PROMPT}
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

    # Validate required keys are present
    required = {"sentiment_score", "bull_case", "bear_case", "key_risks", "overall_grade"}
    missing = required - result.keys()
    if missing:
        raise ValueError(f"Gemini response missing keys: {missing}")

    return result
