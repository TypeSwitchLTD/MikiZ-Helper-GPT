# Mission Control 0.5.3 — QA checklist

## Install
1. `npm.cmd run typecheck` passes.
2. `npm.cmd run build` passes.
3. `npm.cmd run dev` opens the app.

## Visual + mobile
4. Desktop layout: Mission Control side panel is on the right.
5. Mobile layout: Mission Control appears first and the task board follows below.
6. Tabs scroll horizontally on mobile instead of wrapping over the search.
7. Scrollbars are thin and quiet, not heavy/default.
8. Inner panels are white / almost white.

## Morning briefing
9. Play opens the Morning Briefing modal.
10. The briefing uses the nickname from Settings.
11. Hebrew calendar year is rendered in Hebrew letters.
12. Weather still loads or shows a safe fallback.
13. The text order is: greeting, date, weather, motivation, exercise, reminders, important tasks, leads, closing.
14. Browser fallback voice still works.
15. If Settings has ElevenLabs engine + API key + Voice ID, Play attempts ElevenLabs.
16. If ElevenLabs fails, the app shows an error and falls back to browser voice.
17. Stop stops browser speech and ElevenLabs audio.

## Settings
18. Settings has Morning Briefing fields: nickname, style, motivation, exercise, closing.
19. Settings has Voice Engine selector: Browser / ElevenLabs.
20. ElevenLabs API Key, Voice ID, model, output format and proxy URL save locally.
21. Reload keeps the saved settings.

## Add task / Review
22. + remains centered.
23. Free-text intake is compact.
24. Review sectors are still generated.
25. Review save does not lose rows.

## Safety helpers
26. “מוכן לבוקר?” opens a quick readiness check.
27. “בדיקת מערכת” opens a system check.
28. Daily State export still downloads JSON.
