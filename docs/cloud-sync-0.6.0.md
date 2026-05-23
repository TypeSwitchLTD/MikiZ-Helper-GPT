# Mission Control 0.6.0 — Cloud Sync Foundation

## Goal
Supabase becomes the cloud source of truth. IndexedDB remains a local cache/backup.

## Supabase setup
1. Open Supabase → SQL Editor.
2. Run `docs/supabase-cloud-sync-foundation.sql`.
3. Confirm these tables exist:
   - tasks
   - subtasks
   - reminders
   - daily_plans
   - recurring_definitions
   - daily_reports
   - daily_logs
   - app_settings
   - morning_briefings
   - sync_events

## Cloudflare Pages variables
Set these in Cloudflare Pages → Settings → Environment variables:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
MORNING_BRIEFING_TOKEN=your-long-secret-token
MISSION_CONTROL_WORKSPACE_ID=miki
PUBLIC_APP_URL=https://YOUR_PROJECT.pages.dev
```

## Mission Control settings
In Mission Control:
1. Settings → נאום בוקר.
2. Android Morning Alarm:
   - Publish endpoint: `/api/morning-briefing`
   - Token: the same `MORNING_BRIEFING_TOKEN`
3. Save settings.

## First cloud migration
1. Make sure your current local data is good.
2. Click `סנכרן לענן` in the sidebar Cloud Sync card.
3. Check Supabase tables.
4. Refresh app.
5. Use `טען מהענן` only after the first successful sync.

## Android morning flow
After cloud sync, Android can call:

```text
https://YOUR_PROJECT.pages.dev/api/morning-briefing?token=YOUR_TOKEN
```

The next stage can generate the morning briefing from Supabase tasks even when the computer is off.

## Safety
- No IndexedDB reset.
- No local data deletion.
- Service role key is only in Cloudflare, never in the browser.
