# Mission Control 0.5.14 — Android Morning Briefing Setup

## Supabase

1. Create a Supabase project.
2. Go to SQL Editor.
3. Run `docs/supabase-morning-briefing.sql`.
4. Optional ringtone hosting:
   - Storage > New bucket: `morning-ringtones`
   - Make it public.
   - Upload `wake-up.mp3`.
   - Copy the public URL.

## Vercel environment variables

Set these in Vercel > Project > Settings > Environment Variables:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
MORNING_BRIEFING_TOKEN=make-a-long-private-token
PUBLIC_APP_URL=https://your-vercel-app.vercel.app
```

Important: `SUPABASE_SERVICE_ROLE_KEY` is server-only. Do not put it in frontend settings.

## Mission Control settings

Settings > נאום בוקר > Android Morning Alarm:

```text
שעת בוקר: 07:00
URL לצלצול MP3: https://.../wake-up.mp3
Publish endpoint: /api/morning-briefing
Token: same value as MORNING_BRIEFING_TOKEN
```

## Publish flow

1. Open Morning Briefing.
2. Review the text.
3. Click `פרסם לאנדרואיד`.
4. Open the returned API URL in the browser and verify JSON appears.

## Android automation idea

Tasker / MacroDroid:

1. At 07:00
2. HTTP GET `https://your-vercel-app.vercel.app/api/morning-briefing?token=...`
3. Play `ringtoneUrl` in loop until stopped.
4. After stop/wake, Text-to-Speech reads `text`.
