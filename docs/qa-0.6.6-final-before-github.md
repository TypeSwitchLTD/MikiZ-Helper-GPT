# QA 0.6.6 final before GitHub

## Scope
- Morning readiness opens once per day.
- Quiet mode top button filters to the current recommended task.
- Social tab has four compact cards. Supabase table card is a carousel with 10 second auto-advance and manual arrows.
- Add Task parse opens Review with “חזור לעריכה ידנית” as the primary action.
- Manual subtask rows include תזמון and מחק.

## Manual checks
1. Open app first time today -> Morning readiness appears. Close and refresh -> does not appear again today.
2. Click top quiet icon -> Tasks tab shows only recommended task. Click again -> full view returns.
3. Open לידים וסושיאל -> verify four cards only, no detailed Supabase table section.
4. Supabase card cycles tables every 10 seconds and arrows switch tables.
5. Open Add Task, paste text, click סדר לי למשימות -> Review appears, manual edit button is primary.
6. Click חזור לעריכה ידנית -> each subtask row has תזמון and מחק.
7. npm run typecheck and npm run build pass.
