# Mission Control 0.5.1 — QA checklist

## Install
1. `npm.cmd run typecheck` passes.
2. `npm.cmd run build` passes.
3. `npm.cmd run dev` opens the app.

## Visual polish
4. Main background is light sky blue, not too strong.
5. The inner app panel and right-side card are almost white.
6. The right-side panel is on the right in RTL desktop.
7. Version appears once as `0.5.1`.
8. Tabs and search do not overlap.

## Morning briefing
9. Click the Play button near Mission Control.
10. The Morning Briefing modal opens.
11. It starts with `בוקר טוב מיקי`.
12. It includes the regular Hebrew date and the Hebrew calendar date.
13. It attempts to load morning/noon weather for the selected city.
14. It includes a motivation sentence.
15. It tells you to do a short morning exercise.
16. It includes exactly three reminder-style items.
17. It includes up to three important tasks.
18. The speech starts automatically.
19. `עצור` stops the speech.
20. `הקריא` reads it again.
21. `ייצא נאום` downloads a Markdown file.

## Tasks
22. Opening and closing a task card works.
23. Start/Done checkboxes work.
24. Done can be cancelled.
25. Refresh keeps subtask state.

## Add task / Review
26. The free text box is shorter than before.
27. `סדר לי טיוטה` opens Review.
28. Review sectors are less tall and more compact.
29. Review uses click choices, not dropdowns for core choices.
30. Saving Review does not lose rows.

## Daily State
31. `ייצא Daily State לבדיקה` downloads JSON.
