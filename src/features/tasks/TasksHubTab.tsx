import { useMemo, useState } from "react";
import { SectionCard } from "../../components/layout/SectionCard";
import { ReadOnlyTaskCard } from "../../components/task/ReadOnlyTaskCard";
import type { Reminder } from "../../domain/reminders/reminderTypes";
import type { AppSettings } from "../../domain/settings/settingsTypes";
import { getTaskProgress } from "../../domain/tasks/taskProgress";
import type { BacklogGroup, Subtask, Task } from "../../domain/tasks/taskTypes";

type TaskFilterId =
  | "relevant"
  | "today"
  | "tomorrow"
  | "this_week"
  | "waiting"
  | "later"
  | "quick"
  | "backlog"
  | "recurring"
  | "done"
  | "cancelled";

interface TasksHubTabProps {
  tasks: Task[];
  subtasks: Subtask[];
  reminders: Reminder[];
  settings: AppSettings | null;
  todayISO: string;
  isSaving?: boolean;
  focusedTaskId?: string | null;
  onChangeSubtaskStatus: (
    subtaskId: string,
    status: Subtask["status"],
  ) => Promise<void> | void;
  onMoveToTomorrow: (task: Task) => Promise<void> | void;
  onMoveToBacklogGroup?: (task: Task, backlogGroup: BacklogGroup) => Promise<void> | void;
  onChangeTaskDate: (task: Task, targetDate: string) => Promise<void> | void;
  onCancelTask: (taskId: string) => Promise<void> | void;
  onUpdateTaskText: (
    taskId: string,
    patch: { title?: string; whyNow?: string; notes?: string; aiConversationUrl?: string | null },
  ) => Promise<void> | void;
  onUpdateSubtaskText: (
    subtaskId: string,
    patch: { title?: string; notes?: string; aiConversationUrl?: string | null },
  ) => Promise<void> | void;
  onUpdateTaskDetails: (
    taskId: string,
    patch: {
      projectId?: string;
      domainId?: string;
      priority?: Task["priority"];
      effort?: Task["effort"];
      tags?: string[];
    },
  ) => Promise<void> | void;
  onAddSubtaskToTask: (input: {
    taskId: string;
    title: string;
    notes?: string;
    aiConversationUrl?: string | null;
  }) => Promise<void> | void;
  onReorderTaskFocus?: (
    taskId: string,
    action: "first" | "up" | "down" | "bottom",
  ) => Promise<void> | void;
  onAddReminder?: (input: {
    taskId: string;
    subtaskId?: string | null;
    title: string;
    date: string;
    time: string;
    note?: string;
  }) => Promise<void> | void;
  quietMode?: boolean;
  onToggleQuietMode?: () => void;
  onOpenFocusTimer?: () => void;
  onAddTaskToFocus?: (taskId: string) => Promise<void> | void;
  onAddSubtaskToFocus?: (taskId: string, subtaskId: string) => Promise<void> | void;
}


function compareFocus(a: Task, b: Task): number {
  const aOrder = typeof a.focusOrder === "number" ? a.focusOrder : null;
  const bOrder = typeof b.focusOrder === "number" ? b.focusOrder : null;
  if (aOrder !== null && bOrder !== null && aOrder !== bOrder)
    return aOrder - bOrder;
  if (aOrder !== null && bOrder === null) return -1;
  if (aOrder === null && bOrder !== null) return 1;
  const priorityScore = (task: Task) =>
    task.priority === "high" ? 0 : task.priority === "medium" ? 1 : 2;
  const dateScore = (task: Task) =>
    task.date
      ? Date.parse(`${task.date}T12:00:00`) || Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER;
  return (
    priorityScore(a) - priorityScore(b) ||
    dateScore(a) - dateScore(b) ||
    (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) ||
    a.title.localeCompare(b.title)
  );
}

function getProjectName(
  settings: AppSettings | null,
  task: Task,
): string | undefined {
  return settings?.projects.find((project) => project.id === task.projectId)
    ?.name;
}

