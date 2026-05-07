# Scaler AI Agent × Sales

A BDA workspace that turns lead creation and post-call moments into automated AI workflows — pre-call briefings, call intelligence extraction, personalised PDF generation, and WhatsApp delivery, all with a human approval gate before anything reaches the lead.

---

## What I built

Two trigger points, one continuous flow:

**Trigger 1 — Lead created**
BDA fills in the lead's profile (name, phone, background, intent, program, LinkedIn URL). The agent immediately scrapes LinkedIn, generates a scannable pre-call WhatsApp nudge (who they are, angles that'll land, objections to expect), and fires it to the BDA's phone. Nothing goes to the lead yet.

**Trigger 2 — Call marked complete**
BDA uploads the audio file or pastes the transcript. The agent:
1. Transcribes audio via Whisper
2. Verifies it's a Scaler sales call (aborts if not)
3. Diarizes speakers (BDA vs lead) via GPT-4o-mini
4. Extracts objections, intent signals, sentiment score, persona type via GPT-4o-mini
5. Generates a personalised PDF (headline, sections, ROI, placement stats, CTA) via GPT-4o-mini using the call intelligence + program brochure as grounding
6. Builds the PDF with ReportLab in Scaler brand colors
7. Uploads to Google Drive via Google Apps Script
8. Queues it in the BDA's Approval Inbox

BDA reviews the PDF, edits the cover message if needed, and clicks Approve. Only then does the PDF reach the lead over WhatsApp.

**Scheduled nudge**
If the BDA schedules a call time, the agent fires a 1-hour reminder nudge to the BDA's WhatsApp automatically.

---

## Flow

```
Lead Created
     │
     ├─► LinkedIn scrape (non-blocking)
     ├─► Nudge generated (GPT-4o, temp=0)
     └─► Nudge → BDA WhatsApp (Twilio)

[If call scheduled]
     └─► 1-hr before: reminder nudge → BDA WhatsApp (cron, every 60s)

Call Marked Complete
     │
     ├─► Audio? → Whisper transcription
     ├─► Verify: is this a Scaler call? (GPT-4o-mini) → abort if not
     ├─► Diarize speakers: BDA / <LeadName> (GPT-4o-mini)
     ├─► Extract: objections, intent signals, sentiment 0–10, persona type (GPT-4o-mini)
     ├─► Generate PDF content from profile + call data + brochure (GPT-4o-mini)
     ├─► Build PDF bytes (ReportLab)
     ├─► Upload to Google Drive (Google Apps Script)
     ├─► Save to Supabase: pdfs (pending_approval), leads (call_completed)
     └─► Background: chunk + embed transcript (text-embedding-3-small) for search

BDA Approval Inbox
     │
     ├─► Preview PDF iframe
     ├─► Edit cover message
     ├─► Approve → PDF + message → Lead WhatsApp (Twilio)
     └─► Skip → status: skipped
```

---

## Screens

| Route | What it does |
|---|---|
| `/` | Landing page |
| `/app/dashboard` | Lead queue — table with status filters, stats, schedule call time |
| `/app/new` | New lead form — name, phone, background, intent, program, LinkedIn |
| `/app/approvals` | Approval inbox — PDF preview, editable message, Approve / Skip |

**Lead drawer** (opens from dashboard row): full profile, LinkedIn data, nudge history, diarized transcript, sentiment score, call quality.

**Mark Call Done modal**: upload audio or paste transcript → live processing steps → PDF preview → inline approval.

---

## AI agents

### Nudge agent
- **Model:** GPT-4o, temperature=0
- **Input:** Name, background, intent, program, LinkedIn summary
- **Output:** ~200-word WhatsApp-formatted briefing
- **Sections:** Who they are · Why they're here · Open with this · What to pitch · Likely objections · What you don't know yet
- **Constraint:** If a field is missing, says "ask during call" — never invents details

