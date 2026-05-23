import type { AppSettings } from '../../../domain/settings/settingsTypes';
import type { ScheduleDraftState } from '../createTaskTypes';
import { getChoiceClass, getDomainOptionClass, getProjectOptionClass } from '../createTaskUtils';

interface SchedulePanelProps {
  scheduleDraft: ScheduleDraftState;
  updateScheduleDraft: <K extends keyof ScheduleDraftState>(key: K, value: ScheduleDraftState[K]) => void;
  activeProjects: NonNullable<AppSettings['projects']>;
  activeDomains: NonNullable<AppSettings['domains']>;
  errorMessage: string;
  statusMessage: string;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
}

export function SchedulePanel({
  scheduleDraft,
  updateScheduleDraft,
  activeProjects,
  activeDomains,
  errorMessage,
  statusMessage,
  isSaving,
  onSave,
  onCancel,
  onReset,
}: SchedulePanelProps) {
  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="field-card lg:col-span-2">
          <span>כותרת לו״ז</span>
          <input
            value={scheduleDraft.title}
            onChange={(e) => updateScheduleDraft('title', e.target.value)}
            placeholder="פגישה / שיחה / נסיעה"
          />
        </label>
        <label className="field-card">
          <span>תאריך</span>
          <input type="date" value={scheduleDraft.date} onChange={(e) => updateScheduleDraft('date', e.target.value)} />
        </label>
        <label className="field-card">
          <span>מיקום</span>
          <input value={scheduleDraft.location} onChange={(e) => updateScheduleDraft('location', e.target.value)} />
        </label>
        <label className="field-card">
          <span>שעת התחלה</span>
          <input type="time" value={scheduleDraft.startTime} onChange={(e) => updateScheduleDraft('startTime', e.target.value)} />
        </label>
        <label className="field-card">
          <span>שעת סיום</span>
          <input type="time" value={scheduleDraft.endTime} onChange={(e) => updateScheduleDraft('endTime', e.target.value)} />
        </label>

        <div className="field-card lg:col-span-2">
          <span>פרויקט</span>
          <div className="flex flex-wrap gap-2">
            {activeProjects.map((project, i) => (
              <button
                key={project.id}
                type="button"
                className={getChoiceClass(scheduleDraft.projectId === project.id, getProjectOptionClass(i))}
                onClick={() => updateScheduleDraft('projectId', project.id)}
              >
                {project.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field-card lg:col-span-2">
          <span>תחום</span>
          <div className="flex flex-wrap gap-2">
            {activeDomains.map((domain, i) => (
              <button
                key={domain.id}
                type="button"
                className={getChoiceClass(scheduleDraft.domainId === domain.id, getDomainOptionClass(i))}
                onClick={() => updateScheduleDraft('domainId', domain.id)}
              >
                {domain.name}
              </button>
            ))}
          </div>
        </div>

        <label className="field-card lg:col-span-2">
          <span>הערות</span>
          <textarea rows={4} value={scheduleDraft.notes} onChange={(e) => updateScheduleDraft('notes', e.target.value)} />
        </label>
      </div>

      <div className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-100">
        כרגע זה יתווסף כמשימת לו״ז מקומית. חיבור אמיתי ל־Google Calendar יגיע רק אחרי שנבחר שיטת הרשאות בטוחה.
      </div>

      {errorMessage || statusMessage ? (
        <p className={`text-sm font-bold ${errorMessage ? 'text-rose-700' : 'text-emerald-700'}`}>
          {errorMessage || statusMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700" onClick={onCancel}>
          ביטול
        </button>
        <button type="button" className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700" onClick={onReset}>
          נקה טופס
        </button>
        <button
          type="button"
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? 'שומר...' : 'הוסף לו״ז'}
        </button>
      </div>
    </div>
  );
}
