# QA 0.7.1 - Unified Polish

## Scope
Unified pass after 0.6.9/0.7.0.

## Must verify
1. Settings: save warning banner is gone; only floating Save Settings remains.
2. Settings: every settings row opens inline under itself and can be closed by clicking it again.
3. Settings: Morning, voice and reading are grouped together.
4. Settings: API / Tokens / Cloud are grouped together and describe Cloud Sync for user settings.
5. Mobile task cards: subtasks are visible and controls wrap cleanly instead of forcing edit-heavy layout.
6. Quiet Mode: top button goes to Tasks and shows only the recommended/current task.
7. Social / Leads: 4 compact cards remain; Supabase lead card has carousel, manual arrows, pause/resume and test button.
8. Add Task: microphone remains, Review remains first after parsing, each row keeps schedule/reminder controls.
9. Morning Readiness: appears once per day/version and can be re-enabled from the modal button.
10. ElevenLabs: keeps v3 Hebrew hotfix and does not send language_code.

## New testable features added in this pass
1. Supabase carousel pause/resume.
2. Quiet Mode persistence across refresh.
3. Morning Readiness “show again today” reset button.
4. Settings row click-to-close behavior.
5. Cleaner floating save bar without blocking text.
6. Cloud Sync explanation inside API/Cloud settings.
7. Mobile subtask control wrapping.
8. Quiet Mode description changes when active.
