-- Scaler AI Agent × Sales — Supabase schema
-- Run this in your Supabase SQL editor

-- Enable pgvector
create extension if not exists vector;

create table if not exists bdas (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  photo_url text,
  created_at timestamptz default now(),
  last_login timestamptz default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  background text,
  intent text,
  program text check (program in ('Academy', 'DSML', 'DevOps & AI', 'Online MBA')),
  linkedin_url text,
  linkedin_summary text,       -- raw_summary flat text fed to LLM prompts
  linkedin_headline text,
  linkedin_institution text,   -- latest school
  linkedin_experiences jsonb,  -- [{title, company, start, end, description}]
  linkedin_education jsonb,    -- [{school, degree, field, start, end}]
  linkedin_skills jsonb,       -- ["Python", "ML", ...]
  transcript text,
  transcript_diarized text,    -- speaker-labelled version: "BDA: ..." / "Name: ..."
  bda_email text,              -- which BDA owns this lead
  call_status text not null default 'pending_call'
    check (call_status in ('pending_call', 'call_completed')),
  created_at timestamptz default now()
);

-- Migration: add columns if the table already exists
alter table leads add column if not exists program text;
alter table leads add column if not exists transcript text;
alter table leads add column if not exists transcript_diarized text;
alter table leads add column if not exists linkedin_url text;
alter table leads add column if not exists linkedin_headline text;
alter table leads add column if not exists linkedin_institution text;
alter table leads add column if not exists linkedin_experiences jsonb;
alter table leads add column if not exists linkedin_education jsonb;
alter table leads add column if not exists linkedin_skills jsonb;
alter table leads add column if not exists call_status text not null default 'pending_call'
  check (call_status in ('pending_call', 'call_completed'));

-- Store BDA WhatsApp number on the bdas table
alter table bdas add column if not exists whatsapp_phone text;

-- Scheduled call time (stored as UTC, displayed as IST in frontend)
alter table leads add column if not exists call_scheduled_at timestamptz;
-- Track whether the 1-hour-before nudge was already sent
alter table leads add column if not exists nudge_scheduled_sent boolean not null default false;

-- ── pg_cron: trigger Edge Function every minute to fire scheduled nudges ──
-- Run this AFTER deploying the Edge Function.
-- Replace YOUR_SUPABASE_PROJECT_REF with your actual project ref (from project URL).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'fire-scheduled-nudges',          -- job name (unique)
  '* * * * *',                      -- every minute
  $$
    select net.http_post(
      url     := 'https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/fire-nudges',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

create table if not exists transcript_chunks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Index for fast cosine similarity search
create index if not exists transcript_chunks_embedding_idx
  on transcript_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Function for semantic search
create or replace function match_transcript_chunks(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  lead_id uuid,
  chunk_index integer,
  chunk_text text,
  similarity float
)
language sql stable
as $$
  select
    tc.id,
    tc.lead_id,
    tc.chunk_index,
    tc.chunk_text,
    1 - (tc.embedding <=> query_embedding) as similarity
  from transcript_chunks tc
  where tc.embedding is not null
  order by tc.embedding <=> query_embedding
  limit match_count;
$$;

-- ── RLS: disable on all tables (auth is handled by Firebase in the backend) ──
-- Run this if you get 401 "row-level security policy" errors
alter table bdas disable row level security;
alter table leads disable row level security;
alter table nudges disable row level security;
alter table pdfs disable row level security;
alter table transcript_chunks disable row level security;

create table if not exists nudges (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  content text not null,
  sent_at timestamptz default now()
);

create table if not exists pdfs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  pdf_url text not null,
  pdf_download_url text,
  cover_message text,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'sent', 'skipped')),
  created_at timestamptz default now(),
  sent_at timestamptz
);

alter table pdfs add column if not exists pdf_download_url text;
