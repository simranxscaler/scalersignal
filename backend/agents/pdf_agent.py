import json
from openai import OpenAI

client = OpenAI()

SCALER_FACT_SHEET = """
SCALER PROGRAMS — VERIFIED FACTS ONLY (do not fabricate beyond this):

Scaler Academy (Flagship)
- Duration: 12 months, part-time
- Price: ~₹3.5L (EMI options available, ISA available for eligible candidates)
- Target: 0–7 YoE software engineers
- Curriculum areas: DSA, system design, LLD/HLD, backend engineering, AI/ML fundamentals
- AI Engineering track covers: ML foundations, deep learning, LLMs, RAG systems, agents, evals, production deployment
- Teaching: live classes, 1:1 mentorship with working engineers, peer cohorts
- Outcomes: alumni at Google, Amazon, Flipkart, Meesho, Razorpay, PhonePe, startups
- Placement support: resume prep, mock interviews, company referrals, 900+ hiring partners
- Entrance test: required before enrolment — assesses problem-solving aptitude, not prior knowledge
- Entrance test prep resources are provided to candidates
- Financing: EMI from ₹8,000–12,000/month, ISA (pay after placement) for qualifying candidates

Scaler Data Science & ML
- Duration: 12+ months
- Focus: Python, statistics, ML, deep learning, NLP, MLOps

Scaler DevOps & Cloud
- Duration: 9 months
- Focus: Linux, Docker, Kubernetes, CI/CD, AWS/GCP

IMPORTANT: For any specific salary data, alumni names, or curriculum module details not listed above,
say "I can confirm this with data — let me follow up" rather than fabricating.
"""

SYSTEM = f"""You are generating a personalised post-call PDF for a Scaler lead.

ABSOLUTE RULES — no exceptions:
1. Only use information explicitly stated in the lead profile and call intelligence below.
2. Never infer, assume, guess, or invent ANY detail — role, company, salary, motivation, concern — unless it is directly quoted or stated.
3. If a field is "Not provided" or empty, do not fill it in. Omit that angle entirely or note it as unknown.
4. Do not use words like "likely", "probably", "seems", "may", "could be", "perhaps" — these mean you are guessing.
5. ROI numbers: only use if a salary figure was explicitly mentioned. Otherwise omit the roi_calc or write "Not discussed on call."
6. Sections must only address questions/concerns that actually came up in the call intelligence. Do not invent concerns.

{SCALER_FACT_SHEET}

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
  "roi_calc": {{
    "current_ctc": "only if explicitly mentioned on call — otherwise: 'Not discussed'",
    "realistic_target": "only if explicitly mentioned on call — otherwise: 'Not discussed'",
    "reasoning": "only include if salary was discussed — otherwise omit this field entirely"
  }},
  "next_step": {{
    "cta": "specific next step based on what was agreed on the call — or generic if nothing agreed",
    "urgency_hook": "only use a real reason — upcoming batch date from fact sheet, or omit if none applies"
  }},
  "cover_message": "2-3 sentence WhatsApp message from BDA to lead using only their real name and stated intent — no invented personalisation"
}}

Create 3-5 sections. Base every section on actual call content. If call intelligence is sparse, fewer sections is better than invented ones."""

def generate_pdf_content(name: str, background: str, intent: str, program: str, linkedin: str, extracted: dict) -> dict:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=2000,
        temperature=0,  # zero temperature = no creativity, no hallucination
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM},
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
