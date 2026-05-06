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
The PDF must directly address THIS lead's specific questions and situation.
It must read visibly differently from any other lead's PDF.

{SCALER_FACT_SHEET}

Return ONLY valid JSON — no markdown fences, no explanation outside the JSON."""

PROMPT = """Generate a personalised PDF content structure for this lead.

LEAD PROFILE:
Name: {name}
Background: {background}
Intent: {intent}
Interested Program: {program}
LinkedIn: {linkedin}

EXTRACTED CALL INTELLIGENCE:
{extracted}

Return this exact JSON structure:
{{
  "headline": "a personalised headline that could only be for this specific person",
  "subheadline": "one sentence that captures their specific situation and what this PDF addresses",
  "sections": [
    {{
      "title": "section title",
      "body": "2-4 sentences addressing this lead's specific question/concern with real evidence",
      "evidence": "specific data point, alumni example, or curriculum detail that backs this up — or state what you'd confirm"
    }}
  ],
  "roi_calc": {{
    "current_ctc": "inferred from background",
    "realistic_target": "based on persona and program",
    "reasoning": "2-3 sentences of honest ROI reasoning for this specific person"
  }},
  "next_step": {{
    "cta": "personalised call-to-action — not generic",
    "urgency_hook": "honest, specific reason to act now — not fake urgency"
  }},
  "cover_message": "short WhatsApp message (2-3 sentences) from BDA to lead, personalised, conversational — this is what the BDA sends WITH the PDF"
}}

Create 3-5 sections. Each section must address a real question or concern from the extracted data.
The headline must be something that would make this specific lead stop scrolling."""

def generate_pdf_content(name: str, background: str, intent: str, program: str, linkedin: str, extracted: dict) -> dict:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=2000,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": PROMPT.format(
                name=name,
                background=background,
                intent=intent,
                program=program or "Not specified",
                linkedin=linkedin or "Not provided",
                extracted=json.dumps(extracted, indent=2)
            )}
        ]
    )
    raw = resp.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
