-- Mission Control 0.5.14 — Android Morning Briefing
-- Run this in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.morning_briefings (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  text text not null,
  alarm_time text not null default '07:00',
  ringtone_url text,
  status text not null default 'draft',
  source text,
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.morning_briefings enable row level security;

-- No public policies are required for this first version.
-- The Vercel API route uses SUPABASE_SERVICE_ROLE_KEY on the server only.
-- Do NOT expose SUPABASE_SERVICE_ROLE_KEY in the browser.

create index if not exists morning_briefings_date_idx on public.morning_briefings (date desc);
