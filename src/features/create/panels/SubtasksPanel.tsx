import type { KeyboardEvent } from 'react';

interface SubtasksPanelProps {
  subtasks: string[];
  date: string;
  scheduledTimeLabel: string;
  scheduleSubtaskIndex: number | null;
  onAddRow: () => void;
  onUpdateRow: (index: number, value: string) => void;
  onRemoveRow: (index: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>, index: number) => void;
  onToggleSchedule: (index: number) => void;
  onDateChange: (value: string) => void;
  onTimeLabelChange: (value: string) => void;
  onSaveSchedule: () => void;
}

export function SubtasksPanel({
  subtasks,
  date,
  scheduledTimeLabel,
  scheduleSubtaskIndex,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
  onKeyDown,
  onToggleSchedule,
  onDateChange,
  onTimeLabelChange,
  onSaveSchedule,
}: SubtasksPanelProps) {
  return (
    <section className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">תתי־משימות</h3>
          <p className="text-xs font-bold text-slate-500">Enter מוסיף שורה. Ctrl+Enter בודק ושומר את המשימה.</p>
        </div>
        <button type="button" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200" onClick={onAddRow}>
          הוסף שורה
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {subtasks.map((subtask, index) => (
          <div key={index} className="rounded-3xl bg-white p-2 ring-1 ring-slate-100">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input
                value={subtask}
                onChange={(e) => onUpdateRow(index, e.target.value)}
                onKeyDown={(e) => onKeyDown(e, index)}
                placeholder={`תת־משימה ${index + 1}`}
              />
              <button
                type="button"
                className="rounded-2xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 ring-1 ring-sky-100"
                onClick={() => onToggleSchedule(index)}
              >
                תזמון
              </button>
              <button
                type="button"
                className="rounded-2xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-100"
                onClick={() => onRemoveRow(index)}
              >
                מחק
              </button>
            </div>
            {scheduleSubtaskIndex === index ? (
              <div className="mt-2 grid gap-2 rounded-2xl bg-sky-50 p-3 text-xs font-black text-sky-900 ring-1 ring-sky-100 sm:grid-cols-3">
                <label className="grid gap-1">
                  תאריך
                  <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
                </label>
                <label className="grid gap-1">
                  שעה / תווית
                  <input value={scheduledTimeLabel} onChange={(e) => onTimeLabelChange(e.target.value)} placeholder="מחר 09:00" />
                </label>
                <button
                  type="button"
                  className="self-end rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white"
                  onClick={onSaveSchedule}
                >
                  שמור תזמון
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
