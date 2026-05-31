import type { AppSettings } from '../../../domain/settings/settingsTypes';
import type { TaskDraftState } from '../createTaskTypes';
import {
  backlogOptions,
  bucketOptions,
  effortOptions,
  getChoiceClass,
  getDomainOptionClass,
  getProjectOptionClass,
  priorityOptions,
  sourceOptions,
  addDaysISO,
} from '../createTaskUtils';
import { compactSectionTitle } from '../createTaskHelpers';

interface TaskFormPanelProps {
  taskDraft: TaskDraftState;
  updateTaskDraft: <K extends keyof TaskDraftState>(key: K, value: TaskDraftState[K]) => void;
  todayISO: string;
  activeProjects: NonNullable<AppSettings['projects']>;
  activeDomains: NonNullable<AppSettings['domains']>;
  tagOptions: string[];
  suggestedTags: string[];
  onToggleTag: (tag: string) => void;
}

export function TaskFormPanel({
  taskDraft,
  updateTaskDraft,
  todayISO,
  activeProjects,
  activeDomains,
  tagOptions,
  suggestedTags,
  onToggleTag,
}: TaskFormPanelProps) {
  const chosenProjectName = activeProjects.find((p) => p.id === taskDraft.projectId)?.name ?? 'לא נבחר';
  const chosenDomainName = activeDomains.find((d) => d.id === taskDraft.domainId)?.name ?? 'לא נבחר';
  const tomorrowISO = addDaysISO(todayISO, 1);
  const quickDateButtonClass = (isActive: boolean) =>
    `rounded-2xl px-3 py-2 text-xs font-black ring-1 transition ${
      isActive ? 'bg-slate-950 text-white ring-slate-950' : 'bg-slate-50 text-slate-700 ring-slate-200 hover:bg-white'
    }`;

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="field-card md:col-span-2 bg-white">
              <span>שם משימת־על</span>
              <input
                value={taskDraft.title}
                onChange={(e) => updateTaskDraft('title', e.target.value)}
                placeholder="מה צריך לקרות?"
              />
            </label>
            <label className="field-card bg-white">
              <span>תאריך</span>
              <input type="date" value={taskDraft.date} onChange={(e) => updateTaskDraft('date', e.target.value)} />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={quickDateButtonClass(taskDraft.date === todayISO)} onClick={() => updateTaskDraft('date', todayISO)}>
                  היום
                </button>
                <button type="button" className={quickDateButtonClass(taskDraft.date === tomorrowISO)} onClick={() => updateTaskDraft('date', tomorrowISO)}>
                  מחר
                </button>
              </div>
            </label>
            <label className="field-card bg-white">
              <span>תווית זמן</span>
              <input
                value={taskDraft.scheduledTimeLabel}
                onChange={(e) => updateTaskDraft('scheduledTimeLabel', e.target.value)}
                placeholder="עכשיו / מחר בבוקר / 13:30"
              />
            </label>
            <label className="field-card bg-white">
              <span>משך משוער בדקות</span>
              <input
                type="number"
                min={15}
                step={15}
                value={taskDraft.estimatedDurationMinutes}
                onChange={(e) => updateTaskDraft('estimatedDurationMinutes', e.target.value)}
              />
            </label>
            <label className="field-card bg-white">
              <span>למה עכשיו?</span>
              <input value={taskDraft.whyNow} onChange={(e) => updateTaskDraft('whyNow', e.target.value)} />
            </label>
            <label className="field-card md:col-span-2 bg-white">
              <span>AI conversation link</span>
              <input
                className="ltr text-left"
                value={taskDraft.aiConversationUrl}
                onChange={(e) => updateTaskDraft('aiConversationUrl', e.target.value)}
                placeholder="https://chatgpt.com/c/... או https://claude.ai/chat/..."
              />
            </label>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
          <div className="grid gap-3">
            <div>
              {compactSectionTitle('מיקום במשימות')}
              <div className="flex flex-wrap gap-2">
                {bucketOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={getChoiceClass(taskDraft.bucket === opt.value, opt.className)}
                    onClick={() => updateTaskDraft('bucket', opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {taskDraft.bucket === 'backlog' ? (
              <div>
                {compactSectionTitle('קבוצת Backlog')}
                <div className="flex flex-wrap gap-2">
                  {backlogOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={getChoiceClass(taskDraft.backlogGroup === opt.value, opt.className)}
                      onClick={() => updateTaskDraft('backlogGroup', opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              {compactSectionTitle('עדיפות')}
              <div className="flex flex-wrap gap-2">
                {priorityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={getChoiceClass(taskDraft.priority === opt.value, opt.className)}
                    onClick={() => updateTaskDraft('priority', opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              {compactSectionTitle('מאמץ', taskDraft.effort === 'quick' ? 'קלילה = Quick Win' : undefined)}
              <div className="flex flex-wrap gap-2">
                {effortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={getChoiceClass(taskDraft.effort === opt.value, opt.className)}
                    onClick={() => updateTaskDraft('effort', opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              {compactSectionTitle('מקור')}
              <div className="flex flex-wrap gap-2">
                {sourceOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={getChoiceClass(taskDraft.source === opt.value, opt.className)}
                    onClick={() => updateTaskDraft('source', opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
        {compactSectionTitle('פרויקט ותחום', `${chosenProjectName} / ${chosenDomainName}`)}
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">פרויקט</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {activeProjects.map((project, i) => (
                <button
                  key={project.id}
                  type="button"
                  className={getChoiceClass(taskDraft.projectId === project.id, getProjectOptionClass(i))}
                  onClick={() => updateTaskDraft('projectId', project.id)}
                >
                  {project.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">תחום</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {activeDomains.map((domain, i) => (
                <button
                  key={domain.id}
                  type="button"
                  className={getChoiceClass(taskDraft.domainId === domain.id, getDomainOptionClass(i))}
                  onClick={() => updateTaskDraft('domainId', domain.id)}
                >
                  {domain.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
        {suggestedTags.length > 0 ? (
          <div className="mb-3 rounded-2xl bg-white p-3 ring-1 ring-emerald-100">
            {compactSectionTitle('תגיות מומלצות', 'לפי הכותרת, הטקסט והתחום')}
            <div className="flex flex-wrap gap-2">
              {suggestedTags.map((tag, i) => (
                <button
                  key={tag}
                  type="button"
                  className={getChoiceClass(false, getDomainOptionClass(i))}
                  onClick={() => onToggleTag(tag)}
                >
                  + #{tag}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {compactSectionTitle('תגיות', 'בחירה מרובה')}
        <div className="mission-chip-strip flex flex-wrap gap-1.5 pr-1">
          {tagOptions.map((tag, i) => (
            <button
              key={tag}
              type="button"
              className={getChoiceClass(taskDraft.tags.includes(tag), getDomainOptionClass(i))}
              onClick={() => onToggleTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
