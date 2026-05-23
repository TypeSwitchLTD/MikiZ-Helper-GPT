-- Mission Control 0.6.0 — Cloud Sync Foundation
-- Run in Supabase SQL Editor.
-- This keeps Supabase as the cloud source of truth while the browser IndexedDB remains a local cache/backup.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.tasks (
  id text primary key,
  workspace_id text not null default 'miki',
  title text not null,
  project_id text,
  domain_id text,
  bucket text,
  task_date date,
  original_date date,
  scheduled_time_label text,
  estimated_duration_minutes integer,
  duration_label text,
  priority text,
  effort text,
  is_quick_win boolean default false,
  is_recurring boolean default false,
  recurrence_definition_id text,
  backlog_group text,
  tags jsonb not null default '[]'::jsonb,
  why_now text,
  notes text,
  status_override text,
  moved_count integer default 0,
  moved_to_date date,
  focus_order integer,
  focus_updated_at timestamptz,
  source text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subtasks (
  id text primary key,
  workspace_id text not null default 'miki',
  task_id text not null,
  title text not null,
  domain_id text,
  estimated_duration_minutes integer,
  duration_label text,
  tools_needed text,
  notes text,
  status text not null default 'not_started',
  sort_order integer default 0,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id text primary key,
  workspace_id text not null default 'miki',
  task_id text,
  subtask_id text,
  title text not null,
  note text,
  remind_at timestamptz not null,
  status text not null default 'pending',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_plans (
  id text primary key,
  workspace_id text not null default 'miki',
  plan_date date not null,
  focus_note text,
  planned_task_ids jsonb not null default '[]'::jsonb,
  blocks jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recurring_definitions (
  id text primary key,
  workspace_id text not null default 'miki',
  is_active boolean default true,
  frequency text,
  project_id text,
  domain_id text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_reports (
  id text primary key,
  workspace_id text not null default 'miki',
  report_date date,
  generated_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_logs (
  id text primary key,
  workspace_id text not null default 'miki',
  event_timestamp timestamptz not null default now(),
  type text not null,
  entity_type text,
  entity_id text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id text primary key default 'default',
  workspace_id text not null default 'miki',
  settings jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.morning_briefings (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'miki',
  date date not null,
  text text not null,
  alarm_time text default '07:00',
  ringtone_url text,
  status text default 'published',
  source text default 'mission-control',
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, date)
);

create table if not exists public.sync_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'miki',
  event_type text not null,
  source text not null default 'mission-control',
  app_version text,
  counts jsonb not null default '{}'::jsonb,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists tasks_workspace_updated_idx on public.tasks (workspace_id, updated_at desc);
create index if not exists tasks_workspace_date_idx on public.tasks (workspace_id, task_date, bucket);
create index if not exists subtasks_workspace_task_idx on public.subtasks (workspace_id, task_id, sort_order);
create index if not exists reminders_workspace_time_idx on public.reminders (workspace_id, remind_at, status);
create index if not exists daily_logs_workspace_time_idx on public.daily_logs (workspace_id, event_timestamp desc);

-- Repair for users who created the 0.5.14 table before workspace support.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'morning_briefings_workspace_date_key'
  ) then
    alter table public.morning_briefings
      add constraint morning_briefings_workspace_date_key unique (workspace_id, date);
  end if;
end $$;

create index if not exists morning_briefings_workspace_date_idx on public.morning_briefings (workspace_id, date desc);
create index if not exists sync_events_workspace_time_idx on public.sync_events (workspace_id, created_at desc);

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
drop trigger if exists set_subtasks_updated_at on public.subtasks;
create trigger set_subtasks_updated_at before update on public.subtasks for each row execute function public.set_updated_at();
drop trigger if exists set_reminders_updated_at on public.reminders;
create trigger set_reminders_updated_at before update on public.reminders for each row execute function public.set_updated_at();
drop trigger if exists set_daily_plans_updated_at on public.daily_plans;
create trigger set_daily_plans_updated_at before update on public.daily_plans for each row execute function public.set_updated_at();
drop trigger if exists set_recurring_definitions_updated_at on public.recurring_definitions;
create trigger set_recurring_definitions_updated_at before update on public.recurring_definitions for each row execute function public.set_updated_at();
drop trigger if exists set_daily_reports_updated_at on public.daily_reports;
create trigger set_daily_reports_updated_at before update on public.daily_reports for each row execute function public.set_updated_at();
drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at before update on public.app_settings for each row execute function public.set_updated_at();
drop trigger if exists set_morning_briefings_updated_at on public.morning_briefings;
create trigger set_morning_briefings_updated_at before update on public.morning_briefings for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.reminders enable row level security;
alter table public.daily_plans enable row level security;
alter table public.recurring_definitions enable row level security;
alter table public.daily_reports enable row level security;
alter table public.daily_logs enable row level security;
alter table public.app_settings enable row level security;
alter table public.morning_briefings enable row level security;
alter table public.sync_events enable row level security;

-- The Cloudflare API uses SUPABASE_SERVICE_ROLE_KEY, so RLS can stay enabled without browser policies.
