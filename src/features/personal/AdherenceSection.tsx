import { SectionCard } from '../../components/layout/SectionCard';
import type { DailyHabit, DailyHabitLog } from '../../domain/habits/habitTypes';

interface Props {
  habits: DailyHabit[];
  habitLogs: DailyHabitLog[];
  todayISO: string;
}

function lastNDates(todayISO: string, n: number): string[] {
  const dates: string[] = [];
  const d = new Date(`${todayISO}T12:00:00`);
  for (let i = 0; i < n; i++) {
    dates.unshift(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 1);
  }
  return dates;
}

function adherencePct(logs: DailyHabitLog[], habitId: string, dates: string[], target: number): number {
  if (!dates.length) return 0;
  const met = dates.filter((date) => (logs.find((l) => l.habitId === habitId && l.date === date)?.count ?? 0) >= target).length;
  return Math.round((met / dates.length) * 100);
}

export function AdherenceSection({ habits, habitLogs, todayISO }: Props) {
  const activeHabits = habits.filter((h) => h.active).sort((a, b) => a.order - b.order);
  if (activeHabits.length === 0) return null;

  const last28 = lastNDates(todayISO, 28);
  const last7 = last28.slice(-7);
  const prev7 = last28.slice(-14, -7);

  return (
    <SectionCard title="נוכחות הרגלים" description="28 ימים אחרונים">
      <div className="space-y-5">
        {activeHabits.map((habit) => {
          const pct7 = adherencePct(habitLogs, habit.id, last7, habit.targetCount);
          const pctPrev7 = adherencePct(habitLogs, habit.id, prev7, habit.targetCount);
          const trend = pct7 - pctPrev7;

          return (
            <div key={habit.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-800">{habit.title}</p>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <span>{pct7}% השבוע</span>
                  {trend !== 0 && (
                    <span className={trend > 0 ? 'text-emerald-600' : 'text-rose-500'}>
                      {trend > 0 ? '↑' : '↓'}{Math.abs(trend)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(28, minmax(0, 1fr))` }}>
                {last28.map((date) => {
                  const count = habitLogs.find((l) => l.habitId === habit.id && l.date === date)?.count ?? 0;
                  const met = count >= habit.targetCount;
                  const partial = count > 0 && !met;
                  return (
                    <div
                      key={date}
                      title={`${date}: ${count}/${habit.targetCount}`}
                      className={`h-4 rounded-sm ${
                        met ? 'bg-emerald-400' : partial ? 'bg-amber-300' : 'bg-slate-100'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
