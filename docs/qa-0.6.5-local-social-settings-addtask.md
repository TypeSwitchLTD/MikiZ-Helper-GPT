# QA 0.6.5 local social/settings/add-task pass

## Scope
- Quiet mode top button should switch to Tasks and show only the recommended/current task.
- Leads & Social should be a compact four-card dashboard, not a settings page.
- Supabase table names are configured in Settings > API / Cloud / Tokens.
- Table stats API reports clear local Vite limitation instead of confusing `200` errors.
- Add Task review includes a schedule action per row and removes the notes-first flow from parsed review.

## Manual checks
1. Run `npm.cmd run dev` and open `http://127.0.0.1:5173/`.
2. Click the top quiet icon. Confirm it switches to the Tasks tab and shows only the recommended task.
3. Open Leads & Social. Confirm the page is four compact blocks: Supabase, LinkedIn, Instagram, lead/social tasks.
4. Click Supabase check locally. Confirm it explains Cloudflare Functions do not run in normal Vite local mode if endpoint is relative.
5. Open Settings > API / Cloud / Tokens. Confirm table names/date columns are edited there, not in Leads & Social.
6. Paste text in Add Task, click `סדר לי למשימות`, confirm review opens directly.
7. In review, click `תזמון` on a row. Confirm date/time controls open for that row.

## Automated checks
- `npm run typecheck` passed.
- `npm run build` passed.

## Notes
- Full Supabase table-stats test requires Cloudflare Pages/Functions deploy or a full deployed endpoint. It cannot be verified through plain `npm run dev` when endpoint is `/api/table-stats`.
