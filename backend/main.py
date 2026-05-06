import os
import httpx
import asyncio
import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

load_dotenv()

from agents.extractor import extract
from agents.nudge_agent import generate_nudge
from agents.pdf_agent import generate_pdf_content
from services.pdf_svc import build_pdf
from services.whatsapp_svc import send_text, send_pdf
from services.supabase_svc import (
    insert_lead, update_lead, insert_nudge, insert_pdf,
    update_pdf_status, get_pdf, insert_transcript_chunks, search_chunks,
    get_bda_phone, upsert_bda_phone
)
from services.embedding_svc import chunk_text, embed_chunks, embed_query
from services.linkedin_svc import scrape_profile

GAS_URL = os.environ.get('GAS_URL', '')

# Firebase Admin — for verifying BDA tokens
_fb_cert = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
if _fb_cert and not firebase_admin._apps:
    import json
    cred = credentials.Certificate(json.loads(_fb_cert))
    firebase_admin.initialize_app(cred)

app = FastAPI(title="Scaler AI Agent × Sales")


# ── Nudge firing logic (called by Supabase pg_cron via HTTP) ─────────────────

def _fire_scheduled_nudges():
    from services.supabase_svc import SUPABASE_URL, _headers
    now_utc = datetime.datetime.utcnow()
    window_start = (now_utc + datetime.timedelta(minutes=58)).strftime("%Y-%m-%dT%H:%M:%SZ")
    window_end   = (now_utc + datetime.timedelta(minutes=62)).strftime("%Y-%m-%dT%H:%M:%SZ")

    r = httpx.get(
        f"{SUPABASE_URL}/rest/v1/leads"
        f"?call_scheduled_at=gte.{window_start}"
        f"&call_scheduled_at=lte.{window_end}"
        f"&nudge_scheduled_sent=eq.false"
        f"&call_status=eq.pending_call",
        headers=_headers()
    )
    leads = r.json() if r.status_code == 200 else []

    fired = 0
    for lead in leads:
        try:
            bda_phone = get_bda_phone(lead["bda_email"])
            if not bda_phone:
                continue
            nudge_text = generate_nudge(
                lead["name"],
                lead.get("background", ""),
                lead.get("intent", ""),
                lead.get("program", ""),
                lead.get("linkedin_summary") or lead.get("linkedin_url") or "",
                {}
            )
            send_text(bda_phone, f"⏰ *1-hour reminder — {lead['name']}*\n\n{nudge_text}")
            insert_nudge({"lead_id": lead["id"], "content": nudge_text})
            httpx.patch(
                f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead['id']}",
                json={"nudge_scheduled_sent": True},
                headers=_headers()
            )
            fired += 1
        except Exception:
            pass
    return fired


async def get_bda_email(request: Request) -> str:
    """Verify Firebase ID token and return BDA email."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Missing auth token')
    token = auth_header.split(' ', 1)[1]
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded['email']
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid auth token')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── BDA register (called on every login) ────────────────────────────────────

class RegisterRequest(BaseModel):
    name: Optional[str] = None
    photo_url: Optional[str] = None

@app.post("/api/bda/register")
async def bda_register(req: RegisterRequest, request: Request):
    """Upsert BDA record on login — creates row if first time, updates last_login."""
    bda_email = await get_bda_email(request)
    from services.supabase_svc import SUPABASE_URL, _headers
    import datetime
    r = httpx.post(
        f"{SUPABASE_URL}/rest/v1/bdas",
        json={
            "email": bda_email,
            "name": req.name,
            "photo_url": req.photo_url,
            "last_login": datetime.datetime.utcnow().isoformat()
        },
        headers={**_headers(), "Prefer": "resolution=merge-duplicates,return=representation"}
    )
    return {"status": "ok"}


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── LinkedIn scrape ──────────────────────────────────────────────────────────

@app.post("/api/scrape-linkedin")
async def scrape_linkedin_endpoint(request: Request):
    body = await request.json()
    url = body.get("url", "")
    if not url or "linkedin.com/in/" not in url:
        raise HTTPException(status_code=400, detail="Provide a valid LinkedIn profile URL")
    try:
        data = await asyncio.to_thread(scrape_profile, url)
        return {"summary": data.get("raw_summary", ""), "headline": data.get("headline", "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scrape failed: {str(e)}")


# ── BDA phone setup ──────────────────────────────────────────────────────────

class PhoneSetupRequest(BaseModel):
    phone: str

@app.post("/api/bda/setup-phone")
async def setup_phone(req: PhoneSetupRequest, request: Request):
    """Store the BDA's WhatsApp number so all nudges know where to go."""
    bda_email = await get_bda_email(request)
    upsert_bda_phone(bda_email, req.phone)
    return {"status": "ok", "phone": req.phone}

