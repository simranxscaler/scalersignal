import json
from openai import OpenAI

client = OpenAI()

SYSTEM = """You are extracting structured data from a sales call transcript.

ABSOLUTE RULES:
1. Only extract what is explicitly said in the transcript. Never infer or assume.
2. open_questions: copy verbatim or near-verbatim from what the lead actually said. If none, return [].
3. objections: only real objections the lead explicitly raised. If none, return [].
4. intent_signals: only direct quotes or paraphrases of things the lead said showing interest. If none, return [].
5. emotional_state: describe only what is observable from the words used — not assumed feelings.
6. key_context: only facts explicitly stated. No assumptions about their situation.
7. If the transcript is too short or vague to extract something, leave that field empty — do not fill it in.

Return ONLY valid JSON — no markdown, no explanation."""

PROMPT = """Extract structured intelligence from this sales call transcript. Only use what is explicitly stated.

{{
  "open_questions": ["verbatim or near-verbatim questions the lead asked — empty list if none"],
  "objections": [{{"objection": "exact objection raised", "intensity": "high|medium|low"}}],
  "intent_signals": ["direct quotes showing interest or readiness — empty if none"],
  "emotional_state": "observable tone from words used — not assumed feelings. Empty string if unclear.",
  "persona_type": "one of: career_switcher | senior_explorer | fresher_anxious | re_activation — only if clearly evident from transcript",
  "key_context": "facts explicitly stated in the transcript only — no assumptions. Empty string if insufficient data."
}}

Transcript:
{transcript}"""

def extract(transcript: str) -> dict:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": PROMPT.format(transcript=transcript)}
        ],
        temperature=0,
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