### Extractor agent
- **Model:** GPT-4o-mini, temperature=0
- **Input:** Diarized transcript
- **Output:**
  ```json
  {
    "open_questions": ["verbatim questions the lead asked"],
    "objections": [{ "objection": "...", "intensity": "high|medium|low" }],
    "intent_signals": ["direct quotes showing interest"],
    "emotional_state": "observable tone description",
    "persona_type": "career_switcher|senior_explorer|fresher_anxious|re_activation",
    "key_context": "facts explicitly stated in call",
    "sentiment_score": 0-10,
    "sentiment_label": "Cold|Warm|Hot",
    "call_quality": "good|average|poor"
  }
  ```
- **Constraint:** Extracts only what was explicitly said — no inference

### PDF agent
- **Model:** GPT-4o-mini, temperature=0
- **Input:** Lead profile + extractor output + program brochure (Markdown)
- **Output:**
  ```json
  {
    "headline": "personalised headline",
    "subheadline": "one sentence from background/intent",
    "sections": [{ "title": "...", "body": "...", "evidence": "brochure facts only" }],
    "roi_calc": { "current_ctc": "...", "realistic_target": "...", "reasoning": "..." },
    "placement_stats": "3–5 real stats from brochure",
    "next_step": { "cta": "...", "urgency_hook": "..." },
    "cover_message": "2–3 sentence WhatsApp message"
  }
  ```
- **Constraints:** `roi_calc` omitted entirely if salary wasn't discussed; 3–5 sections max; only brochure facts as evidence; never invents placement numbers

---

## One failure I found

**Input:** Karthik Iyer (Google SWE, 9 YoE) — the PDF's ROI section converged toward generic "salary jump" framing that doesn't land for someone already at Google. The agent inferred a ₹40–60L target which felt patronising. The prompt needs a persona guard: when `persona_type = senior_explorer`, shift the ROI frame from salary to learning ROI and peer cohort quality.

---

## Scale plan

At 100k leads/month, Whisper blocks first — it's synchronous on a single Railway instance. Replace with AssemblyAI or Deepgram for async transcription. PDF generation (ReportLab + GPT-4o-mini) moves to a worker queue so the API stays non-blocking. At ~₹3.5k/month LLM cost at full volume, add archetype caching — most leads map to 5–6 persona patterns; generate base PDFs per archetype and personalise only the dynamic sections with Haiku. Twilio Sandbox can't broadcast; switch to Gupshup or Twilio Business API.

---

## Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build Tool | Vite 5 |
| Routing | React Router DOM 6 |
| Styling | Tailwind CSS 3 |
| HTTP Client | Axios |
| Icons | Lucide React |
| Auth Client | Firebase JS SDK 10 |

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI (Python 3.11) |
| ASGI Server | Uvicorn |
| Browser Automation | Playwright (LinkedIn scraping) |
| HTML Parsing | BeautifulSoup4 + lxml |
| PDF Generation | ReportLab |
| HTTP Client | httpx (async) |
| Config | python-dotenv, Pydantic |

### AI / ML
| Service | Use |
|---|---|
| OpenAI GPT-4o | Nudge generation |
| OpenAI GPT-4o-mini | Diarization, extraction, PDF content generation |
| OpenAI Whisper (`whisper-1`) | Audio transcription |
| OpenAI `text-embedding-3-small` | Transcript chunking + semantic search (pgvector) |

### Data & Storage
| Service | Use |
|---|---|
| Supabase (PostgreSQL + pgvector) | Leads, nudges, PDFs, transcripts, embeddings |
| Google Drive | PDF file storage via Google Apps Script |

### Communication & Auth
| Service | Use |
|---|---|
| Twilio WhatsApp | Nudges to BDA, PDFs to lead |
| Firebase Auth | Google OAuth for BDA login |
| Firebase Admin SDK | Backend ID token verification |

