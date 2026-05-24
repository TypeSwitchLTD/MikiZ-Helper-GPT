import type { Reminder } from '../../domain/reminders/reminderTypes';
import type { Task } from '../../domain/tasks/taskTypes';

interface ReminderToastProps {
  dueReminders: Reminder[];
  tasks?: Task[];
  onMarkDone: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onDismiss: (id: string) => void;
  onJumpToTask?: (task: Task) => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso.slice(11, 16);
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return 'היום';
    if (d.toDateString() === tomorrow.toDateString()) return 'מחר';
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

export function ReminderToast({
  dueReminders,
  tasks = [],
  onMarkDone,
  onSnooze,
  onDismiss,
  onJumpToTask,
}: ReminderToastProps) {
  if (dueReminders.length === 0) return null;

  return (
    <div
      className="fixed inset-x-2 bottom-20 z-[75] flex max-h-[48dvh] flex-col gap-2 overflow-y-auto sm:inset-x-auto sm:bottom-32 sm:left-1/2 sm:w-full sm:max-w-[22rem] sm:-translate-x-1/2 sm:gap-2.5 sm:px-3"
      role="region"
      aria-label="תזכורות פעילות"
    >
      {dueReminders.slice(0, 2).map((reminder) => {
        const linkedTask = reminder.taskId ? tasks.find((t) => t.id === reminder.taskId) : undefined;

        return (
          <div
            key={reminder.id}
            className="overflow-hidden rounded-2xl bg-amber-50 shadow-2xl ring-1 ring-amber-200 sm:rounded-3xl"
          >
            {/* Coloured top strip */}
            <div className="flex items-center justify-between gap-2 bg-amber-400 px-3 py-1.5 sm:px-4 sm:py-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🔔</span>
                <span className="text-xs font-black text-amber-950">תזכורת</span>
              </div>
              <span className="rounded-full bg-amber-950/15 px-2.5 py-0.5 text-[11px] font-black text-amber-950">
                {formatDate(reminder.remindAt)} · {formatTime(reminder.remindAt)}
              </span>
            </div>

            {/* Body */}
            <div className="px-3 pb-2 pt-2 sm:px-4 sm:pt-3">
              <p className="mobile-clamp-2 text-sm font-black leading-snug text-slate-950">{reminder.title}</p>
              {reminder.note ? (
                <p className="mt-0.5 text-xs font-medium text-slate-600">{reminder.note}</p>
              ) : null}

              {/* Linked task */}
              {linkedTask ? (
                <button
                  type="button"
                  onClick={() => onJumpToTask?.(linkedTask)}
                  className="mt-2 flex w-full items-center gap-1.5 rounded-2xl bg-white/80 px-3 py-1.5 text-left ring-1 ring-amber-200 hover:bg-white transition"
                >
                  <span className="text-[10px] font-bold text-amber-700 shrink-0">משימה:</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-black text-slate-800">
                    {linkedTask.title}
                  </span>
                  <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              ) : null}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-4 gap-1.5 px-3 pb-2 pt-1 sm:flex sm:flex-wrap sm:px-4 sm:pb-3">
              <button
                type="button"
                className="rounded-2xl bg-emerald-500 px-2 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-600 sm:px-3"
                onClick={() => onMarkDone(reminder.id)}
              >
                ✓ סיים
              </button>
              <button
                type="button"
                className="rounded-2xl bg-white px-2 py-2 text-xs font-black text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-50 sm:px-3"
                onClick={() => onSnooze(reminder.id, 10)}
              >
                10 דק׳
              </button>
              <button
                type="button"
                className="rounded-2xl bg-white px-2 py-2 text-xs font-black text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-50 sm:px-3"
                onClick={() => onSnooze(reminder.id, 60)}
              >
                שעה
              </button>
              <button
                type="button"
                className="rounded-2xl bg-amber-100 px-2 py-2 text-xs font-bold text-slate-600 transition hover:bg-amber-200 sm:px-3"
                onClick={() => onDismiss(reminder.id)}
              >
                דחה
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
