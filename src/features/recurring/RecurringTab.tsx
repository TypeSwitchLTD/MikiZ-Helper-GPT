import { useMemo, useRef, useState } from 'react';
import { SectionCard } from '../../components/layout/SectionCard';
import type { RecurringTaskDefinition } from '../../domain/recurring/recurringTypes';
import { buildRecurringViewModels, getRecurringStateLabel } from '../../domain/recurring/recurringSchedule';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import type { Task } from '../../domain/tasks/taskTypes';
import { recurrenceLabels } from '../../utils/hebrewLabels';

interface RecurringTabProps {
  recurringDefinitions: RecurringTaskDefinition[];
  tasks: Task[];
  settings: AppSettings | null;
  todayISO: string;
  isSaving?: boolean;
  onAddToToday: (definitionId: string) => Promise<void> | void;
  onClearAll?: () => Promise<number>;
  onImportFromJson?: (payload: unknown) => Promise<number>;
}

const stateBadgeClasses = {
  due_today: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  already_added_today: 'bg-sky-50 text-sky-700 ring-sky-100',
  missed: 'bg-amber-50 text-amber-700 ring-amber-100',
  not_due_today: 'bg-slate-50 text-slate-600 ring-slate-200',
} as const;

export function RecurringTab({
  recurringDefinitions,
  tasks,
  settings,
  todayISO,
  isSaving,
  onAddToToday,
  onClearAll,
  onImportFromJson,
}: RecurringTabProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState('');
  const viewModels = useMemo(
    () => buildRecurringViewModels(recurringDefinitions, tasks, todayISO),
    [recurringDefinitions, tasks, todayISO],
  );

  const dueCount = viewModels.filter((item) => item.state === 'due_today').length;
  const missedCount = viewModels.filter((item) => item.state === 'missed').length;

  const handleClearAll = async () => {
    if (!onClearAll) return;
    const ok = window.confirm('למחוק את כל הגדרות המשימות החוזרות הישנות? המשימות הרגילות לא יימחקו.');
    if (!ok) return;
    setStatus('מוחק הגדרות חוזרות...');
    const count = await onClearAll();
    setStatus(`נמחקו ${count} הגדרות חוזרות וסונכרן לענן.`);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file || !onImportFromJson) return;
    setStatus('קורא וממיר קובץ חוזרות...');
    try {
      const payload = JSON.parse(await file.text());
      const count = await onImportFromJson(payload);
      setStatus(`יובאו ${count} הגדרות חוזרות חדשות וסונכרנו לענן.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'ייבוא החוזרות נכשל.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <SectionCard
        title="שבועי / חוזר"
        description="ניהול הגדרות חוזרות בלי מנוע RRULE כבד. כרגע הוספה להיום היא פעולה ידנית ובטוחה."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
            <p className="text-sm font-bold text-emerald-700">מומלצות להיום</p>
            <p className="mt-1 text-3xl font-black text-emerald-900">{dueCount}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
            <p className="text-sm font-bold text-amber-700">לא טופלו לאחרונה</p>
            <p className="mt-1 text-3xl font-black text-amber-900">{missedCount}</p>
          </div>
          <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100">
            <p className="text-sm font-bold text-sky-700">הגדרות פעילות</p>
            <p className="mt-1 text-3xl font-black text-sky-900">{viewModels.length}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="הגדרות חוזרות"
        description="לחיצה על הוספה להיום יוצרת מופע משימה רגיל עם תתי־משימות ב־Today."
        action={
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void handleImportFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={isSaving || !onImportFromJson}
              className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
              onClick={() => fileInputRef.current?.click()}
            >
              איפוס וייבוא JSON
            </button>
            <button
              type="button"
              disabled={isSaving || !onClearAll || viewModels.length === 0}
              className="rounded-2xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100 disabled:opacity-50"
              onClick={() => void handleClearAll()}
            >
              מחק חוזרות
            </button>
          </div>
        }
      >
        {status ? (
          <p className="mb-3 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 ring-1 ring-emerald-100">
            {status}
          </p>
        ) : null}

        {viewModels.length === 0 ? (
          <p className="text-sm text-slate-500">אין הגדרות חוזרות פעילות.</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {viewModels.map(({ definition, state, alreadyAddedToday, lastGeneratedDate }) => (
              <article key={definition.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-slate-950">{definition.title}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${stateBadgeClasses[state]}`}>
                        {getRecurringStateLabel(state)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {settings?.projects.find((project) => project.id === definition.projectId)?.name ?? definition.projectId} ·{' '}
                      {settings?.domains.find((domain) => domain.id === definition.domainId)?.name ?? definition.domainId}
                    </p>
                    {lastGeneratedDate ? <p className="mt-1 text-xs text-slate-400">נוסף לאחרונה: {lastGeneratedDate}</p> : null}
                  </div>

                  <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                    {recurrenceLabels[definition.frequency]}
                  </span>
                </div>

                {definition.preferredTimingNote ? <p className="mt-3 text-sm text-slate-600">{definition.preferredTimingNote}</p> : null}

                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {definition.defaultSubtasks.map((subtask) => (
                    <li key={`${definition.id}-${subtask.sortOrder}`} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                      <span className="font-bold text-slate-800">{subtask.title}</span>
                      {subtask.estimatedDurationMinutes ? <span className="text-slate-400"> · {subtask.estimatedDurationMinutes} דק׳</span> : null}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isSaving || alreadyAddedToday}
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    onClick={() => void onAddToToday(definition.id)}
                  >
                    {alreadyAddedToday ? 'כבר נוסף להיום' : 'הוסף להיום'}
                  </button>
                  <span className="text-xs text-slate-400">יצירת/עריכת הגדרות חוזרות חדשות תגיע בשלב Add Task.</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
