import os
import httpx

SUPABASE_URL = os.environ.get('SUPABASE_URL') or os.environ.get('VITE_SUPABASE_URL', '')
# Prefer service role key (bypasses RLS); fall back to anon key
SUPABASE_KEY = (
    os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or
    os.environ.get('SUPABASE_ANON_KEY') or
    os.environ.get('VITE_SUPABASE_ANON_KEY', '')
)

def _headers():
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }

def insert_lead(data: dict) -> dict:
    r = httpx.post(f"{SUPABASE_URL}/rest/v1/leads", json=data, headers=_headers())
    r.raise_for_status()
    return r.json()[0]

def update_lead(lead_id: str, data: dict):
    r = httpx.patch(
        f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}",
        json=data,
        headers=_headers()
    )
    r.raise_for_status()

def insert_nudge(data: dict) -> dict:
    r = httpx.post(f"{SUPABASE_URL}/rest/v1/nudges", json=data, headers=_headers())
    r.raise_for_status()
    return r.json()[0]

def insert_pdf(data: dict) -> dict:
    r = httpx.post(f"{SUPABASE_URL}/rest/v1/pdfs", json=data, headers=_headers())
    r.raise_for_status()
    return r.json()[0]

def update_pdf_status(pdf_id: str, status: str):
    r = httpx.patch(
        f"{SUPABASE_URL}/rest/v1/pdfs?id=eq.{pdf_id}",
        json={"status": status},
        headers=_headers()
    )
    r.raise_for_status()

def get_pdf(pdf_id: str) -> dict:
    r = httpx.get(
        f"{SUPABASE_URL}/rest/v1/pdfs?id=eq.{pdf_id}",
        headers=_headers()
    )
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def insert_transcript_chunks(lead_id: str, chunks: list[str], embeddings: list[list[float]]):
    rows = [
        {
            "lead_id": lead_id,
            "chunk_index": i,
            "chunk_text": chunk,
            "embedding": embedding
        }
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]
    r = httpx.post(
        f"{SUPABASE_URL}/rest/v1/transcript_chunks",
        json=rows,
        headers=_headers()
    )
    r.raise_for_status()


def search_chunks(query_embedding: list[float], limit: int = 5) -> list[dict]:
    r = httpx.post(
        f"{SUPABASE_URL}/rest/v1/rpc/match_transcript_chunks",
        json={
            "query_embedding": query_embedding,
            "match_count": limit
        },
        headers=_headers()
    )
    r.raise_for_status()
    return r.json()


def get_bda_phone(bda_email: str) -> str | None:
    """Retrieve stored WhatsApp phone for a BDA."""
    r = httpx.get(
        f"{SUPABASE_URL}/rest/v1/bdas?email=eq.{bda_email}&select=whatsapp_phone",
        headers=_headers()
    )
    rows = r.json() if r.status_code == 200 else []
    if rows:
        return rows[0].get("whatsapp_phone") or None
    return None


def upsert_bda_phone(bda_email: str, phone: str):
    """Store or update the BDA's WhatsApp phone number."""
    import urllib.parse
    encoded = urllib.parse.quote(bda_email)
    # Try update first
    r = httpx.patch(
        f"{SUPABASE_URL}/rest/v1/bdas?email=eq.{encoded}",
        json={"whatsapp_phone": phone},
        headers={**_headers(), "Prefer": "return=representation"}
    )
    r.raise_for_status()
    # If no row was updated, insert a new one
    if not r.json():
        r2 = httpx.post(
            f"{SUPABASE_URL}/rest/v1/bdas",
            json={"email": bda_email, "whatsapp_phone": phone},
            headers=_headers()
        )
        r2.raise_for_status()
