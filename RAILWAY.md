# Railway Deployment Guide (Backend)

This project deploys the **FastAPI backend** from the `backend/` folder to Railway.

## What is deployed

- Service: `scalersignal`
- Platform: Railway
- Public URL: `https://scalersignal-production.up.railway.app`
- Health check: `GET /health`

## Prerequisites

- Railway CLI installed: `railway --version`
- Logged in: `railway whoami`
- Repo cloned locally

## Important path rule (critical)

Railway service is configured with root directory = `backend`.

That means:
- Run deploy commands from **repo root**:  
  `/Users/shan/Scaler AI Agent x Sales`
- Do **not** run deploy from inside `backend/` when `root_dir=backend`.

If you deploy from inside `backend/`, Railway can fail with:
- `failed to read Dockerfile at 'backend/Dockerfile'`

## One-time linking

From repo root:

```bash
railway link
```

Select:
- Workspace: `simranxscaler's Projects`
- Project: `independent-vision`
- Environment: `production`
- Service: `scalersignal`

## Deploy backend

From repo root:

```bash
railway up --detach
```

## Verify deployment

Check status:

```bash
railway status
```

Check build logs:

```bash
railway logs --build -n 200
```

Check runtime logs:

```bash
railway logs -n 120
```

Health check:

```bash
curl -sS https://scalersignal-production.up.railway.app/health
```

Expected:

```json
{"status":"ok"}
```

## Environment variables required on Railway

Set in Railway service variables:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`)
- `GAS_URL`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`

## Frontend API wiring

Frontend should call Railway backend:

`frontend/.env`

```env
VITE_API_URL=https://scalersignal-production.up.railway.app
```

Then rebuild + redeploy frontend hosting.

## Troubleshooting

### Build says Dockerfile not found

Cause:
- Running deploy from wrong directory with `root_dir=backend`.

Fix:
- Run `railway up --detach` from repo root only.

### Latest deployment failed but app still works

Railway can keep the previous healthy release running.

Check:
- `railway status`
- `railway logs --build -n 200`

Trigger a fresh deploy from repo root if needed.

