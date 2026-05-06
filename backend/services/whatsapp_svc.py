import os
from twilio.rest import Client

def _client():
    return Client(os.environ['TWILIO_ACCOUNT_SID'], os.environ['TWILIO_AUTH_TOKEN'])

def _from():
    return f"whatsapp:{os.environ['TWILIO_WHATSAPP_FROM']}"

def send_text(to_phone: str, message: str):
    """Send a plain WhatsApp text message."""
    client = _client()
    client.messages.create(
        from_=_from(),
        to=f"whatsapp:{to_phone}",
        body=message
    )

def send_pdf(to_phone: str, message: str, pdf_url: str):
    """Send a WhatsApp message with a PDF attachment."""
    client = _client()
    client.messages.create(
        from_=_from(),
        to=f"whatsapp:{to_phone}",
        body=message,
        media_url=[pdf_url]
    )
