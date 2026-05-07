import json
from openai import OpenAI

client = OpenAI()

DIARIZE_SYSTEM = """You are a sales call transcript formatter. Given a raw Whisper transcript from a Scaler EdTech sales call, split it into speaker turns and label each as "BDA" (the sales rep) or the lead's first name.

Rules:
1. The BDA is the Scaler sales rep — they pitch the program, ask about background/intent/goals, handle objections, quote pricing.
2. The lead is the prospect — they describe their situation, ask questions, raise objections about cost/outcome/curriculum.
3. Output format — one turn per line, nothing else:
   BDA: <exact words>
   <LeadName>: <exact words>
4. A single speaker often talks for multiple sentences before the other person speaks. Group consecutive sentences by the same speaker into ONE line — do not split mid-thought.
5. When the speaker changes, start a new line with the new label.
6. If a section of transcript is clearly garbled, repetitive noise, or unintelligible (e.g. repeated "I don't know" or "hello hello"), collapse it to a single line: BDA: [audio unclear] or <LeadName>: [audio unclear]
7. Keep real dialogue verbatim — do not paraphrase or summarize anything that is intelligible.
8. Return ONLY the formatted dialogue — no headers, no timestamps, no explanation."""

def diarize(transcript: str, lead_name: str) -> str:
    """Label each speaker turn in a raw transcript as BDA or lead name."""
    first_name = lead_name.split()[0] if lead_name else "Lead"
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": DIARIZE_SYSTEM},
            {"role": "user", "content": f"Lead's first name: {first_name}\n\nRaw transcript:\n{transcript}"}
        ],
        temperature=0,
    )
    return resp.choices[0].message.content.strip()

SYSTEM = """You are extracting structured data from a sales call transcript.

ABSOLUTE RULES:
1. Only extract what is explicitly said in the transcript. Never infer or assume.
2. open_questions: copy verbatim or near-verbatim from what the lead actually said. If none, return [].
3. objections: only real objections the lead explicitly raised. If none, return [].
4. intent_signals: only direct quotes or paraphrases of things the lead said showing interest. If none, return [].
5. emotional_state: describe only what is observable from the words used — not assumed feelings.
6. key_context: only facts explicitly stated. No assumptions about their situation.
7. If the transcript is too short or vague to extract something, leave that field empty — do not fill it in.
8. sentiment_score: integer 0-10 rating the lead's overall buying intent and positivity based strictly on their words.
   0 = hostile/zero interest, 5 = neutral/curious, 10 = highly engaged and ready to move forward.
9. sentiment_label: one of "Hot" | "Warm" | "Cold" matching the score (7-10 = Hot, 4-6 = Warm, 0-3 = Cold).
10. call_quality: one of "good" | "average" | "poor" — assess how well the BDA handled the call (did they listen, address objections, build rapport?).

Return ONLY valid JSON — no markdown, no explanation."""

PROMPT = """Extract structured intelligence from this sales call transcript. Only use what is explicitly stated.

{{
  "open_questions": ["verbatim or near-verbatim questions the lead asked — empty list if none"],
  "objections": [{{"objection": "exact objection raised", "intensity": "high|medium|low"}}],
  "intent_signals": ["direct quotes showing interest or readiness — empty if none"],
  "emotional_state": "observable tone from words used — not assumed feelings. Empty string if unclear.",
  "persona_type": "one of: career_switcher | senior_explorer | fresher_anxious | re_activation — only if clearly evident from transcript",
  "key_context": "facts explicitly stated in the transcript only — no assumptions. Empty string if insufficient data.",
  "sentiment_score": 0,
  "sentiment_label": "Cold | Warm | Hot",
  "call_quality": "good | average | poor"
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