@app.get("/api/bda/phone")
async def get_phone(request: Request):
    """Retrieve the stored BDA phone number."""
    bda_email = await get_bda_email(request)
    phone = get_bda_phone(bda_email)
    return {"phone": phone or ""}


# ── Schedule a call time for a lead ─────────────────────────────────────────

class ScheduleCallRequest(BaseModel):
    # ISO-8601 UTC timestamp, e.g. "2026-05-06T08:30:00Z"
    call_scheduled_at: Optional[str] = None

@app.patch("/api/leads/{lead_id}/schedule")
async def schedule_call(lead_id: str, req: ScheduleCallRequest, request: Request):
    """Save (or clear) the BDA's scheduled call time for a lead.
    Resets nudge_scheduled_sent so the 1-hour nudge can fire again if time changes."""
    bda_email = await get_bda_email(request)
    from services.supabase_svc import SUPABASE_URL, _headers

    # Verify ownership
    r = httpx.get(f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}&bda_email=eq.{bda_email}", headers=_headers())
    if not (r.status_code == 200 and r.json()):
        raise HTTPException(status_code=404, detail="Lead not found")

    update_lead(lead_id, {
        "call_scheduled_at": req.call_scheduled_at,
        "nudge_scheduled_sent": False,  # allow re-fire if time is changed
    })
    return {"status": "ok", "call_scheduled_at": req.call_scheduled_at}


# ── Step 1: Create lead + send BDA pre-call nudge ────────────────────────────

@app.post("/api/leads")
async def create_lead(
    request: Request,
    lead_name: str = Form(...),
    lead_phone: str = Form(...),
    background: str = Form(""),
    intent: str = Form(""),
    program: str = Form(""),
    linkedin: str = Form(""),
):
    """
    Create a lead and immediately send the BDA a pre-call nudge.
    No transcript needed at this point — the call hasn't happened yet.
    """
    bda_email = await get_bda_email(request)
    print(f"[create-lead] bda={bda_email} name={lead_name} phone={lead_phone} program={program}")

    # Look up BDA phone from DB
    bda_phone = get_bda_phone(bda_email)
    if not bda_phone:
        print(f"[create-lead] ERROR: no BDA phone configured for {bda_email}")
        raise HTTPException(status_code=400, detail="BDA phone not configured — complete setup first")
    print(f"[create-lead] bda_phone={bda_phone}")

    # Scrape LinkedIn if URL provided (non-blocking on failure)
    linkedin_data = {}
    linkedin_for_llm = linkedin
    if linkedin and "linkedin.com/in/" in linkedin:
        print(f"[create-lead] scraping linkedin: {linkedin}")
        try:
            linkedin_data = await asyncio.to_thread(scrape_profile, linkedin)
            if linkedin_data.get("raw_summary"):
                linkedin_for_llm = linkedin_data["raw_summary"]
            print(f"[create-lead] linkedin scraped ok, headline={linkedin_data.get('headline')}")
        except Exception as e:
            print(f"[create-lead] linkedin scrape failed (non-fatal): {e}")

    # Save lead (call_status defaults to 'pending_call')
    print(f"[create-lead] saving lead to DB")
    try:
        lead = insert_lead({
            "name": lead_name,
            "phone": lead_phone,
            "background": background,
            "intent": intent,
            "program": program or None,
            "linkedin_url": linkedin if "linkedin.com" in (linkedin or "") else None,
            "linkedin_summary": linkedin_data.get("raw_summary") or linkedin or None,
            "linkedin_headline": linkedin_data.get("headline") or None,
            "linkedin_institution": linkedin_data.get("institution") or None,
            "linkedin_experiences": linkedin_data.get("experiences") or None,
            "linkedin_education": linkedin_data.get("education") or None,
            "linkedin_skills": linkedin_data.get("skills") or None,
            "bda_email": bda_email,
        })
        lead_id = lead["id"]
        print(f"[create-lead] lead saved, id={lead_id}")
    except Exception as e:
        print(f"[create-lead] ERROR saving lead: {e}")
        raise HTTPException(status_code=500, detail=f"Lead save failed: {str(e)}")

    # Generate pre-call nudge (no transcript — use profile + LinkedIn only)
    print(f"[create-lead] generating nudge for lead_id={lead_id}")
    try:
        nudge_text = await asyncio.to_thread(
            generate_nudge, lead_name, background, intent, program, linkedin_for_llm,
            {}  # no extracted call intelligence yet
        )
        print(f"[create-lead] nudge generated, length={len(nudge_text)}")
    except Exception as e:
        print(f"[create-lead] ERROR generating nudge: {e}")
        raise HTTPException(status_code=500, detail=f"Nudge generation failed: {str(e)}")

    # Save nudge record
    try:
        insert_nudge({"lead_id": lead_id, "content": nudge_text})
        print(f"[create-lead] nudge saved to DB")
    except Exception as e:
        print(f"[create-lead] nudge DB save failed (non-fatal): {e}")

    # Send nudge to BDA immediately
    print(f"[create-lead] sending nudge to BDA whatsapp {bda_phone}")
    try:
        send_text(bda_phone, f"📋 *Pre-call brief for {lead_name}*\n\n{nudge_text}")
        print(f"[create-lead] nudge sent ok")
    except Exception as e:
        print(f"[create-lead] whatsapp send failed (non-fatal): {e}")

    return {
        "lead_id": lead_id,
        "nudge": nudge_text,
    }


