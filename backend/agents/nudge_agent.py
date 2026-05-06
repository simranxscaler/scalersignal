from openai import OpenAI

client = OpenAI()

SYSTEM = """You are briefing a BDA (Business Development Associate) at Scaler before they call a lead.
Write like a sharp, helpful teammate — not a corporate system.
The BDA reads this on their phone 2 minutes before dialling. Make it scannable and specific.
Be direct and honest — if something is inferred, say so. Never pad or hedge."""

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
1-2 sentences max. Who is this person in plain English — their role, level, company type. Include their likely persona (e.g. "mid-level SWE at a Series B, probably hitting a ceiling") and why you think that.

🎯 *Why they're here (real reason)*
Not the surface reason. What's the underlying push — stagnation, money gap, layoff fear, peer pressure, career pivot? Be specific to what you know about them.

💬 *Open with this*
One complete, ready-to-say opening line. NOT "hi how are you." Something that shows you know them — references their background, role, or a specific detail. The BDA should be able to read this verbatim.
Example format: "Hey {name}, I saw you've been at [X] for a few years doing [Y] — curious what's prompting you to explore Scaler right now?"

⚡ *Angles that'll land*
2-3 bullets. Each must be tied to something specific about this lead — not generic Scaler talking points. Format each as: what to say → why it resonates for them.
- e.g. "AI Engineering track → they're a backend dev, AI upskilling is the obvious next move for their profile"

🛡 *Objections to expect*
2-3 bullets. Lead with the most likely objection first. Each must have a one-line handle — a real answer, not a deflection.
- e.g. "₹3.5L is too much → ask what their current CTC is, then frame it as 1 salary month to change their trajectory"
- e.g. "Already studying on my own → ask when they last cleared a FAANG-style round, pivot to structured prep vs self-study"

⚠️ *Gaps / watch out*
One honest line on what's inferred vs confirmed, and any red flags (e.g. "LinkedIn shows job hop every 8 months — may be browsing not serious").

Keep the whole thing under 250 words. No corporate language. Write for someone reading on a phone."""

def generate_nudge(name: str, background: str, intent: str, program: str, linkedin: str, extracted: dict) -> str:
    import json
    resp = client.chat.completions.create(
        model="gpt-4o",
        max_tokens=800,
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
    return resp.choices[0].message.content