### Infrastructure
| Layer | Technology |
|---|---|
| Backend | Railway |
| Frontend | Firebase Hosting |
| Containerization | Docker (Python 3.11-slim + ffmpeg + Chromium) |

### External Integrations
- **LinkedIn** — Playwright headless scrape with saved session cookies
- **Google Apps Script** — serverless PDF upload handler for Google Drive

---

## Data model

**bdas** — `id`, `email`, `name`, `photo_url`, `whatsapp_phone`, `last_login`

**leads** — `id`, `name`, `phone`, `background`, `intent`, `program`, `linkedin_url`, `linkedin_summary`, `linkedin_experiences (JSONB)`, `linkedin_education (JSONB)`, `linkedin_skills (JSONB)`, `transcript`, `transcript_diarized`, `call_status (pending_call|call_completed)`, `call_scheduled_at`, `nudge_scheduled_sent`, `bda_email`

**nudges** — `id`, `lead_id`, `content`, `sent_at`

**pdfs** — `id`, `lead_id`, `pdf_url`, `pdf_download_url`, `cover_message`, `status (pending_approval|sent|skipped)`, `created_at`, `sent_at`

**transcript_chunks** — `id`, `lead_id`, `chunk_index`, `chunk_text`, `embedding (vector 1536)` — IVFFlat index for cosine similarity search

---

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/leads` | Create lead + send pre-call nudge |
| GET | `/api/bda/leads` | Fetch all leads for logged-in BDA |
| PATCH | `/api/leads/{id}/schedule` | Set/update call time |
| PATCH | `/api/leads/{id}/program` | Update program |
| PATCH | `/api/leads/{id}/phone` | Update lead phone |
| POST | `/api/leads/{id}/complete-call` | Process call: transcribe → extract → generate PDF |
| POST | `/api/approve` | Approve or skip PDF, send to lead |
| GET | `/api/leads/{id}/pdf` | Get latest PDF for lead |
| POST | `/api/leads/{id}/resend-pdf` | Resend PDF with edited message |
| GET | `/api/bda/pending-pdfs` | Approval inbox for BDA |
| POST | `/api/bda/register` | Register/update BDA on login |
| POST | `/api/bda/setup-phone` | Store BDA WhatsApp number |
| POST | `/api/scrape-linkedin` | Scrape LinkedIn profile |
| GET | `/api/search` | Semantic search across transcripts |
| POST | `/api/cron/nudges` | Fire scheduled 1-hour reminder nudges (cron, every 60s) |

---

## Setup

### 1. Supabase
Run `backend/supabase_schema.sql` in your Supabase SQL editor.

### 2. Google Apps Script
- Open `gas/Code.gs` in Google Apps Script
- Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ROOT_FOLDER_ID`
- Deploy as web app → copy the deployment URL

### 3. LinkedIn cookies
```bash
cd backend
python scripts/linkedin_login.py
# Follow prompts → saves LINKEDIN_COOKIES to .env
```

### 4. Backend
```bash
cd backend
cp .env.example .env
# Fill in all keys (see .env.example)
pip install -r requirements.txt
uvicorn main:app --reload
```

### 5. Frontend
```bash
cd frontend
cp .env.example .env.local
# Set VITE_API_URL to your backend URL
npm install
npm run dev
```

### 6. Deploy

**Backend → Railway:**
```bash
# Push to Railway via CLI or connect repo in Railway dashboard
# Docker build runs automatically
```

**Frontend → Firebase Hosting:**
```bash
cd frontend
npm run build
firebase deploy --only hosting
```

### 7. Twilio WhatsApp Sandbox
- Twilio Console → Messaging → Try it out → Send a WhatsApp message
- BDA opts in by sending the sandbox keyword to +14155238886
- Set `TWILIO_WHATSAPP_FROM` in `.env`

### 8. Scheduled nudges
Enable pg_cron in Supabase or set a Railway cron job to POST `/api/cron/nudges` every minute.
