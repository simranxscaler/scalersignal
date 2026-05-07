import json
import os
from openai import OpenAI

client = OpenAI()

_BROCHURES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "Scaler Courses")

_PROGRAM_TO_FILE = {
    "academy":    "Scaler_Academy_Brochure_2026.md",
    "dsml":       "Scaler_DSML_Brochure.md",
    "devops":     "Scaler_DevOps_Cloud_AI_Brochure.md",
    "devops & ai":"Scaler_DevOps_Cloud_AI_Brochure.md",
    "online mba": "Scaler_Online_PGP_Business_AI.md",
    "mba":        "Scaler_Online_PGP_Business_AI.md",
    "pgp":        "Scaler_Online_PGP_Business_AI.md",
}

def _load_fact_sheet(program: str) -> str:
    key = (program or "").strip().lower()
    filename = _PROGRAM_TO_FILE.get(key)
    if filename:
        path = os.path.join(_BROCHURES_DIR, filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        except OSError:
            pass
    # fallback — return a generic note so the LLM doesn't hallucinate
    return "SCALER PROGRAM DETAILS: No brochure available for this program. Only use facts explicitly stated in the lead profile and call intelligence."

_SYSTEM_TEMPLATE = """You are generating a personalised post-call PDF for a Scaler lead.

ABSOLUTE RULES — no exceptions:
1. Only use information explicitly stated in the lead profile and call intelligence below.
2. Never infer, assume, guess, or invent ANY detail — role, company, salary, motivation, concern — unless it is directly quoted or stated.
3. If a field is "Not provided" or empty, do not fill it in. Omit that angle entirely or note it as unknown.
4. Do not use words like "likely", "probably", "seems", "may", "could be", "perhaps" — these mean you are guessing.
5. ROI numbers: only use if a salary figure was explicitly mentioned. Otherwise omit the roi_calc or write "Not discussed on call."
6. Sections must only address questions/concerns that actually came up in the call intelligence. Do not invent concerns.

PROGRAM BROCHURE — VERIFIED FACTS (use ONLY facts from this brochure; do not fabricate beyond it):
{fact_sheet}

Return ONLY valid JSON — no markdown fences, no explanation outside the JSON."""

PROMPT = """Generate a personalised PDF content structure for this lead based STRICTLY on what is provided below.

LEAD PROFILE (treat any "Not provided" field as unknown — do not fill in):
Name: {name}
Background: {background}
Intent: {intent}
Interested Program: {program}
LinkedIn: {linkedin}

EXTRACTED CALL INTELLIGENCE (the only source of truth for what was discussed):
{extracted}

Return this exact JSON structure:
{{
  "headline": "personalised headline using only real details from above — if no details exist, use their name and program only",
  "subheadline": "one sentence based only on stated background and intent — no invented context",
  "sections": [
    {{
      "title": "section title",
      "body": "2-4 sentences addressing a real question/concern from the call intelligence. If no specific concerns were raised, address the program's fit for the stated background only.",
      "evidence": "cite only facts from the SCALER FACT SHEET above — no invented alumni names, percentages, or salary data"
    }}
  ],
  "roi_calc": "ONLY include this key if a specific salary or CTC figure was explicitly mentioned on the call. If salary was never discussed, OMIT this key entirely — do not include it with null or empty values. If included, use: {{ \"current_ctc\": \"stated figure\", \"realistic_target\": \"stated or brochure-backed target\", \"reasoning\": \"one sentence connecting the two\" }}",
  "placement_stats": "ALWAYS include this key. Pull 3-5 real placement data points from the program brochure above — salary ranges, avg CTC, top companies, hike %, success stories. Format as a short paragraph. If no brochure data exists, write exactly: 'Placement data not available.'",
  "next_step": {{
    "cta": "specific next step based on what was agreed on the call — or generic if nothing agreed",
    "urgency_hook": "only use a real reason — upcoming batch date from fact sheet, or omit if none applies"
  }},
  "cover_message": "2-3 sentence WhatsApp message from BDA to lead using only their real name and stated intent — no invented personalisation"
}}

Create 3-5 sections. Base every section on actual call content. If call intelligence is sparse, fewer sections is better than invented ones."""

def generate_pdf_content(name: str, background: str, intent: str, program: str, linkedin: str, extracted: dict) -> dict:
    fact_sheet = _load_fact_sheet(program)
    system_prompt = _SYSTEM_TEMPLATE.format(fact_sheet=fact_sheet)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=2000,
        temperature=0,  # zero temperature = no creativity, no hallucination
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": PROMPT.format(
                name=name,
                background=background.strip() or "Not provided",
                intent=intent.strip() or "Not provided",
                program=program.strip() or "Not provided",
                linkedin=linkedin.strip() or "Not provided",
                extracted=json.dumps(extracted, indent=2) if extracted else "No call intelligence available"
            )}
        ]
    )
    raw = resp.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
