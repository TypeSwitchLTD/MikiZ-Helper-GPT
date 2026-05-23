# QA 0.6.2 Local Calm Focus UX

## Scope
Local-only UX integration on top of stable 0.6.1. Do not push to GitHub before manual approval.

## Must pass
- App loads with existing IndexedDB data.
- Cloud Sync buttons remain available in the right rail.
- Morning Play button remains available in the top header.
- Right rail collapses/opens with a fixed button and does not require scrolling.
- Search still jumps to matched tasks.
- Task cards keep edit/reminder/timer/move-to-tomorrow actions.
- End-task checkbox appears on the opposite side of the task row and marks subtasks done/not started.
- Tasks tab has recommended action, next-up cards, and quiet mode.
- Settings groups keep APIs/tokens/settings values and combine morning + voice controls.
- Add Task still opens and saves using the existing CreateMissionItemButton flow.

## Manual test commands
```powershell
cd C:\Users\Admin\Desktop\mission-control
.\setup-windows.cmd
npm.cmd run dev
```

## Build checks
```powershell
npm.cmd run typecheck
npm.cmd run build
```

## Not changed intentionally
- No schema changes.
- No Cloudflare deployment.
- No Supabase table migration.
- No GitHub push.
- No rewrite of the parser or data model.
