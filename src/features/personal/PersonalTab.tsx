import { SectionCard } from '../../components/layout/SectionCard';
import { RecurringTab } from '../recurring/RecurringTab';
import { HabitsSection } from './HabitsSection';
import { AdherenceSection } from './AdherenceSection';
import type { DailyHabit, DailyHabitLog } from '../../domain/habits/habitTypes';
import type { RecurringTaskDefinition } from '../../domain/recurring/recurringTypes';
import type { Reminder } from '../../domain/reminders/reminderTypes';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import type { Task } from '../../domain/tasks/taskTypes';

interface PersonalTabProps {
  habits: DailyHabit[];
  habitLogs: DailyHabitLog[];
  onAddHabit: (input: { title: string; unit: string; targetCount: number }) => Promise<void>;
  onEditHabit: (habitId: string, patch: { title?: string; unit?: string; targetCount?: number; active?: boolean }) => Promise<void>;
  onDeleteHabit: (habitId: string) => Promise<void>;
  onNudgeHabit: (habitId: string, date: string, delta: number) => Promise<void>;
  recurringDefinitions: RecurringTaskDefinition[];
  tasks: Task[];
  onAddRecurringToToday: (definitionId: string) => Promise<void>;
  onClearRecurringDefinitions: () => Promise<number>;
  onImportRecurringDefinitions: (payload: unknown) => Promise<number>;
  reminders: Reminder[];
  settings: AppSettings | null;
  todayISO: string;
  isSaving?: boolean;
}

export function PersonalTab({
  habits, habitLogs,
  onAddHabit, onEditHabit, onDeleteHabit, onNudgeHabit,
  recurringDefinitions, tasks, onAddRecurringToToday, onClearRecurringDefinitions, onImportRecurringDefinitions,
  reminders, settings, todayISO, isSaving,
}: PersonalTabProps) {
  const pendingReminders = reminders
    .filter((r) => r.status === 'pending')
    .sort((a, b) => a.remindAt.localeCompare(b.remindAt))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <HabitsSection
        habits={habits}
        habitLogs={habitLogs}
        todayISO={todayISO}
        isSaving={isSaving}
        onNudge={onNudgeHabit}
        onAdd={onAddHabit}
        onEdit={onEditHabit}
        onDelete={onDeleteHabit}
      />

      <RecurringTab
        recurringDefinitions={recurringDefinitions}
        tasks={tasks}
        settings={settings}
        todayISO={todayISO}
        isSaving={isSaving}
        onAddToToday={onAddRecurringToToday}
        onClearAll={onClearRecurringDefinitions}
        onImportFromJson={onImportRecurringDefinitions}
      />

      {pendingReminders.length > 0 && (
        <SectionCard title="תזכורות ממתינות" description="עד 5 הקרובות — לניהול מלא עבור לטאב תזכורות">
          <ul className="space-y-2">
            {pendingReminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                <div>
                  <p className="font-black text-slate-900 leading-tight">{r.title}</p>
                  {r.note && <p className="mt-0.5 text-xs text-slate-500">{r.note}</p>}
                </div>
                <span className="shrink-0 text-xs font-bold text-slate-400 tabular-nums">
                  {r.remindAt.slice(11, 16)}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <AdherenceSection
        habits={habits}
        habitLogs={habitLogs}
        todayISO={todayISO}
      />
    </div>
  );
}
