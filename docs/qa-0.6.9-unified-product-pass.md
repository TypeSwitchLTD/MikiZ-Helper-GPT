# QA 0.6.9 - Unified Product Pass

## Scope
- ElevenLabs Hebrew hotfix: default model is `eleven_v3`, old saved `eleven_multilingual_v2` is forced to `eleven_v3`, and no `language_code` is sent.
- Voice input in Add Task: microphone writes directly into the free-text box with Hebrew/English modes and basic punctuation commands.
- Morning Readiness opens once per day per app version, including mobile.
- Mobile bootstrap for Cloud Sync: opening the site with `?token=...` stores the token once, pulls cloud state, and removes the token from the URL.
- Social dashboard includes the compact Supabase/LinkedIn/Instagram/social-tasks layout from 0.6.8.

## Manual QA
- `npm.cmd run typecheck` passes.
- `npm.cmd run build` passes.
- Play morning briefing does not send `language_code: he`.
- Add Task microphone inserts text into the textarea.
- On mobile, open the site once with `?token=YOUR_TOKEN`; cloud data should pull and then the token should disappear from the URL.
- Morning readiness should show once after updating to 0.6.9.
