# Mission Control — Phase 4.6

Local-first Hebrew/RTL Mission Control app for one entrepreneur. This phase polishes the Add Task parser/review flow and fixes the top navigation/search layout before moving to full daily reports.

## What's included in 0.4.8

- Top tab row was moved above the search field to avoid the active tab bubble overlapping search results.
- Header/status area remains compact with stats, lead placeholder, search and app version.
- Add Task free-text parser now detects Hebrew timing words: `היום`, `מחר`, `מחרתיים`, `השבוע`, `בהמשך`.
- Add Task parsing now distinguishes between one parent task with numbered subtasks and several unrelated tasks.
- New “בדיקה לפני הוספה” review step for multi-item free text.
- Each parsed row can be saved as a new task or assigned to an existing parent task.
- Per-row parent-task search lets you type 1–2 words and assign a row to an existing open task.
- Stronger local matching suggests existing parent tasks automatically when relevant.
- Tags in task edit are now selectable chips instead of comma-separated free text.
- Existing duplicate detection and merge behavior remain active.
- IndexedDB remains the source of truth.
- No Supabase, GitHub Pages, Instantly API, Google Calendar API, external AI, or real auth yet.

## Windows run path

Use this folder:

```powershell
C:\Users\Admin\Desktop\mission-control
```

## First setup after extracting a clean ZIP

```powershell
cd C:\Users\Admin\Desktop\mission-control
.\setup-windows.cmd
npm.cmd run dev
```

## Regular run

```powershell
cd C:\Users\Admin\Desktop\mission-control
npm.cmd run dev
```

## Verification

```powershell
cd C:\Users\Admin\Desktop\mission-control
npm.cmd run typecheck
npm.cmd run build
```

## Cloudflare Pages deployment

This package includes Cloudflare Pages Function support for Android Morning Briefing:

```text
functions/api/morning-briefing.js
```

Setup guide:

```text
docs/cloudflare-pages-setup.md
```
