from openai import OpenAI

client = OpenAI()

SYSTEM = """You are briefing a BDA (Business Development Associate) at Scaler before they call a lead.
Write like a sharp, helpful teammate — not a corporate system.
The BDA reads this on their phone 2 minutes before dialling. Make it scannable and specific.
CRITICAL: Only use information explicitly provided. Do NOT infer, assume, or invent details about
the lead's company, role, situation, or motivations if they are not stated. If a section cannot
be filled with real data, write "Not enough info — ask during the call." Never hallucinate."""

PROMPT = """Write a pre-call WhatsApp nudge for the BDA about to call this lead.

LEAD PROFILE:
Name: {name}
Background: {background}
Intent: {intent}
Interested Program: {program}
LinkedIn: {linkedin}

CALL INTELLIGENCE:
{extracted}

FORMAT — use these exact emoji/section headers, keep each section tight:

👤 *Who they are*
1-2 sentences using ONLY what's provided above. If background is empty, say "Background not filled in — confirm during call."

🎯 *Why they're here (real reason)*
Based ONLY on what's stated in intent/background. If intent is empty, say "Intent unknown — ask early."

💬 *Open with this*
One ready-to-say opening line referencing a REAL detail from their profile. If no details exist, give a generic but natural opener.

⚡ *Angles that'll land*
2-3 bullets tied to ACTUAL details provided. Skip or mark as "generic" if no specific info available.

🛡 *Objections to expect*
2-3 likely objections based on their profile. If profile is thin, list common objections for a cold lead.

⚠️ *Gaps / watch out*
Flag clearly what information is MISSING (background, intent, LinkedIn etc.) that the BDA needs to uncover.

Keep the whole thing under 250 words. No corporate language. Write for someone reading on a phone."""

def generate_nudge(name: str, background: str, intent: str, program: str, linkedin: str, extracted: dict) -> str:
    import json
    has_profile = any([background.strip(), intent.strip(), linkedin.strip()])
    if not has_profile:
        return (
            f"👤 *Who they are*\nBackground not provided — confirm name, role, and company at the start of the call.\n\n"
            f"🎯 *Why they're here (real reason)*\nIntent unknown — ask early: \"What made you reach out to Scaler right now?\"\n\n"
            f"💬 *Open with this*\n\"Hey {name}, thanks for connecting! To make this call useful for you — can you tell me a bit about your current role and what you're looking to achieve?\"\n\n"
            f"⚡ *Angles that'll land*\n- Once you know their background, pitch the relevant program\n- Emphasise cohort quality and placement network\n- Real projects and mentor access\n\n"
            f"🛡 *Objections to expect*\n- \"I need to think about it\" → Ask what specifically is unclear\n- \"It's expensive\" → Frame as investment vs. current trajectory\n- \"I'm already learning online\" → Ask what's missing from self-study\n\n"
            f"⚠️ *Gaps / watch out*\nNo background, intent, or LinkedIn provided. First 2 minutes of the call should be discovery — don't pitch until you know their situation."
        )

    resp = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=800,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": PROMPT.format(
                name=name,
                background=background or "Not provided",
                intent=intent or "Not provided",
                program=program or "Not specified",
                linkedin=linkedin or "Not provided",
                extracted=json.dumps(extracted, indent=2)
            )}
        ]
    )
    return resp.choices[0].message.content
