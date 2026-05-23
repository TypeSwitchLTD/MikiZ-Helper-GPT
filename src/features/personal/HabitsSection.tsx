import { useState } from 'react';
import { SectionCard } from '../../components/layout/SectionCard';
import type { DailyHabit, DailyHabitLog } from '../../domain/habits/habitTypes';

interface Props {
  habits: DailyHabit[];
  habitLogs: DailyHabitLog[];
  todayISO: string;
  isSaving?: boolean;
  onNudge: (habitId: string, date: string, delta: number) => Promise<void>;
  onAdd: (input: { title: string; unit: string; targetCount: number }) => Promise<void>;
  onEdit: (habitId: string, patch: { title?: string; unit?: string; targetCount?: number; active?: boolean }) => Promise<void>;
  onDelete: (habitId: string) => Promise<void>;
}

const EMPTY_FORM = { title: '', unit: '', targetCount: 1 };

function todayCount(logs: DailyHabitLog[], habitId: string, date: string): number {
  return logs.find((l) => l.habitId === habitId && l.date === date)?.count ?? 0;
}

function computeStreak(logs: DailyHabitLog[], habitId: string, todayISO: string, target: number): number {
  let streak = 0;
  const d = new Date(`${todayISO}T12:00:00`);
  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    const log = logs.find((l) => l.habitId === habitId && l.date === dateStr);
    if ((log?.count ?? 0) >= target) {
      streak++;
    } else if (i === 0) {
      // today not yet done — don't break streak, check yesterday
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function HabitsSection({ habits, habitLogs, todayISO, isSaving, onNudge, onAdd, onEdit, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const activeHabits = habits.filter((h) => h.active).sort((a, b) => a.order - b.order);

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    await onAdd({ title: form.title.trim(), unit: form.unit.trim() || 'פעמים', targetCount: Math.max(1, form.targetCount) });
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const startEdit = (h: DailyHabit) => {
    setEditingId(h.id);
    setEditForm({ title: h.title, unit: h.unit, targetCount: h.targetCount });
  };

  const saveEdit = async (id: string) => {
    await onEdit(id, { title: editForm.title.trim(), unit: editForm.unit.trim(), targetCount: Math.max(1, editForm.targetCount) });
    setEditingId(null);
  };

  return (
    <SectionCard
      title="הרגלים — היום"
      description={`${todayISO} · לחץ +/− לעדכון הספירה`}
      action={
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-black text-white hover:bg-sky-700 transition"
        >
          {showForm ? 'ביטול' : '+ הרגל חדש'}
        </button>
      }
    >
      {showForm && (
        <div className="mb-4 grid gap-2 rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-200 sm:grid-cols-3">
          <input
            className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-300"
            placeholder="שם ההרגל (מים, שכיבות סמיכה...)"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <input
            className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-300"
            placeholder="יחידה (כוסות, פעמים, ק״מ)"
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              className="w-24 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-300"
              placeholder="יעד"
              value={form.targetCount}
              onChange={(e) => setForm((f) => ({ ...f, targetCount: Number(e.target.value) }))}
            />
            <button
              type="button"
              disabled={isSaving || !form.title.trim()}
              onClick={() => void handleAdd()}
              className="flex-1 rounded-xl bg-sky-600 px-4 py-2 text-sm font-black text-white hover:bg-sky-700 disabled:opacity-50 transition"
            >
              הוסף
            </button>
          </div>
        </div>
      )}

      {activeHabits.length === 0 && !showForm && (
        <p className="py-6 text-center text-sm text-slate-400">אין הרגלים פעילים — לחץ "הרגל חדש" להתחיל</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {activeHabits.map((habit) => {
          const count = todayCount(habitLogs, habit.id, todayISO);
          const pct = Math.min(100, Math.round((count / habit.targetCount) * 100));
          const done = count >= habit.targetCount;
          const streak = computeStreak(habitLogs, habit.id, todayISO, habit.targetCount);
          const isEditing = editingId === habit.id;

          return (
            <div
              key={habit.id}
              className={`rounded-2xl p-4 ring-1 transition ${done ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-slate-200'}`}
            >
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-300"
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-300"
                      placeholder="יחידה"
                      value={editForm.unit}
                      onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                    />
                    <input
                      type="number"
                      min={1}
                      className="w-20 rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-300"
                      value={editForm.targetCount}
                      onChange={(e) => setEditForm((f) => ({ ...f, targetCount: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void saveEdit(habit.id)} className="flex-1 rounded-xl bg-emerald-600 py-1.5 text-sm font-black text-white hover:bg-emerald-700 transition">שמור</button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-xl bg-slate-100 px-4 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-200 transition">ביטול</button>
                    <button type="button" onClick={() => { if (window.confirm(`למחוק "${habit.title}"?`)) void onDelete(habit.id); }} className="rounded-xl bg-rose-50 px-3 py-1.5 text-sm font-bold text-rose-600 hover:bg-rose-100 ring-1 ring-rose-200 transition">מחק</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-slate-900 leading-tight">{habit.title}</p>
                      <p className="text-xs text-slate-400">{count} / {habit.targetCount} {habit.unit}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {streak > 0 && (
                        <span
                          title={`${streak} ימים רצופים`}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                            streak >= 7
                              ? 'bg-violet-100 text-violet-700'
                              : streak >= 3
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          🔥 {streak}
                        </span>
                      )}
                      <button type="button" onClick={() => startEdit(habit)} className="text-xs text-slate-400 hover:text-slate-600 transition">✎</button>
                    </div>
                  </div>

                  <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-emerald-500' : 'bg-sky-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      disabled={count === 0 || isSaving}
                      onClick={() => void onNudge(habit.id, todayISO, -1)}
                      className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-xl font-black text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition"
                    >
                      −
                    </button>
                    <span className={`text-3xl font-black tabular-nums ${done ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {count}
                      {done && <span className="mr-1 text-base">✓</span>}
                    </span>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void onNudge(habit.id, todayISO, 1)}
                      className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-600 text-xl font-black text-white hover:bg-sky-700 disabled:opacity-50 transition"
                    >
                      +
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
