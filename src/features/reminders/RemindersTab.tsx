import { useMemo, useState } from 'react';
import type { Reminder } from '../../domain/reminders/reminderTypes';
import type { Task } from '../../domain/tasks/taskTypes';

interface RemindersTabProps {
  reminders: Reminder[];
  tasks: Task[];
  onMarkDone: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onCancel: (id: string) => void;
  onJumpToTask?: (task: Task) => void;
}

function formatReminderDateTime(remindAt: string): string {
  const date = new Date(remindAt);
  if (Number.isNaN(date.getTime())) return remindAt;
  return date.toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: Reminder['status']): string {
  if (status === 'pending') return 'ממתין';
  if (status === 'sent') return 'נשלח';
  return 'בוטל';
}

function statusBadgeClass(status: Reminder['status']): string {
  if (status === 'pending') return 'bg-amber-50 text-amber-800 ring-amber-200';
  if (status === 'sent') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  return 'bg-slate-100 text-slate-500 ring-slate-200';
}

function isPast(remindAt: string): boolean {
  return new Date(remindAt).getTime() < Date.now();
}

type FilterMode = 'all' | 'pending' | 'sent' | 'cancelled';

export function RemindersTab({
  reminders,
  tasks,
  onMarkDone,
  onSnooze,
  onCancel,
  onJumpToTask,
}: RemindersTabProps) {
  const [filter, setFilter] = useState<FilterMode>('all');

  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  const sorted = useMemo(() => {
    return [...reminders].sort(
      (a, b) => new Date(b.remindAt).getTime() - new Date(a.remindAt).getTime(),
    );
  }, [reminders]);

  const filtered = useMemo(() => {
    if (filter === 'all') return sorted;
    return sorted.filter((r) => r.status === filter);
  }, [sorted, filter]);

  const counts = useMemo(
    () => ({
      pending: reminders.filter((r) => r.status === 'pending').length,
      sent: reminders.filter((r) => r.status === 'sent').length,
      cancelled: reminders.filter((r) => r.status === 'cancelled').length,
    }),
    [reminders],
  );

  const filterButtons: { id: FilterMode; label: string; count?: number }[] = [
    { id: 'all', label: 'הכל', count: reminders.length },
    { id: 'pending', label: 'ממתינות', count: counts.pending },
    { id: 'sent', label: 'נשלחו', count: counts.sent },
    { id: 'cancelled', label: 'בוטלו', count: counts.cancelled },
  ];

  return (
    <section className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-950">🔔 תזכורות</h1>
        <p className="text-sm font-bold text-slate-500">
          {counts.pending} ממתינות · {counts.sent} נשלחו
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {filterButtons.map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => setFilter(btn.id)}
            className={`rounded-2xl px-4 py-2 text-xs font-black transition-colors ${
              filter === btn.id
                ? 'bg-slate-950 text-white'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {btn.label}
            {btn.count !== undefined && btn.count > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                filter === btn.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {btn.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white/92 p-8 text-center shadow-soft ring-1 ring-slate-100">
          <p className="text-2xl">🗓</p>
          <p className="mt-2 text-sm font-bold text-slate-500">אין תזכורות להציג</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((reminder) => {
            const linkedTask = reminder.taskId ? taskMap.get(reminder.taskId) : undefined;
            const overdue = reminder.status === 'pending' && isPast(reminder.remindAt);

            return (
              <article
                key={reminder.id}
                className={`rounded-[1.75rem] bg-white p-4 shadow-soft ring-1 ${
                  overdue ? 'ring-amber-300' : 'ring-slate-100'
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black ring-1 ${statusBadgeClass(reminder.status)}`}
                      >
                        {statusLabel(reminder.status)}
                      </span>
                      {overdue && (
                        <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-black text-red-700 ring-1 ring-red-200">
                          באיחור
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 text-sm font-black text-slate-950 leading-snug">
                      {reminder.title}
                    </h3>
                    {reminder.note ? (
                      <p className="mt-0.5 text-xs font-bold text-slate-500 line-clamp-2">
                        {reminder.note}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="text-xs font-black text-slate-700">
                      {formatReminderDateTime(reminder.remindAt)}
                    </p>
                  </div>
                </div>

                {/* Linked task */}
                {linkedTask ? (
                  <div className="mt-2.5 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                    <span className="text-xs font-bold text-slate-400 shrink-0">משימה:</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-black text-slate-700">
                      {linkedTask.title}
                    </span>
                    {onJumpToTask ? (
                      <button
                        type="button"
                        onClick={() => onJumpToTask(linkedTask)}
                        className="shrink-0 rounded-xl bg-white px-2.5 py-1 text-[10px] font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      >
                        פתח
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {/* Action buttons */}
                {reminder.status === 'pending' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onMarkDone(reminder.id)}
                      className="rounded-2xl bg-emerald-500 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-600"
                    >
                      ✓ סיים
                    </button>
                    <button
                      type="button"
                      onClick={() => onSnooze(reminder.id, 10)}
                      className="rounded-2xl bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                    >
                      נודניק 10 דק׳
                    </button>
                    <button
                      type="button"
                      onClick={() => onSnooze(reminder.id, 60)}
                      className="rounded-2xl bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                    >
                      שעה
                    </button>
                    <button
                      type="button"
                      onClick={() => onCancel(reminder.id)}
                      className="rounded-2xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200"
                    >
                      בטל
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
