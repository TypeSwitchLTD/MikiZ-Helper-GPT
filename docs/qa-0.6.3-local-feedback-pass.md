# QA 0.6.3 local feedback pass

## Scope
- Morning Play no longer opens the full briefing modal from the top button.
- Top Play shows progress percent while preparing voice and becomes stop while active.
- Focus timer and quiet/command icon are exposed in the top bar.
- Morning summary section can be disabled from Settings.
- Readiness screen was redesigned with open task/subtask counts.
- Subtasks are editable inline from an opened task card.
- Subtask edits save through IndexedDB and then cloud sync.

## Checks
- [ ] Top Play starts progress without opening a modal.
- [ ] Top Play/Stop can stop generation or playback.
- [ ] Focus timer icon opens timer.
- [ ] Quiet/command icon opens command center.
- [ ] Open task > edit subtask text > save > refresh persists.
- [ ] Settings > morning > summary checkbox can be turned off.
- [ ] Ready for morning screen shows open tasks and open subtasks.
- [ ] npm run typecheck passes.
- [ ] npm run build passes.
