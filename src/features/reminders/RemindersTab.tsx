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

type FilterMode = 'open' | 'overdue' | 'today' | 'upcoming' | 'done' | 'cancelled';
type ReminderGroupId = 'overdue' | 'morning' | 'noon' | 'evening' | 'upcoming' | 'done' | 'cancelled';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatDateLabel(remindAt: string): string {
  const date = new Date(remindAt);
  if (Number.isNaN(date.getTime())) return remindAt;
  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(date).getTime();
  const diffDays = Math.round((target - today) / DAY_MS);
  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'מחר';
  if (diffDays === -1) return 'אתמול';
  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function getDayPart(remindAt: string): 'בוקר' | 'צהריים' | 'ערב' | 'לילה' {
  const hour = new Date(remindAt).getHours();
  if (hour < 12) return 'בוקר';
  if (hour < 17) return 'צהריים';
  if (hour < 21) return 'ערב';
  return 'לילה';
}

function formatReminderTime(remindAt: string): string {
  const date = new Date(remindAt);
  if (Number.isNaN(date.getTime())) return remindAt;
  const time = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return `${formatDateLabel(remindAt)} · ${getDayPart(remindAt)} · ${time}`;
}

function statusLabel(status: Reminder['status']): string {
  if (status === 'pending') return 'ממתין';
  if (status === 'sent') return 'בוצע';
  return 'בוטל';
}

function statusBadgeClass(status: Reminder['status']): string {
  if (status === 'pending') return 'bg-amber-50 text-amber-800 ring-amber-200';
  if (status === 'sent') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  return 'bg-slate-100 text-slate-500 ring-slate-200';
}

function isToday(remindAt: string): boolean {
  return startOfDay(new Date(remindAt)).getTime() === startOfDay(new Date()).getTime();
}

function isPast(remindAt: string): boolean {
  return new Date(remindAt).getTime() < Date.now();
}

function getGroupId(reminder: Reminder): ReminderGroupId {
  if (reminder.status === 'sent') return 'done';
  if (reminder.status === 'cancelled') return 'cancelled';
  if (isPast(reminder.remindAt)) return 'overdue';
  if (!isToday(reminder.remindAt)) return 'upcoming';
  const part = getDayPart(reminder.remindAt);
  if (part === 'בוקר') return 'morning';
  if (part === 'צהריים') return 'noon';
  return 'evening';
}

const groupMeta: Record<ReminderGroupId, { title: string; description: string; tone: string }> = {
  overdue: { title: 'באיחור', description: 'דורש החלטה עכשיו', tone: 'border-r-rose-300 bg-rose-50/40' },
  morning: { title: 'בוקר', description: 'לפני שהיום נמרח', tone: 'border-r-sky-300 bg-sky-50/40' },
  noon: { title: 'צהריים', description: 'אמצע יום עבודה', tone: 'border-r-amber-300 bg-amber-50/40' },
  evening: { title: 'ערב', description: 'סגירות ופולואפים', tone: 'border-r-violet-300 bg-violet-50/40' },
  upcoming: { title: 'עתידיות', description: 'מחר והלאה', tone: 'border-r-slate-300 bg-slate-50/60' },
  done: { title: 'בוצעו', description: 'נסגרו', tone: 'border-r-emerald-300 bg-emerald-50/40' },
  cancelled: { title: 'בוטלו', description: 'לא פעילות', tone: 'border-r-slate-300 bg-slate-50/60' },
};

function reminderSort(a: Reminder, b: Reminder): number {
  return new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime();
}

export function RemindersTab({
  reminders,
  tasks,
  onMarkDone,
  onSnooze,
  onCancel,
  onJumpToTask,
}: RemindersTabProps) {
  const [filter, setFilter] = useState<FilterMode>('open');

  const taskMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  const counts = useMemo(
    () => ({
      open: reminders.filter((r) => r.status === 'pending').length,
      overdue: reminders.filter((r) => r.status === 'pending' && isPast(r.remindAt)).length,
      today: reminders.filter((r) => r.status === 'pending' && isToday(r.remindAt)).length,
      upcoming: reminders.filter((r) => r.status === 'pending' && !isToday(r.remindAt) && !isPast(r.remindAt)).length,
      done: reminders.filter((r) => r.status === 'sent').length,
      cancelled: reminders.filter((r) => r.status === 'cancelled').length,
    }),
    [reminders],
  );

  const filtered = useMemo(() => {
    const byFilter = reminders.filter((reminder) => {
      if (filter === 'open') return reminder.status === 'pending';
      if (filter === 'overdue') return reminder.status === 'pending' && isPast(reminder.remindAt);
      if (filter === 'today') return reminder.status === 'pending' && isToday(reminder.remindAt);
      if (filter === 'upcoming') return reminder.status === 'pending' && !isToday(reminder.remindAt) && !isPast(reminder.remindAt);
      if (filter === 'done') return reminder.status === 'sent';
      return reminder.status === 'cancelled';
    });
    return byFilter.sort(reminderSort);
  }, [filter, reminders]);

  const grouped = useMemo(() => {
    const groups = new Map<ReminderGroupId, Reminder[]>();
    filtered.forEach((reminder) => {
      const groupId = getGroupId(reminder);
      groups.set(groupId, [...(groups.get(groupId) ?? []), reminder]);
    });
    const order: ReminderGroupId[] = ['overdue', 'morning', 'noon', 'evening', 'upcoming', 'done', 'cancelled'];
    return order
      .map((groupId) => ({ groupId, reminders: groups.get(groupId) ?? [] }))
      .filter((group) => group.reminders.length > 0);
  }, [filtered]);

  const filterButtons: { id: FilterMode; label: string; count: number }[] = [
    { id: 'open', label: 'פתוחות', count: counts.open },
    { id: 'overdue', label: 'באיחור', count: counts.overdue },
    { id: 'today', label: 'היום', count: counts.today },
    { id: 'upcoming', label: 'עתידיות', count: counts.upcoming },
    { id: 'done', label: 'בוצעו', count: counts.done },
    { id: 'cancelled', label: 'בוטלו', count: counts.cancelled },
  ];

  return (
    <section className="space-y-4" dir="rtl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">תזכורות</h1>
        <p className="text-sm font-bold text-slate-500">
          {counts.open} פתוחות · {counts.overdue} באיחור · {counts.today} להיום
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {filterButtons.map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => setFilter(btn.id)}
            className={`rounded-2xl px-3 py-2 text-xs font-black transition-colors ${
              filter === btn.id
                ? 'bg-slate-950 text-white'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="block">{btn.label}</span>
            <span className={filter === btn.id ? 'text-white/70' : 'text-slate-400'}>{btn.count}</span>
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-3xl bg-white/92 p-8 text-center shadow-soft ring-1 ring-slate-100">
          <p className="text-sm font-bold text-slate-500">אין תזכורות להצגה</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ groupId, reminders: groupReminders }) => {
            const meta = groupMeta[groupId];
            return (
              <section key={groupId} className={`space-y-2 rounded-3xl border-r-4 p-3 ring-1 ring-slate-100 ${meta.tone}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black text-slate-950">{meta.title}</h2>
                    <p className="text-xs font-bold text-slate-500">{meta.description}</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                    {groupReminders.length}
                  </span>
                </div>

                <div className="grid gap-2">
                  {groupReminders.map((reminder) => {
                    const linkedTask = reminder.taskId ? taskMap.get(reminder.taskId) : undefined;
                    const overdue = reminder.status === 'pending' && isPast(reminder.remindAt);

                    return (
                      <article
                        key={reminder.id}
                        className={`rounded-[1.35rem] bg-white p-3 shadow-sm ring-1 ${
                          overdue ? 'ring-amber-300' : 'ring-slate-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black ring-1 ${statusBadgeClass(reminder.status)}`}>
                                {statusLabel(reminder.status)}
                              </span>
                              {overdue ? (
                                <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-black text-red-700 ring-1 ring-red-200">
                                  באיחור
                                </span>
                              ) : null}
                            </div>
                            <h3 className="mt-1.5 text-sm font-black leading-snug text-slate-950">
                              {reminder.title}
                            </h3>
                            {reminder.note ? (
                              <p className="mt-0.5 line-clamp-2 text-xs font-bold text-slate-500">
                                {reminder.note}
                              </p>
                            ) : null}
                          </div>
                          <p className="shrink-0 text-left text-xs font-black text-slate-700">
                            {formatReminderTime(reminder.remindAt)}
                          </p>
                        </div>

                        {linkedTask ? (
                          <div className="mt-2.5 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                            <span className="shrink-0 text-xs font-bold text-slate-400">משימה:</span>
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

                        {reminder.status === 'pending' ? (
                          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                            <button
                              type="button"
                              onClick={() => onMarkDone(reminder.id)}
                              className="rounded-2xl bg-emerald-500 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-600"
                            >
                              סיים
                            </button>
                            <button
                              type="button"
                              onClick={() => onSnooze(reminder.id, 10)}
                              className="rounded-2xl bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                            >
                              10 דק׳
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
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
