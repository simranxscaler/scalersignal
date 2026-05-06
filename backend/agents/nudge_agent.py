from openai import OpenAI

client = OpenAI()

SYSTEM = """You are briefing a BDA at Scaler before a sales call. Your job is to summarise what is KNOWN about the lead — nothing more.

ABSOLUTE RULES — violating any of these makes the briefing useless:
1. NEVER invent, infer, assume, or guess any detail not explicitly stated in the input.
2. If a field is "Not provided" — do not fill it in. Write exactly: "Not provided — ask during call."
3. Do not write phrases like "likely", "probably", "seems to", "may be", "perhaps", "could be" — these are assumptions. Remove them.
4. Every sentence must be traceable to a specific field in the input. If you cannot point to the source, cut it.
5. The opening line must only reference details that are explicitly in the profile. No invented details."""

PROMPT = """Write a pre-call WhatsApp briefing for the BDA about to call this lead.

LEAD PROFILE (use ONLY what is filled in below — treat "Not provided" as unknown):
Name: {name}
Background: {background}
Intent: {intent}
Interested Program: {program}
LinkedIn: {linkedin}

CALL INTELLIGENCE (from transcript, if any):
{extracted}

---

FORMAT — use these exact headers:

👤 *Who they are*
Only state what is in Background above. If "Not provided" → write: "Not provided — ask their role and company at the start of the call."

🎯 *Why they're here*
Only state what is in Intent above. If "Not provided" → write: "Not provided — ask: 'What made you reach out to Scaler right now?'"

💬 *Open with this*
Write one opening line using ONLY real details from the profile. If background and intent are both not provided, use: "Hey {name}, to make this call useful — tell me about your current role and what you're hoping to get out of Scaler."

⚡ *What to pitch*
Only if program or background is known. Otherwise: "Discover their goals first before pitching any program."

🛡 *Likely objections*
List 1-3 common objections relevant to what IS known. If profile is empty, list generic cold-lead objections only.

⚠️ *What you don't know yet*
List every field that was "Not provided" — these are gaps the BDA must uncover in the first 2 minutes.

Under 200 words total. No corporate filler."""


def generate_nudge(name: str, background: str, intent: str, program: str, linkedin: str, extracted: dict) -> str:
    import json
    resp = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=600,
        temperature=0,  # zero temperature = no creativity, no hallucination
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": PROMPT.format(
                name=name,
                background=background.strip() or "Not provided",
                intent=intent.strip() or "Not provided",
                program=program.strip() or "Not provided",
                linkedin=linkedin.strip() or "Not provided",
                extracted=json.dumps(extracted, indent=2) if extracted else "None"
            )}
        ]
    )
    return resp.choices[0].message.content
