# QA 0.6.8 - Voice Input + ElevenLabs Fix

## Scope
- ElevenLabs playback uses the working 0.6.x request flow.
- Old saved `eleven_multilingual_v2` settings are forced to `eleven_v3`.
- `language_code: 'he'` is no longer sent.
- Add Task now has a live microphone dictation button inside the raw intake textbox flow.
- Dictation supports Hebrew/English mode and spoken punctuation mapping.

## Manual QA
1. Run `npm.cmd run build`.
2. Open Add Task.
3. Press 🎙️ דבר and approve microphone permission.
4. Speak Hebrew and English words.
5. Confirm words are inserted into the free-text box.
6. Say: נקודה, פסיק, סימן שאלה, שורה חדשה.
7. Press סדר לי למשימות and confirm Review opens.
8. Press Play morning briefing and confirm the old `language_code he` ElevenLabs error does not appear.
