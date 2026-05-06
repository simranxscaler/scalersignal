# Scaler AI Agent × Sales

## What I built

An AI agent that supercharges two BDA moments across a two-step flow. **Step 1 — lead created:** the BDA fills in the lead's profile and the agent immediately sends a scannable pre-call WhatsApp nudge (who they are, angles that'll land, objections to expect) — no transcript needed yet, no approval gate. **Step 2 — call marked complete:** the BDA uploads the transcript or audio recording; the agent transcribes (Whisper small), extracts open questions and objections via GPT-4o-mini, generates a personalised PDF via Claude Sonnet, builds it with reportlab, uploads to Google Drive, and queues it for BDA Approve / Edit / Skip before anything reaches the lead. Nothing lead-facing fires automatically.

---

## One failure I found

**Input:** Karthik Iyer (Google SWE, 9 YoE) — the PDF's ROI section converged toward generic "salary jump" framing that doesn't land for someone already at Google. The agent inferred a ₹40–60L target which felt patronising. The prompt needs a persona guard: when `persona_type = senior_explorer`, shift the ROI frame from salary to learning ROI and peer cohort quality.

---

## Scale plan

At 100k leads/month, Whisper blocks first — it's synchronous on a single Cloud Run instance. Replace with AssemblyAI or Deepgram for async transcription at scale. PDF generation (reportlab + Claude Sonnet) moves to a Cloud Tasks worker queue so the API stays non-blocking; at ~₹3.5k/month LLM cost at full volume, add archetype caching — most leads map to 5–6 patterns, generate base PDFs per archetype and personalise only the dynamic sections with Haiku. Twilio sandbox can't broadcast; switch to Gupshup or Twilio Business API.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + Tailwind → Firebase Hosting |
| Backend | FastAPI (Python) → Cloud Run |
| LLM | Claude Sonnet (nudge + PDF) + GPT-4o-mini (extraction) |
| Transcription | faster-whisper small (local, int8) |
| PDF | reportlab (server-side) |
| Storage | Google Drive via GAS |
| DB | Supabase |
| WhatsApp | Twilio WhatsApp Sandbox |

---

## Setup

### 1. Supabase
Run `backend/supabase_schema.sql` in your Supabase SQL editor.

### 2. GAS
- Open `gas/Code.gs` in Google Apps Script
- Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ROOT_FOLDER_ID`
- Deploy as web app → copy URL

### 3. Backend
```bash
cd backend
cp .env.example .env
# fill in all keys
pip install -r requirements.txt
uvicorn main:app --reload
```

### 4. Frontend
```bash
cd frontend
cp .env.example .env.local
# set VITE_API_URL to your backend URL
npm install
npm run dev
```

### 5. Deploy

**Backend → Cloud Run:**
```bash
cd backend
gcloud run deploy scaler-ai-agent --source . --region asia-south1 --allow-unauthenticated
```

**Frontend → Firebase Hosting:**
```bash
cd frontend
npm run build
firebase deploy --only hosting
```

### 6. Twilio WhatsApp Sandbox
- Go to Twilio Console → Messaging → Try it out → Send a WhatsApp message
- Evaluator's phone opts in by sending the sandbox keyword to +14155238886
- Add sandbox number to `.env` as `TWILIO_WHATSAPP_FROM`