function getDomainName(
  settings: AppSettings | null,
  task: Task,
): string | undefined {
  return settings?.domains.find((domain) => domain.id === task.domainId)?.name;
}

const TASK_GROUP_META: Record<string, { label: string; dotColor: string; headerColor: string; borderColor: string }> = {
  today:       { label: 'היום',    dotColor: 'bg-sky-400',     headerColor: 'text-sky-700',     borderColor: 'border-sky-200' },
  in_progress: { label: 'בתהליך', dotColor: 'bg-violet-400',  headerColor: 'text-violet-700',  borderColor: 'border-violet-200' },
  quick:       { label: 'קלילים', dotColor: 'bg-emerald-400', headerColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
  backlog:     { label: 'בקלוג',  dotColor: 'bg-slate-400',   headerColor: 'text-slate-600',   borderColor: 'border-slate-200' },
};

const BACKLOG_GROUP_META: Record<string, { label: string; dotColor: string; headerColor: string; borderColor: string }> = {
  tomorrow:  { label: 'מחר',   dotColor: 'bg-cyan-400',  headerColor: 'text-cyan-700',  borderColor: 'border-cyan-200' },
  this_week: { label: 'השבוע', dotColor: 'bg-blue-400',  headerColor: 'text-blue-700',  borderColor: 'border-blue-200' },
  waiting:   { label: 'ממתין', dotColor: 'bg-amber-400', headerColor: 'text-amber-700', borderColor: 'border-amber-200' },
  later:     { label: 'בהמשך', dotColor: 'bg-slate-400', headerColor: 'text-slate-600', borderColor: 'border-slate-200' },
};

function getTaskGroup(task: Task, subtasks: Subtask[], todayISO: string): string {
  if (task.bucket === 'today' || task.date === todayISO) return 'today';
  const progress = getTaskProgress(task, subtasks);
  if (progress.startedCount > 0 || progress.status === 'in_progress') return 'in_progress';
  if (task.isQuickWin) return 'quick';
  if (task.bucket === 'backlog' && task.backlogGroup) return task.backlogGroup;
  return 'backlog';
}

function groupTasks(
  tasks: Task[],
  subtasks: Subtask[],
  todayISO: string,
  order: string[],
): Array<{ groupId: string; tasks: Task[] }> {
  const grouped: Record<string, Task[]> = { today: [], in_progress: [], quick: [], tomorrow: [], this_week: [], waiting: [], later: [], backlog: [] };
  tasks.forEach((task) => {
    const g = getTaskGroup(task, subtasks, todayISO);
    grouped[g].push(task);
  });
  return Array.from(new Set([...order, 'tomorrow', 'this_week', 'waiting', 'later', 'backlog']))
    .map((id) => ({ groupId: id, tasks: grouped[id] ?? [] }))
    .filter((g) => g.tasks.length > 0);
}

function taskHasUpcomingReminder(task: Task, reminders: Reminder[]): boolean {
  return reminders.some(
    (reminder) => reminder.status === "pending" && reminder.taskId === task.id,
  );
}

function averageDuration(tasks: Task[]): number {
  const values = tasks
    .map(
      (task) =>
        task.estimatedDurationMinutes ??
        (task.effort === "quick" ? 10 : task.effort === "medium" ? 30 : 60),
    )
    .filter(Boolean);
  if (!values.length) return 0;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function remainingAverage(tasks: Task[], subtasks: Subtask[]): number {
  const open = tasks.filter((task) => {
    const progress = getTaskProgress(task, subtasks);
    return progress.status !== "done" && progress.status !== "cancelled";
  });
  if (!open.length) return 0;
  const remaining = open.map(
    (task) => 100 - getTaskProgress(task, subtasks).percent,
  );
  return Math.round(
    remaining.reduce((sum, value) => sum + value, 0) / remaining.length,
  );
}

function getRelevantTasks(
  tasks: Task[],
  subtasks: Subtask[],
  _reminders: Reminder[],
  _todayISO: string,
): Task[] {
  return tasks
    .filter((task) => {
      const progress = getTaskProgress(task, subtasks);
      return (
        progress.status !== "cancelled" &&
        progress.status !== "done" &&
        task.statusOverride !== "cancelled"
      );
    })
    .sort(compareFocus);
}

function filterTasks(
  filter: TaskFilterId,
  tasks: Task[],
  subtasks: Subtask[],
  reminders: Reminder[],
  todayISO: string,
): Task[] {
  switch (filter) {
    case "relevant":
      return getRelevantTasks(tasks, subtasks, reminders, todayISO);
    case "today":
      return tasks
        .filter(
          (task) =>
            task.bucket === "today" &&
            task.date === todayISO &&
            getTaskProgress(task, subtasks).status !== "done" &&
            task.statusOverride !== "cancelled",
        )
        .sort(compareFocus);
    case "tomorrow":
    case "this_week":
    case "waiting":
    case "later":
      return tasks
        .filter(
          (task) =>
            task.bucket === "backlog" &&
            task.backlogGroup === filter &&
            getTaskProgress(task, subtasks).status !== "done" &&
            task.statusOverride !== "cancelled",
        )
        .sort(compareFocus);
    case "quick":
      return tasks
        .filter(
          (task) =>
            task.isQuickWin &&
            getTaskProgress(task, subtasks).status !== "done" &&
            task.statusOverride !== "cancelled",
        )
        .sort(compareFocus);
    case "backlog":
      return tasks
        .filter(
          (task) =>
            task.bucket === "backlog" &&
            getTaskProgress(task, subtasks).status !== "done" &&
            task.statusOverride !== "cancelled",
        )
        .sort(compareFocus);
    case "recurring":
      return tasks
        .filter(
          (task) =>
            task.bucket === "weekly" ||
            task.bucket === "recurring" ||
            task.isRecurring,
        )
        .sort(compareFocus);
    case "done":
      return tasks
        .filter((task) => getTaskProgress(task, subtasks).status === "done")
        .sort(
          (a, b) =>
            (Date.parse(b.completedAt ?? b.updatedAt) || 0) -
            (Date.parse(a.completedAt ?? a.updatedAt) || 0),
        );
    case "cancelled":
      return tasks
        .filter(
          (task) =>
            getTaskProgress(task, subtasks).status === "cancelled" ||
            task.statusOverride === "cancelled",
        )
        .sort(
          (a, b) =>
            (Date.parse(b.cancelledAt ?? b.updatedAt) || 0) -
            (Date.parse(a.cancelledAt ?? a.updatedAt) || 0),
        );
    default:
      return [];
  }
}

export function TasksHubTab({
  tasks,
  subtasks,
  reminders,
  settings,
  todayISO,
  isSaving,
  focusedTaskId,
  onChangeSubtaskStatus,
  onMoveToTomorrow,
  onMoveToBacklogGroup,
  onChangeTaskDate,
  onCancelTask,
  onUpdateTaskText,
  onUpdateSubtaskText,
  onUpdateTaskDetails,
  onAddSubtaskToTask,
  onReorderTaskFocus,
  onAddReminder,
  quietMode: controlledQuietMode,
  onToggleQuietMode,
  onOpenFocusTimer,
  onAddTaskToFocus,
  onAddSubtaskToFocus,
}: TasksHubTabProps) {
  const [activeFilters, setActiveFilters] = useState<TaskFilterId[]>([
    "relevant",
  ]);

  const counts = useMemo(() => {
    const relevant = getRelevantTasks(tasks, subtasks, reminders, todayISO);
    const today = filterTasks("today", tasks, subtasks, reminders, todayISO);
    const tomorrow = filterTasks("tomorrow", tasks, subtasks, reminders, todayISO);
    const thisWeek = filterTasks("this_week", tasks, subtasks, reminders, todayISO);
    const waiting = filterTasks("waiting", tasks, subtasks, reminders, todayISO);
    const later = filterTasks("later", tasks, subtasks, reminders, todayISO);
    const quick = filterTasks("quick", tasks, subtasks, reminders, todayISO);
    const backlog = filterTasks(
      "backlog",
      tasks,
      subtasks,
      reminders,
      todayISO,
    );
    const recurring = filterTasks(
      "recurring",
      tasks,
      subtasks,
      reminders,
      todayISO,
    );
    const done = filterTasks("done", tasks, subtasks, reminders, todayISO);
    const cancelled = filterTasks(
      "cancelled",
      tasks,
      subtasks,
      reminders,
      todayISO,
    );
    return {
      relevant,
      today,
      tomorrow,
      thisWeek,
      waiting,
      later,
      quick,
      backlog,
      recurring,
      done,
      cancelled,
    };
  }, [tasks, subtasks, reminders, todayISO]);

  const visibleTasks = useMemo(() => {
    const selected: TaskFilterId[] = activeFilters.length
      ? activeFilters
      : ["relevant"];
    const byId = new Map<string, Task>();
    selected.forEach((filter) => {
      filterTasks(filter, tasks, subtasks, reminders, todayISO).forEach(
        (task) => byId.set(task.id, task),
      );
    });
    return Array.from(byId.values()).sort(compareFocus);
  }, [activeFilters, reminders, subtasks, tasks, todayISO]);

  const filterDefs: Array<{
    id: TaskFilterId;
    label: string;
    meta?: string;
    tone: string;
  }> = [
    {
      id: "relevant",
      label: `כל מה שרלוונטי (${counts.relevant.length})`,
      meta: "הכל פרט למבוטלות",
      tone: "bg-slate-950 text-white ring-slate-950",
    },
    {
      id: "today",
      label: `היום (${counts.today.length})`,
      meta: "כולל רלוונטי חוזר",
      tone: "bg-sky-50 text-sky-800 ring-sky-100",
    },
    {
      id: "tomorrow",
      label: `מחר (${counts.tomorrow.length})`,
      meta: "מתוזמנות ליום הבא",
      tone: "bg-cyan-50 text-cyan-800 ring-cyan-100",
    },
    {
      id: "this_week",
      label: `השבוע (${counts.thisWeek.length})`,
      meta: "לא להיום, כן בקרוב",
      tone: "bg-blue-50 text-blue-800 ring-blue-100",
    },
    {
      id: "waiting",
      label: `ממתין (${counts.waiting.length})`,
      meta: "תקוע אצל מישהו",
      tone: "bg-amber-50 text-amber-800 ring-amber-100",
    },
    {
      id: "later",
      label: `בהמשך (${counts.later.length})`,
      meta: "לא דחוף",
      tone: "bg-slate-50 text-slate-700 ring-slate-200",
    },
    {
      id: "quick",
      label: `קלילים (${counts.quick.length})`,
      meta: `${averageDuration(counts.quick)} דק׳ ממוצע`,
      tone: "bg-lime-50 text-lime-800 ring-lime-100",
    },
    {
      id: "backlog",
      label: `באקלוג (${counts.backlog.length})`,
      meta: `${remainingAverage(counts.backlog, subtasks)}% נשאר`,
      tone: "bg-amber-50 text-amber-800 ring-amber-100",
    },
    {
      id: "recurring",
      label: `חוזר / שבועי (${counts.recurring.length})`,
      meta: "שגרות",
      tone: "bg-violet-50 text-violet-800 ring-violet-100",
    },
    {
      id: "done",
      label: `גמורות (${counts.done.length})`,
      meta: "לבדיקה",
      tone: "bg-emerald-50 text-emerald-800 ring-emerald-100",
    },
    {
      id: "cancelled",
      label: `מבוטלות (${counts.cancelled.length})`,
      meta: "אדום",
      tone: "bg-rose-50 text-rose-800 ring-rose-100",
    },
  ];

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [localQuietMode, setLocalQuietMode] = useState(false);
  const quietMode = controlledQuietMode ?? localQuietMode;
  const toggleQuietMode = onToggleQuietMode ?? (() => setLocalQuietMode((current) => !current));
  const recommendedTask = visibleTasks[0] ?? null;
  const nextTasks = visibleTasks.slice(1, 5);
  const recommendedProgress = recommendedTask ? getTaskProgress(recommendedTask, subtasks) : null;
  const firstNextTask = nextTasks[0] ?? null;

  const toggleFilter = (filter: TaskFilterId) => {
    setActiveFilters((current) => {
      if (filter === "relevant") return ["relevant"];
      const withoutRelevant = current.filter((item) => item !== "relevant");
      const next = withoutRelevant.includes(filter)
        ? withoutRelevant.filter((item) => item !== filter)
        : [...withoutRelevant, filter];
      return next.length ? next : ["relevant"];
    });
  };

  const activeFilterSummary = activeFilters.includes("relevant")
    ? `כל מה שרלוונטי (${counts.relevant.length})`
    : activeFilters
        .map(
          (filterId) =>
            filterDefs.find((filter) => filter.id === filterId)?.label,
        )
        .filter(Boolean)
        .join(" + ");

  return (
    <div className="space-y-3 sm:space-y-5">
      {recommendedTask ? (
        <section className="rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-sky-100 sm:rounded-[2rem] sm:p-5 sm:shadow-soft">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 lg:gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black text-emerald-700">
                הפעולה הבאה המומלצת
              </p>
              <h2 className="mobile-clamp-2 mt-0.5 text-base font-black leading-tight tracking-tight text-slate-950 sm:mt-1 sm:text-3xl">
                {recommendedTask.title}
              </h2>
              <p className="mt-2 hidden max-w-3xl text-sm font-bold text-slate-500 sm:block">
                {recommendedTask.whyNow ||
                  "פתח את הכרטיס ותתקדם בצעד הבא בלבד."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 sm:mt-4">
                <button
                  type="button"
                  className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white sm:px-4 sm:text-sm"
                  onClick={() =>
                    document
                      .getElementById(`task-${recommendedTask.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                >
                  פתח בכרטיס
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-800 ring-1 ring-sky-100 sm:px-4 sm:text-sm"
                  onClick={toggleQuietMode}
                >
                  {quietMode ? "כבה מצב שקט" : "מצב שקט"}
                </button>
                {firstNextTask ? (
                  <button
                    type="button"
                    className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 ring-1 ring-emerald-100 sm:px-4 sm:text-sm"
                    onClick={() => {
                      if (quietMode) toggleQuietMode();
                      window.setTimeout(
                        () =>
                          document
                            .getElementById(`task-${firstNextTask.id}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
                        quietMode ? 80 : 0,
                      );
                    }}
                  >
                    הבא בתור
                  </button>
                ) : null}
              </div>
            </div>
            <div
              className="grid h-16 w-16 place-items-center rounded-full bg-[conic-gradient(#22c55e_var(--progress),#e2e8f0_0)] p-1 sm:h-32 sm:w-32 sm:p-2"
              style={
                {
                  "--progress": `${recommendedProgress?.percent ?? 0}%`,
                } as React.CSSProperties
              }
            >
              <div className="grid h-full w-full place-items-center rounded-full bg-white text-center">
                <div>
                  <p className="text-lg font-black sm:text-3xl">
                    {recommendedProgress?.percent ?? 0}%
                  </p>
                  <p className="text-[10px] font-black text-slate-500 sm:text-xs">במשימה</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {!quietMode ? (
        <section className="mission-chip-strip -mx-3 hidden gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {nextTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className="min-w-[14rem] rounded-2xl bg-white p-3 text-right shadow-sm ring-1 ring-sky-100 transition hover:-translate-y-0.5 hover:bg-sky-50 sm:min-w-0 sm:rounded-3xl sm:p-4"
              onClick={() =>
                document
                  .getElementById(`task-${task.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            >
              <span className="text-[11px] font-black text-sky-700 sm:text-xs">הבא בתור</span>
              <span className="mt-1 block truncate text-sm font-black text-slate-950">
                {task.title}
              </span>
            </button>
          ))}
        </section>
      ) : null}

      {!quietMode ? (
        <SectionCard
          title="משימות"
          description="מסנן אחד נקי במקום שורת בועות. פתח כדי לבחור היום, קלילים, באקלוג, חוזרות, גמורות או מבוטלות."
        >
          <div className="relative">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2.5 text-right text-xs font-black text-slate-900 ring-1 ring-slate-200 shadow-sm transition hover:bg-sky-50 sm:rounded-3xl sm:px-4 sm:py-3 sm:text-sm"
              onClick={() => setFiltersOpen((current) => !current)}
              aria-expanded={filtersOpen}
            >
              <span>
                פילטר משימות:{" "}
                <span className="text-sky-800">{activeFilterSummary}</span>
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-2xl bg-slate-950 text-white">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points={filtersOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                </svg>
              </span>
            </button>

            {filtersOpen ? (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setFiltersOpen(false)}
                  aria-hidden="true"
                />
              <div className="absolute right-0 z-30 mt-2 w-full rounded-3xl bg-white p-3 shadow-2xl ring-1 ring-slate-200 md:max-w-3xl">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filterDefs.map((filter) => {
                    const selected = activeFilters.includes(filter.id);
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-right text-xs font-black transition ${selected ? `${filter.tone} border-slate-950 shadow-sm ring-2 ring-slate-950/25` : "border-transparent bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-sky-50"}`}
                        onClick={() => toggleFilter(filter.id)}
                      >
                        <span>
                          <span className="block">{filter.label}</span>
                          {filter.meta ? (
                            <span className="mt-0.5 block text-[10px] opacity-70">
                              {filter.meta}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] ${selected ? "border-slate-950 bg-white/90 text-slate-950" : "border-slate-300 text-transparent"}`}
                        >
                          ✓
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              </>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title={
          quietMode
            ? "מצב שקט — רק המשימה הבאה"
            : activeFilters.includes("relevant")
              ? "כל מה שרלוונטי"
              : "תוצאות לפי פילטרים"
        }
        description={
          quietMode
            ? "מוצגת רק המשימה הנוכחית. כבה מצב שקט כדי לחזור לרשימה מלאה."
            : activeFilters.includes("relevant")
              ? "כל המשימות הפעילות ממוינות לפי סדר עבודה. לא כולל מבוטלות."
              : "אפשר לבחור כמה פילטרים יחד. החצים משנים את סדר העבודה היומי ולא את העדיפות האמיתית."
        }
      >
        {visibleTasks.length === 0 ? (
          <p className="text-sm text-slate-500">
            אין משימות להצגה בפילטר הנוכחי.
          </p>
        ) : activeFilters.includes("relevant") && !quietMode ? (
          // ── Grouped colored display for "relevant" filter ──
          <div className="space-y-6">
            {groupTasks(
              visibleTasks,
              subtasks,
              todayISO,
              settings?.taskGroupOrder ?? ['today', 'in_progress', 'quick', 'backlog'],
            ).map(({ groupId, tasks: groupTasks_ }) => {
              const meta = BACKLOG_GROUP_META[groupId] ?? TASK_GROUP_META[groupId] ?? TASK_GROUP_META.backlog;
              return (
                <div key={groupId} className={`space-y-2 border-r-4 pr-2 sm:space-y-3 sm:pr-3 ${meta.borderColor}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dotColor}`} />
                    <p className={`text-xs font-black uppercase tracking-wide ${meta.headerColor}`}>
                      {meta.label}
                    </p>
                    <span className={`text-xs font-bold ${meta.headerColor} opacity-60`}>
                      {groupTasks_.length}
                    </span>
                  </div>
                  {groupTasks_.map((task) => {
                    const index = visibleTasks.indexOf(task);
                    return (
                      <div
                        id={`task-${task.id}`}
                        key={task.id}
                        className="scroll-mt-28 grid grid-cols-[32px_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[44px_minmax(0,1fr)]"
                      >
                        <div className="mt-3 grid h-8 w-8 place-items-center rounded-full bg-slate-950 text-xs font-black text-white shadow-sm sm:h-10 sm:w-10 sm:text-sm">
                          {index + 1}
                        </div>
                        <ReadOnlyTaskCard
                          task={task}
                          subtasks={subtasks}
                          reminders={reminders}
                          projectName={getProjectName(settings, task)}
                          domainName={getDomainName(settings, task)}
                          settings={settings}
                          isSaving={isSaving}
                          onChangeSubtaskStatus={onChangeSubtaskStatus}
                          onMoveToTomorrow={onMoveToTomorrow}
                          onMoveToBacklogGroup={onMoveToBacklogGroup}
                          onChangeTaskDate={onChangeTaskDate}
                          onCancelTask={onCancelTask}
                          onUpdateTaskText={onUpdateTaskText}
                          onUpdateSubtaskText={onUpdateSubtaskText}
                          onUpdateTaskDetails={onUpdateTaskDetails}
                          onAddSubtaskToTask={onAddSubtaskToTask}
                          onReorderTaskFocus={onReorderTaskFocus}
                          canReorderFocus={true}
                          onAddReminder={onAddReminder}
                          isFocused={focusedTaskId === task.id}
                          onOpenFocusTimer={onOpenFocusTimer}
                          onAddTaskToFocus={onAddTaskToFocus}
                          onAddSubtaskToFocus={onAddSubtaskToFocus}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          // ── Flat list for all other filters ──
          <div className="space-y-3">
            {(quietMode && recommendedTask
              ? [recommendedTask]
              : visibleTasks
            ).map((task, index) => (
              <div
                id={`task-${task.id}`}
                key={task.id}
                className="scroll-mt-28 grid grid-cols-[32px_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[44px_minmax(0,1fr)]"
              >
                <div className="mt-3 grid h-8 w-8 place-items-center rounded-full bg-slate-950 text-xs font-black text-white shadow-sm sm:h-10 sm:w-10 sm:text-sm">
                  {index + 1}
                </div>
                <ReadOnlyTaskCard
                  task={task}
                  subtasks={subtasks}
                  reminders={reminders}
                  projectName={getProjectName(settings, task)}
                  domainName={getDomainName(settings, task)}
                  settings={settings}
                  isSaving={isSaving}
                  onChangeSubtaskStatus={onChangeSubtaskStatus}
                  onMoveToTomorrow={onMoveToTomorrow}
                  onMoveToBacklogGroup={onMoveToBacklogGroup}
                  onChangeTaskDate={onChangeTaskDate}
                  onCancelTask={onCancelTask}
                  onUpdateTaskText={onUpdateTaskText}
                  onUpdateSubtaskText={onUpdateSubtaskText}
                  onUpdateTaskDetails={onUpdateTaskDetails}
                  onAddSubtaskToTask={onAddSubtaskToTask}
                  onReorderTaskFocus={onReorderTaskFocus}
                  canReorderFocus={
                    task.bucket === "today" ||
                    task.date === todayISO ||
                    activeFilters.includes("relevant")
                  }
                  onAddReminder={onAddReminder}
                  isFocused={focusedTaskId === task.id}
                  onOpenFocusTimer={onOpenFocusTimer}
                  onAddTaskToFocus={onAddTaskToFocus}
                  onAddSubtaskToFocus={onAddSubtaskToFocus}
                />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
