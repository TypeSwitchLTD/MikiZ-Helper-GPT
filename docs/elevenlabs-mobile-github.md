# ElevenLabs + Mobile + GitHub plan

## Goal
Use Mission Control on desktop and mobile, with a Play button on both. Keep the app local-first and avoid adding Supabase as the main brain.

## Current 0.5.3 implementation
- Browser speech remains as fallback.
- ElevenLabs can be selected in Settings.
- ElevenLabs fields are saved locally in IndexedDB settings:
  - API key
  - Voice ID
  - Model ID
  - Output format
  - Optional proxy URL
- If ElevenLabs is configured, the Play button attempts ElevenLabs first.
- If it fails, the app falls back to browser voice.

## Important security note
A static GitHub Pages site cannot securely hide an ElevenLabs API key. If you enter the key directly in the browser, it is stored locally on that device and visible to that browser session. This is acceptable for a local/private prototype, but not ideal for long-term mobile use.

## Recommended path
1. Private GitHub repo for source control.
2. GitHub Pages or Vercel static preview for mobile UI testing.
3. For real ElevenLabs on mobile, add a tiny proxy later:
   - Vercel Function
   - Netlify Function
   - Cloudflare Worker
   - small local/remote Express endpoint
4. The proxy stores the ElevenLabs key server-side and exposes a simple endpoint:
   - `POST /api/tts`
   - body: `{ text, voice_id, model_id, output_format }`
   - response: `audio/mpeg`

## Why proxy is better
- The API key is not exposed in the browser.
- Mobile can use the Play button without storing secrets on the phone.
- The app can still remain local-first for tasks and Daily State.

## Future split
Mobile should focus on:
- Mission Control panel
- Play / Morning Briefing
- Ready for morning check
- Quick add task
- Today summary

Desktop remains the full workspace:
- task board
- review sectors
- backlog
- reports
- settings
