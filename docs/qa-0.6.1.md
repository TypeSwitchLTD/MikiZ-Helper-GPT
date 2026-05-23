# Mission Control 0.6.1 — QA Notes

## Agents
- senior-architect: scoped 0.6.1 as cloud sync + UX/auth stabilization, not a rewrite.
- senior-backend: fixed morning briefing ON CONFLICT and added workspace/date constraint repair SQL.
- senior-frontend: added simple PIN gate, API connection test, and moved cloud/API settings into one area.
- ui-ux-pro-max: reduced visible sidebar actions and reorganized settings by task area.
- senior-qa: smoke checks below.

## Fixed
- Morning briefing publish conflict: API now upserts by workspace_id + date.
- Token confusion: API settings include one endpoint/token area and a connection test.
- Hebrew date reading: Hebrew year removed from briefing text.
- Female narrator wording: voice narrator gender changes מקריא/מקריאה.
- Basic app PIN: 6 digits, auto-submit without Enter.
- Last bad import cleanup: Report import screen can delete the last daily-report import batch.
- Daily report parser: indented checklist bullets become subtasks under the parent task.
- Mission Control panel: less daily button clutter; less-used actions moved into details blocks.

## Automated checks
- npm run typecheck: passed
- npm run build: passed
- npm test: passed

## Manual checks recommended
1. Settings > API / Cloud / Tokens > בדוק חיבור.
2. Publish morning briefing after saving the correct Token.
3. Import a report with parent bullets and [ ] subtasks.
4. Use מחק ייבוא אחרון after a test import.
5. Enable PIN with a 6-digit code, refresh, and verify auto-login after 6 digits.
