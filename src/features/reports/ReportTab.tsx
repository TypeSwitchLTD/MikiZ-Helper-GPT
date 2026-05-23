import { useMemo, useState } from 'react';
import { SectionCard } from '../../components/layout/SectionCard';
import {
  getImportSectionLabel,
  parseDailyReportImport,
  type DailyReportImportPreview,
  type DailyReportImportTaskDraft,
} from '../../domain/import/dailyReportImport';
import type { DailyReport } from '../../domain/reports/reportTypes';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import type { Task } from '../../domain/tasks/taskTypes';

interface ReportTabProps {
  reports: DailyReport[];
  tasks: Task[];
  settings: AppSettings | null;
  todayISO: string;
  isSaving?: boolean;
  onImportReportTasks: (drafts: DailyReportImportTaskDraft[]) => Promise<void> | void;
  onDeleteLastImport?: () => Promise<{ deletedTasks: number; deletedSubtasks: number }> | void;
}

function getBadgeClass(section: DailyReportImportTaskDraft['section']): string {
  const classes: Record<DailyReportImportTaskDraft['section'], string> = {
    completed: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    in_progress: 'bg-amber-50 text-amber-800 ring-amber-100',
    tomorrow: 'bg-sky-50 text-sky-800 ring-sky-100',
    weekly: 'bg-violet-50 text-violet-800 ring-violet-100',
    backlog: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
  return classes[section];
}

function getProjectName(settings: AppSettings | null, projectId: string): string {
  return settings?.projects.find((project) => project.id === projectId)?.name ?? projectId;
}

function getDomainName(settings: AppSettings | null, domainId: string): string {
  return settings?.domains.find((domain) => domain.id === domainId)?.name ?? domainId;
}

function getImportTaskKey(task: DailyReportImportTaskDraft): string {
  return `${task.importId}-${task.title}`;
}

function createEmptySelection(preview: DailyReportImportPreview | null): Record<string, boolean> {
  if (!preview) return {};
  return Object.fromEntries(preview.tasks.map((task) => [getImportTaskKey(task), task.selectedByDefault]));
}

const sampleReport = `Daily Report - 08/05/2026

Completed:
- Website — להוסיף הצעה + kit לעמוד TimerAligner (100%)
- Website Fixes — כסף ומובייל קודם (100%)

In Progress:
- AlignersWorld — להוסיף מחקר חדש ולפרסם בלינקדאין (0%)
- אישי — Partner user + Netflix + ביטול UPay/PayMe (50%)

Not Started / Tomorrow:
- Apollo — סיכום איכות שווקים + המשך בנייה (0%)
- Instagram — להגיע ל-150 following איכותיים (0%)
- סגירת יום — דוח יומי ושמירת מצב למחר (0%)
- Invisalign Doctor Locator — החלטת אסטרטגיית לידים (0%)

Weekly:
- עדכון תזרים קצר (0%)

Backlog:
- Shopify — מדרגות קנייה + צבעים למוצר TimerAligner (0%)
- TypeSwitch — פטנט, יעקב, מעצב/מפתח וסבטלנה (0%)
- Mission Control — Backend + DB + Logs + Supabase (0%)
- Jack — סיכום הערות לדגם נוכחי + בקשת דגם שני (0%)

Notes:
- Invisalign list collected: 511 clinics from 2 countries
- Apollo snapshot kept in HTML`;

export function ReportTab({ reports, tasks, settings, todayISO, isSaving = false, onImportReportTasks, onDeleteLastImport }: ReportTabProps) {
  const [reportText, setReportText] = useState('');
  const [targetDate, setTargetDate] = useState(todayISO);
  const [preview, setPreview] = useState<DailyReportImportPreview | null>(null);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [mergeTargets, setMergeTargets] = useState<Record<string, string | null>>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const selectedTasks = useMemo(() => {
    if (!preview) return [];
    return preview.tasks
      .filter((task) => selection[getImportTaskKey(task)])
      .map((task) => ({ ...task, mergeTargetTaskId: mergeTargets[getImportTaskKey(task)] ?? null }));
  }, [mergeTargets, preview, selection]);

  const parseReport = (textOverride?: string) => {
    const textToParse = textOverride ?? reportText;
    if (!textToParse.trim()) {
      setErrorMessage('הדבק Daily Report לפני בדיקה.');
      setStatusMessage('');
      return;
    }

    const nextPreview = parseDailyReportImport(textToParse, {
      settings,
      existingTasks: tasks,
      targetDate,
    });

    setPreview(nextPreview);
    setSelection(createEmptySelection(nextPreview));
    setMergeTargets({});
    setStatusMessage(`מצאתי ${nextPreview.tasks.length} משימות. ${nextPreview.summary.possibleDuplicates} מסומנות כחשודות לכפילות.`);
    setErrorMessage('');
  };

  const fillSample = () => {
    setReportText(sampleReport);
    const nextPreview = parseDailyReportImport(sampleReport, { settings, existingTasks: tasks, targetDate });
    setPreview(nextPreview);
    setSelection(createEmptySelection(nextPreview));
    setMergeTargets({});
    setStatusMessage('הכנסתי דוגמת דוח לבדיקה מהירה.');
    setErrorMessage('');
  };

  const toggleTaskSelection = (task: DailyReportImportTaskDraft) => {
    const key = getImportTaskKey(task);
    setSelection((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleAll = (value: boolean) => {
    if (!preview) return;
    setSelection(Object.fromEntries(preview.tasks.map((task) => [getImportTaskKey(task), value])));
    if (!value) setMergeTargets({});
  };

  const setImportMode = (task: DailyReportImportTaskDraft, mode: 'new' | 'skip' | { mergeToTaskId: string }) => {
    const key = getImportTaskKey(task);
    if (mode === 'skip') {
      setSelection((current) => ({ ...current, [key]: false }));
      setMergeTargets((current) => ({ ...current, [key]: null }));
      return;
    }

    setSelection((current) => ({ ...current, [key]: true }));
    setMergeTargets((current) => ({
      ...current,
      [key]: mode === 'new' ? null : mode.mergeToTaskId,
    }));
  };

  const importSelected = async () => {
    if (!selectedTasks.length) {
      setErrorMessage('לא נבחרו משימות לייבוא.');
      return;
    }

    await onImportReportTasks(selectedTasks);
    setStatusMessage(`ייבאתי ${selectedTasks.length} משימות ל־IndexedDB.`);
    setErrorMessage('');
    setPreview(null);
    setSelection({});
    setMergeTargets({});
    setReportText('');
  };


  const deleteLastImport = async () => {
    if (!onDeleteLastImport) return;
    const confirmed = window.confirm('למחוק את כל המשימות שנוצרו בייבוא האחרון? זה מיועד לתיקון יבוא שגוי.');
    if (!confirmed) return;
    const result = await onDeleteLastImport();
    if (result) setStatusMessage(`נמחק הייבוא האחרון: ${result.deletedTasks} משימות ו-${result.deletedSubtasks} תתי-משימות.`);
    setErrorMessage('');
  };

  return (
    <div className="space-y-5">
      <SectionCard title="דוח" description="ייבוא דוח יומי והכנה לדוחות יומיים מלאים ב־Phase 5.">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <section className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950">ייבוא Daily Report</h3>
                <p className="mt-1 text-sm text-slate-600">
                  הדבק סיכום יום. המערכת תזהה סעיפים, תציע תגיות, תסמן כפילויות, ותייבא רק אחרי אישור שלך.
                </p>
              </div>
              <label className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                תאריך יעד למשימות Tomorrow
                <input className="mt-1 w-full bg-transparent text-sm" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
              </label>
            </div>

            <textarea
              className="mt-4 min-h-72 w-full rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              value={reportText}
              onChange={(event) => setReportText(event.target.value)}
              placeholder="Daily Report - 08/05/2026\n\nCompleted:\n- ...\n\nIn Progress:\n- ...\n\nNot Started / Tomorrow:\n- ..."
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white" onClick={() => parseReport()}>
                בדוק וסדר דוח
              </button>
              <button type="button" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200" onClick={fillSample}>
                מלא דוגמה לבדיקה
              </button>
              <button type="button" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200" onClick={() => { setReportText(''); setPreview(null); setSelection({}); setMergeTargets({}); }}>
                נקה
              </button>
              <button type="button" className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 ring-1 ring-rose-100 disabled:opacity-50" disabled={!onDeleteLastImport || isSaving} onClick={() => void deleteLastImport()}>
                מחק ייבוא אחרון
              </button>
            </div>

            {statusMessage ? <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">{statusMessage}</p> : null}
            {errorMessage ? <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800 ring-1 ring-rose-100">{errorMessage}</p> : null}
          </section>

          <aside className="space-y-3">
            <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
              <h3 className="text-lg font-black text-slate-950">מצב דוחות</h3>
              <p className="mt-2 text-sm text-slate-600">משימות מקומיות כרגע: {tasks.length}</p>
              <p className="mt-1 text-sm text-slate-600">דוחות שמורים כרגע: {reports.length}</p>
              <p className="mt-3 text-xs font-bold text-slate-500">
                יצירת דוח מלאה, עריכה, שמירה ו־Copy יגיעו ב־Phase 5. הייבוא כאן נועד להכניס את סיכומי ה־HTML למערכת החדשה.
              </p>
            </div>

            {preview ? (
              <div className="rounded-3xl bg-gradient-to-br from-sky-50 to-emerald-50 p-4 ring-1 ring-sky-100">
                <h3 className="text-lg font-black text-slate-950">סיכום Preview</h3>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-white/80 p-3"><dt className="text-slate-500">נמצאו</dt><dd className="text-xl font-black">{preview.summary.total}</dd></div>
                  <div className="rounded-2xl bg-white/80 p-3"><dt className="text-slate-500">ייבוא כברירת מחדל</dt><dd className="text-xl font-black">{preview.summary.selectedByDefault}</dd></div>
                  <div className="rounded-2xl bg-white/80 p-3"><dt className="text-slate-500">כפילויות חשודות</dt><dd className="text-xl font-black">{preview.summary.possibleDuplicates}</dd></div>
                  <div className="rounded-2xl bg-white/80 p-3"><dt className="text-slate-500">נבחרו עכשיו</dt><dd className="text-xl font-black">{selectedTasks.length}</dd></div>
                </dl>
                {preview.leadSnapshot.lines.length > 0 ? (
                  <div className="mt-3 rounded-2xl bg-white/80 p-3 text-xs text-slate-600 ring-1 ring-white">
                    <p className="font-black text-slate-800">Lead snapshot נשמר</p>
                    <ul className="mt-1 list-disc space-y-1 pr-5">
                      {preview.leadSnapshot.lines.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      </SectionCard>

      {preview ? (
        <SectionCard title="Preview לפני ייבוא" description="סמן מה להכניס. כפילויות חשודות לא נבחרות אוטומטית אם הדמיון גבוה.">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200" onClick={() => toggleAll(true)}>
                בחר הכל
              </button>
              <button type="button" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200" onClick={() => toggleAll(false)}>
                בטל הכל
              </button>
            </div>
            <button type="button" className="rounded-2xl bg-emerald-500 px-5 py-2 text-sm font-black text-white disabled:opacity-50" disabled={isSaving || selectedTasks.length === 0} onClick={() => void importSelected()}>
              ייבא / מזג {selectedTasks.length} מסומנות
            </button>
          </div>

          <div className="space-y-3">
            {preview.tasks.map((task) => {
              const key = getImportTaskKey(task);
              const isSelected = Boolean(selection[key]);
              const hasDuplicate = task.duplicateCandidates.length > 0;
              const mergeTargetTaskId = mergeTargets[key];
              const mergeTargetTitle = mergeTargetTaskId ? task.duplicateCandidates.find((candidate) => candidate.taskId === mergeTargetTaskId)?.title : null;

              return (
                <article
                  key={key}
                  className={`rounded-3xl p-4 ring-1 transition ${
                    isSelected ? 'bg-white ring-sky-200' : 'bg-slate-50 ring-slate-200 opacity-75'
                  } ${hasDuplicate ? 'border border-amber-200' : ''}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input className="mt-1 h-5 w-5" type="checkbox" checked={isSelected} onChange={() => toggleTaskSelection(task)} />
                      <span className="min-w-0">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${getBadgeClass(task.section)}`}>
                          {getImportSectionLabel(task.section)} {task.percent !== null ? `· ${task.percent}%` : ''}
                        </span>
                        <strong className="mt-2 block text-lg text-slate-950">{task.title}</strong>
                        <span className="mt-1 block text-sm font-bold text-slate-500">
                          {getProjectName(settings, task.projectId)} / {getDomainName(settings, task.domainId)} · {task.scheduledTimeLabel}
                        </span>
                        {mergeTargetTitle ? (
                          <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                            ימוזג לתוך: {mergeTargetTitle}
                          </span>
                        ) : null}
                      </span>
                    </label>

                    <div className="flex flex-wrap gap-1 lg:max-w-sm lg:justify-end">
                      {task.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                      <p className="text-xs font-black text-slate-500">תתי־משימות שייווצרו</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {task.subtasks.map((subtask) => (
                          <li key={`${key}-${subtask.title}`} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
                            <span>{subtask.title}</span>
                            <span className="text-xs font-black text-slate-400">{subtask.status}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className={`rounded-2xl p-3 ring-1 ${hasDuplicate ? 'bg-amber-50 ring-amber-100' : 'bg-emerald-50 ring-emerald-100'}`}>
                      <p className={`text-xs font-black ${hasDuplicate ? 'text-amber-800' : 'text-emerald-800'}`}>
                        {hasDuplicate ? 'כפילויות אפשריות' : 'לא נמצאה כפילות חזקה'}
                      </p>
                      {hasDuplicate ? (
                        <div className="mt-2 space-y-2 text-sm text-amber-900">
                          {task.duplicateCandidates.map((candidate) => (
                            <div key={candidate.taskId} className="rounded-xl bg-white/80 p-2 ring-1 ring-amber-100">
                              <div className="font-bold">{candidate.title} — {Math.round(candidate.score * 100)}%</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="rounded-xl bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100"
                                  onClick={() => setImportMode(task, { mergeToTaskId: candidate.taskId })}
                                >
                                  מזג כתת־משימה
                                </button>
                                <button
                                  type="button"
                                  className="rounded-xl bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200"
                                  onClick={() => setImportMode(task, 'new')}
                                >
                                  ייבא כחדשה
                                </button>
                                <button
                                  type="button"
                                  className="rounded-xl bg-rose-50 px-3 py-1 text-xs font-black text-rose-700 ring-1 ring-rose-100"
                                  onClick={() => setImportMode(task, 'skip')}
                                >
                                  דלג
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-emerald-800">נבחר לייבוא כברירת מחדל.</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
