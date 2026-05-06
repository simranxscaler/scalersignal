import json
from openai import OpenAI

client = OpenAI()

SYSTEM = """You are an expert sales call analyst. Extract structured intelligence from a sales call transcript.
Return ONLY valid JSON — no markdown, no explanation."""

PROMPT = """Analyse this sales call transcript and extract:

{
  "open_questions": ["exact questions the lead asked, verbatim or near-verbatim"],
  "objections": [{"objection": "...", "intensity": "high|medium|low"}],
  "intent_signals": ["specific phrases that signal intent or readiness"],
  "emotional_state": "one sentence — lead's emotional state during the call",
  "persona_type": "one of: career_switcher | senior_explorer | fresher_anxious | re_activation",
  "key_context": "2-3 sentences — the most important things to know about this lead"
}

Transcript:
{transcript}"""

def extract(transcript: str) -> dict:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": PROMPT.format(transcript=transcript)}
        ],
        temperature=0.2,
        response_format={"type": "json_object"}
    )
    content = resp.choices[0].message.content
    print(f"[extractor] raw content: {repr(content[:300]) if content else 'NONE'}")
    if not content:
        return {"open_questions": [], "objections": [], "intent_signals": [], "emotional_state": "", "persona_type": "career_switcher", "key_context": ""}
    raw = content.strip()
    # Strip markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()
    # Wrap in braces if model returned bare key-value pairs without outer {}
    if raw and not raw.startswith("{"):
        raw = "{" + raw + "}"
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[extractor] JSON parse error: {e}, raw: {raw[:500]}")
        raise
