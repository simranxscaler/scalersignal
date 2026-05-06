import os
from twilio.rest import Client

def _client():
    return Client(os.environ['TWILIO_ACCOUNT_SID'], os.environ['TWILIO_AUTH_TOKEN'])

def _from():
    return f"whatsapp:{os.environ['TWILIO_WHATSAPP_FROM']}"

def _normalize(phone: str) -> str:
    """Ensure phone has +91 country code. Always adds +91 for 10-digit Indian numbers."""
    p = phone.strip().replace(" ", "").replace("-", "").replace("+", "")
    if p.startswith("91") and len(p) == 12:
        return f"+{p}"
    if len(p) == 10:
        return f"+91{p}"
    return f"+{p}"

def send_text(to_phone: str, message: str):
    client = _client()
    client.messages.create(
        from_=_from(),
        to=f"whatsapp:{_normalize(to_phone)}",
        body=message
    )

def send_pdf(to_phone: str, message: str, pdf_url: str):
    client = _client()
    client.messages.create(
        from_=_from(),
        to=f"whatsapp:{_normalize(to_phone)}",
        body=message,
        media_url=[pdf_url]
    )
