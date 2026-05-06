-- Run this in Supabase SQL Editor

-- Enable pgvector
create extension if not exists vector;

-- BDAs table
create table if not exists bdas (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  photo_url text,
  whatsapp_phone text,
  created_at timestamptz default now(),
  last_login timestamptz default now()
);

-- Leads table
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  background text,
  intent text,
  program text,
  linkedin_url text,
  linkedin_summary text,
  linkedin_headline text,
  linkedin_institution text,
  linkedin_experiences jsonb,
  linkedin_education jsonb,
  linkedin_skills jsonb,
  transcript text,
  bda_email text,
  call_status text not null default 'pending_call',
  call_scheduled_at timestamptz,
  nudge_scheduled_sent boolean not null default false,
  created_at timestamptz default now()
);

-- Add missing columns if leads table already exists
alter table leads add column if not exists program text;
alter table leads add column if not exists transcript text;
alter table leads add column if not exists linkedin_url text;
alter table leads add column if not exists linkedin_headline text;
alter table leads add column if not exists linkedin_institution text;
alter table leads add column if not exists linkedin_experiences jsonb;
alter table leads add column if not exists linkedin_education jsonb;
alter table leads add column if not exists linkedin_skills jsonb;
alter table leads add column if not exists call_status text default 'pending_call';
alter table leads add column if not exists call_scheduled_at timestamptz;
alter table leads add column if not exists nudge_scheduled_sent boolean default false;
alter table bdas add column if not exists whatsapp_phone text;

-- Nudges table
create table if not exists nudges (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  content text not null,
  sent_at timestamptz default now()
);

-- PDFs table
create table if not exists pdfs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  pdf_url text not null,
  cover_message text,
  status text not null default 'pending_approval',
  created_at timestamptz default now(),
  sent_at timestamptz
);

-- Transcript chunks for semantic search
create table if not exists transcript_chunks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Vector search index
create index if not exists transcript_chunks_embedding_idx
  on transcript_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Semantic search function
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
  select tc.id, tc.lead_id, tc.chunk_index, tc.chunk_text,
    1 - (tc.embedding <=> query_embedding) as similarity
  from transcript_chunks tc
  where tc.embedding is not null
  order by tc.embedding <=> query_embedding
  limit match_count;
$$;

-- Disable RLS (auth handled by Firebase in backend)
alter table bdas disable row level security;
alter table leads disable row level security;
alter table nudges disable row level security;
alter table pdfs disable row level security;
alter table transcript_chunks disable row level security;