# ── Step 2: Mark call complete + generate lead PDF ───────────────────────────

@app.post("/api/leads/{lead_id}/complete-call")
async def complete_call(
    lead_id: str,
    request: Request,
    transcript: str = Form(""),
    audio_file: Optional[UploadFile] = File(None),
):
    """
    Called after the BDA finishes the call.
    Accepts transcript text or audio. Generates the personalised PDF and queues it for BDA approval.
    """
    bda_email = await get_bda_email(request)
    print(f"[complete-call] lead_id={lead_id} bda={bda_email}")

    # Fetch lead from DB
    from services.supabase_svc import SUPABASE_URL, _headers
    r = httpx.get(f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}&bda_email=eq.{bda_email}", headers=_headers())
    rows = r.json()
    if not rows:
        print(f"[complete-call] ERROR: lead {lead_id} not found for bda {bda_email}")
        raise HTTPException(status_code=404, detail="Lead not found")
    lead = rows[0]
    print(f"[complete-call] lead found: name={lead['name']}")

    # Transcribe audio if provided
    if audio_file and audio_file.filename:
        print(f"[complete-call] transcribing audio: {audio_file.filename}")
        audio_bytes = await audio_file.read()
        suffix = "." + audio_file.filename.rsplit(".", 1)[-1] if "." in audio_file.filename else ".mp3"
        try:
            from services.whisper_svc import transcribe
            transcript = transcribe(audio_bytes, suffix)
            print(f"[complete-call] transcription done, length={len(transcript)}")
        except Exception as e:
            print(f"[complete-call] ERROR transcribing: {e}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    if not transcript:
        raise HTTPException(status_code=400, detail="Provide either a transcript or an audio file")

    print(f"[complete-call] transcript received, length={len(transcript)}")

    # ── Scaler call verification ─────────────────────────────────────────────
    # Check transcript is actually a Scaler sales call before doing anything
    try:
        from openai import OpenAI as _OAI
        _oai = _OAI()
        _check = _oai.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You verify whether a transcript is a Scaler EdTech sales call. Return JSON only."},
                {"role": "user", "content": f"""Does this transcript appear to be a sales/counselling call related to Scaler (an EdTech company offering programs like Academy, DSML, DevOps, MBA)?
Look for: mention of the lead's name '{lead['name']}', Scaler programs, course fees, career goals, BDA asking about background/intent.

Transcript (first 1500 chars):
{transcript[:1500]}

Return: {{"is_scaler_call": true/false, "reason": "one sentence explanation", "lead_name_found": true/false}}"""
                }
            ]
        )
        import json as _json
        _result = _json.loads(_check.choices[0].message.content)
        if not _result.get("is_scaler_call", True):
            return {
                "scaler_call": False,
                "reason": _result.get("reason", "This does not appear to be a Scaler sales call.")
            }
    except Exception:
        pass  # If check fails, proceed anyway — don't block on verification error

    # Update lead: save transcript + mark call completed
    try:
        update_lead(lead_id, {"transcript": transcript, "call_status": "call_completed"})
    except Exception:
        pass

    print(f"[complete-call] starting extraction")
    # Extract call intelligence
    try:
        extracted = extract(transcript)
        print(f"[complete-call] extraction done: {list(extracted.keys())}")
    except Exception as e:
        print(f"[complete-call] extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

    linkedin_for_llm = lead.get("linkedin_summary") or lead.get("linkedin_url") or ""

    # Generate PDF content
    print(f"[complete-call] generating PDF content for {lead['name']}")
    try:
        pdf_content = await asyncio.to_thread(
            generate_pdf_content,
            lead["name"], lead.get("background", ""), lead.get("intent", ""),
            lead.get("program", ""), linkedin_for_llm, extracted
        )
        print(f"[complete-call] PDF content generated, sections={len(pdf_content.get('sections', []))}")
    except Exception as e:
        print(f"[complete-call] ERROR generating PDF content: {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    # Build PDF bytes
    print(f"[complete-call] building PDF bytes")
    try:
        pdf_bytes = build_pdf(pdf_content, lead["name"], lead.get("program", ""))
        print(f"[complete-call] PDF built, size={len(pdf_bytes)} bytes")
    except Exception as e:
        print(f"[complete-call] ERROR building PDF: {e}")
        raise HTTPException(status_code=500, detail=f"PDF build failed: {str(e)}")

    # Upload to Google Drive via GAS
    print(f"[complete-call] uploading PDF to Google Drive via GAS")
    try:
        import base64
        pdf_b64 = base64.b64encode(pdf_bytes).decode()
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            gas_resp = await client.post(GAS_URL, json={
                "action": "upload_pdf",
                "filename": f"Scaler_{lead['name'].replace(' ', '_')}.pdf",
                "data": pdf_b64,
                "mimeType": "application/pdf",
                "lead_name": lead["name"],
                "program": lead.get("program") or "Scaler"
            })
            gas_resp.raise_for_status()
            gas_data = gas_resp.json()
            pdf_url = gas_data["fileUrl"]
            pdf_download_url = gas_data.get("downloadUrl", pdf_url)
            print(f"[complete-call] PDF uploaded to Drive: {pdf_url}")
    except Exception as e:
        print(f"[complete-call] ERROR uploading to Drive: {e}")
        raise HTTPException(status_code=500, detail=f"Drive upload failed: {str(e)}")

    # Save PDF record (pending_approval)
    cover_message = pdf_content.get("cover_message", f"Hi {lead['name']}, here's a personalised overview based on our conversation today.")
    print(f"[complete-call] saving PDF record to DB")
    try:
        pdf_record = insert_pdf({
            "lead_id": lead_id,
            "pdf_url": pdf_url,
            "pdf_download_url": pdf_download_url,
            "status": "pending_approval",
            "cover_message": cover_message
        })
        pdf_id = pdf_record["id"]
        print(f"[complete-call] PDF record saved, pdf_id={pdf_id}")
    except Exception as e:
        print(f"[complete-call] PDF DB save failed (non-fatal): {e}")
        pdf_id = "no-db"

    # Chunk + embed transcript in background
    print(f"[complete-call] chunking + embedding transcript")
    try:
        chunks = chunk_text(transcript)
        embeddings = embed_chunks(chunks)
        insert_transcript_chunks(lead_id, chunks, embeddings)
        print(f"[complete-call] embedded {len(chunks)} chunks")
    except Exception as e:
        print(f"[complete-call] embedding failed (non-fatal): {e}")

    return {
        "pdf": {
            "pdf_id": pdf_id,
            "pdf_url": pdf_url,
            "cover_message": cover_message,
            "status": "pending_approval"
        },
        "transcript": transcript,
    }


# ── Approval endpoint ────────────────────────────────────────────────────────

class ApprovalRequest(BaseModel):
    pdf_id: str
    action: str  # approve | skip
    edited_message: Optional[str] = None

@app.post("/api/approve")
async def approve(req: ApprovalRequest):
    if req.action not in ("approve", "skip"):
        raise HTTPException(status_code=400, detail="action must be approve or skip")

    pdf_record = get_pdf(req.pdf_id)
    if not pdf_record:
        raise HTTPException(status_code=404, detail="PDF record not found")

    if req.action == "skip":
        update_pdf_status(req.pdf_id, "skipped")
        return {"status": "skipped"}

    message = req.edited_message or pdf_record.get("cover_message", "")
    try:
        lead = None
        if pdf_record.get("lead_id"):
            from services.supabase_svc import SUPABASE_URL, _headers
            r = httpx.get(f"{SUPABASE_URL}/rest/v1/leads?id=eq.{pdf_record['lead_id']}", headers=_headers())
            rows = r.json()
            if rows:
                lead = rows[0]

        if lead and lead.get("phone"):
            twilio_url = pdf_record.get("pdf_download_url") or pdf_record["pdf_url"]
            print(f"[approve] sending PDF to {lead['phone']} via {twilio_url}")
            send_pdf(lead["phone"], message, twilio_url)
        else:
            raise HTTPException(status_code=400, detail="Lead phone not found — cannot send")

        update_pdf_status(req.pdf_id, "sent")
        return {"status": "sent", "pdf_url": pdf_record["pdf_url"]}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"WhatsApp send failed: {str(e)}")


# ── Resend WhatsApp ──────────────────────────────────────────────────────────

class ResendRequest(BaseModel):
    edited_message: Optional[str] = None

@app.post("/api/leads/{lead_id}/resend-pdf")
async def resend_pdf_by_lead(lead_id: str, request: Request):
    """Resend the latest PDF for a lead — convenience endpoint called from the dashboard."""
    bda_email = await get_bda_email(request)
    from services.supabase_svc import SUPABASE_URL, _headers

    # Verify lead ownership
    lr = httpx.get(f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}&bda_email=eq.{bda_email}", headers=_headers())
    leads = lr.json()
    if not leads:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead = leads[0]

    # Get latest PDF for this lead
    pr = httpx.get(f"{SUPABASE_URL}/rest/v1/pdfs?lead_id=eq.{lead_id}&order=created_at.desc&limit=1", headers=_headers())
    pdfs = pr.json()
    if not pdfs:
        raise HTTPException(status_code=404, detail="No PDF found for this lead")
    pdf_record = pdfs[0]

    print(f"[resend-by-lead] lead={lead['name']} pdf_id={pdf_record['id']}")
    try:
        twilio_url = pdf_record.get("pdf_download_url") or pdf_record["pdf_url"]
        message = pdf_record.get("cover_message", f"Hi {lead['name']}, here's your personalised Scaler overview.")
        send_pdf(lead["phone"], message, twilio_url)
        update_pdf_status(pdf_record["id"], "sent")
        print(f"[resend-by-lead] sent ok")
        return {"status": "sent"}
    except Exception as e:
        print(f"[resend-by-lead] ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Resend failed: {str(e)}")

@app.post("/api/pdfs/{pdf_id}/resend")
async def resend_pdf(pdf_id: str, req: ResendRequest, request: Request):
    """Resend the PDF to the lead's WhatsApp — useful if the first send failed."""
    bda_email = await get_bda_email(request)

    pdf_record = get_pdf(pdf_id)
    if not pdf_record:
        raise HTTPException(status_code=404, detail="PDF record not found")

    print(f"[resend] pdf_id={pdf_id} bda={bda_email}")

    message = req.edited_message or pdf_record.get("cover_message", "")
    try:
        from services.supabase_svc import SUPABASE_URL, _headers
        r = httpx.get(f"{SUPABASE_URL}/rest/v1/leads?id=eq.{pdf_record['lead_id']}", headers=_headers())
        rows = r.json()
        if not rows:
            raise HTTPException(status_code=404, detail="Lead not found")
        lead = rows[0]

        if not lead.get("phone"):
            raise HTTPException(status_code=400, detail="Lead has no phone number")

        twilio_url = pdf_record.get("pdf_download_url") or pdf_record["pdf_url"]
        print(f"[resend] sending to {lead['phone']} via {twilio_url}")
        send_pdf(lead["phone"], message, twilio_url)
        update_pdf_status(pdf_id, "sent")
        print(f"[resend] sent ok")
        return {"status": "sent", "pdf_url": pdf_record["pdf_url"]}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[resend] ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Resend failed: {str(e)}")


# ── Status ───────────────────────────────────────────────────────────────────

@app.get("/api/status/{pdf_id}")
def get_status(pdf_id: str):
    record = get_pdf(pdf_id)
    if not record:
        raise HTTPException(status_code=404, detail="Not found")
    return {"status": record["status"], "pdf_url": record.get("pdf_url")}


# ── BDA Dashboard ────────────────────────────────────────────────────────────

@app.get("/api/bda/leads")
async def bda_leads(request: Request):
    """Return all leads + their latest PDF status for the logged-in BDA."""
    bda_email = await get_bda_email(request)
    from services.supabase_svc import SUPABASE_URL, _headers

    r = httpx.get(
        f"{SUPABASE_URL}/rest/v1/leads?bda_email=eq.{bda_email}&order=created_at.desc",
        headers=_headers()
    )
    leads = r.json() if r.status_code == 200 else []

    result = []
    for lead in leads:
        pr = httpx.get(
            f"{SUPABASE_URL}/rest/v1/pdfs?lead_id=eq.{lead['id']}&order=created_at.desc&limit=1",
            headers=_headers()
        )
        pdfs = pr.json() if pr.status_code == 200 else []
        if pdfs:
            lead['pdf_status'] = pdfs[0]['status']
        else:
            # No PDF yet — use call_status as the display state
            lead['pdf_status'] = lead.get('call_status', 'pending_call')
        result.append(lead)

    return {"leads": result}


@app.get("/api/leads/{lead_id}/nudges")
async def get_lead_nudges(lead_id: str, request: Request):
    """Return all nudges sent for a lead (most recent first)."""
    bda_email = await get_bda_email(request)
    from services.supabase_svc import SUPABASE_URL, _headers
    # Verify ownership
    r = httpx.get(f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}&bda_email=eq.{bda_email}&select=id", headers=_headers())
    if not (r.status_code == 200 and r.json()):
        raise HTTPException(status_code=404, detail="Lead not found")
    nr = httpx.get(
        f"{SUPABASE_URL}/rest/v1/nudges?lead_id=eq.{lead_id}&order=sent_at.desc",
        headers=_headers()
    )
    return {"nudges": nr.json() if nr.status_code == 200 else []}


@app.get("/api/bda/pending-pdfs")
async def bda_pending_pdfs(request: Request):
    """Return all PDFs pending approval for the logged-in BDA."""
    bda_email = await get_bda_email(request)
    from services.supabase_svc import SUPABASE_URL, _headers

    lr = httpx.get(
        f"{SUPABASE_URL}/rest/v1/leads?bda_email=eq.{bda_email}&select=id,name,background",
        headers=_headers()
    )
    leads = {l['id']: l for l in (lr.json() if lr.status_code == 200 else [])}

    if not leads:
        return {"pdfs": []}

    lead_ids = ','.join(leads.keys())
    pr = httpx.get(
        f"{SUPABASE_URL}/rest/v1/pdfs?lead_id=in.({lead_ids})&status=eq.pending_approval&order=created_at.desc",
        headers=_headers()
    )
    pdfs = pr.json() if pr.status_code == 200 else []

    result = []
    for pdf in pdfs:
        lead = leads.get(pdf['lead_id'], {})
        result.append({
            "pdf_id": pdf['id'],
            "pdf_url": pdf['pdf_url'],
            "cover_message": pdf['cover_message'],
            "lead_name": lead.get('name', 'Unknown'),
            "lead_background": lead.get('background', ''),
        })

    return {"pdfs": result}


@app.get("/api/search")
async def search(q: str, limit: int = 5, request: Request = None):
    """Semantic search across all stored call transcripts."""
    if not q:
        raise HTTPException(status_code=400, detail="q is required")
    try:
        embedding = embed_query(q)
        results = search_chunks(embedding, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    from services.supabase_svc import SUPABASE_URL, _headers
    enriched = []
    lead_cache = {}
    for row in results:
        lid = row.get("lead_id")
        if lid and lid not in lead_cache:
            r = httpx.get(f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lid}&select=name,background", headers=_headers())
            leads = r.json()
            lead_cache[lid] = leads[0] if leads else {}
        lead = lead_cache.get(lid, {})
        enriched.append({
            "lead_name": lead.get("name", "Unknown"),
            "lead_background": lead.get("background", ""),
            "chunk_text": row["chunk_text"],
            "similarity": round(row["similarity"], 3)
        })
    return {"results": enriched}
