# Mission Control 0.5.15 — Cloudflare Pages Setup

## Goal
Deploy Mission Control with Cloudflare Pages and use Cloudflare Pages Functions for:

- `POST /api/morning-briefing`
- `GET /api/morning-briefing?token=...`

The database and MP3 are still stored in Supabase.

## 1. Push code to GitHub

Create a private GitHub repo and push this folder.

## 2. Create Cloudflare Pages project

Cloudflare Dashboard → Workers & Pages → Pages → Connect to Git.

Build settings:

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Root directory: /
```

Cloudflare will also deploy the function in:

```text
functions/api/morning-briefing.js
```

The live endpoint will be:

```text
https://YOUR_PROJECT.pages.dev/api/morning-briefing?token=YOUR_TOKEN
```

## 3. Add Cloudflare environment variables

Cloudflare Pages → Settings → Environment variables → Production:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
MORNING_BRIEFING_TOKEN=choose-a-long-secret-token
PUBLIC_APP_URL=https://YOUR_PROJECT.pages.dev
```

Use the same variables in Preview if you want to test preview deployments.

Important: never place `SUPABASE_SERVICE_ROLE_KEY` inside frontend settings. It belongs only in Cloudflare environment variables.

## 4. Supabase SQL

Run:

```text
docs/supabase-morning-briefing.sql
```

in Supabase SQL Editor.

## 5. Supabase MP3

Storage → New bucket:

```text
morning-ringtones
```

Make it public. Upload your MP3 and copy the public URL.

Paste this URL in Mission Control:

```text
Settings → נאום בוקר → Android Morning Alarm → URL לצלצול MP3
```

## 6. Mission Control settings

In Mission Control:

```text
Publish endpoint: /api/morning-briefing
Token: same MORNING_BRIEFING_TOKEN from Cloudflare
Alarm time: 07:00
Ringtone URL: Supabase public MP3 URL
```

## 7. Test

1. Open Morning Briefing.
2. Click `פרסם לאנדרואיד`.
3. Open:

```text
https://YOUR_PROJECT.pages.dev/api/morning-briefing?token=YOUR_TOKEN
```

Expected JSON:

```json
{
  "ok": true,
  "date": "YYYY-MM-DD",
  "alarmTime": "07:00",
  "ringtoneUrl": "https://...mp3",
  "text": "..."
}
```

## Local development note

Cloudflare Functions do not run under `npm run dev` with Vite only.
For local API testing you can use Cloudflare Pages deployment, or install Wrangler later.
Local app UI still runs as usual:

```powershell
cd C:\Users\Admin\Desktop\mission-control
.\setup-windows.cmd
npm.cmd run dev
```
