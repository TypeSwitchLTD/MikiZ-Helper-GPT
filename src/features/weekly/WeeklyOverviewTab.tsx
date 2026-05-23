import { SectionCard } from '../../components/layout/SectionCard';
import { ReadOnlyTaskCard } from '../../components/task/ReadOnlyTaskCard';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import { getTaskProgress } from '../../domain/tasks/taskProgress';
import type { Subtask, Task } from '../../domain/tasks/taskTypes';

interface WeeklyOverviewTabProps {
  tasks: Task[];
  subtasks: Subtask[];
  settings: AppSettings | null;
  todayISO: string;
  isSaving?: boolean;
  onChangeSubtaskStatus: (subtaskId: string, status: Subtask['status']) => Promise<void> | void;
  onMoveToTomorrow: (task: Task) => Promise<void> | void;
  onChangeTaskDate: (task: Task, targetDate: string) => Promise<void> | void;
  onCancelTask: (taskId: string) => Promise<void> | void;
  onUpdateTaskText: (taskId: string, patch: { title?: string; whyNow?: string; notes?: string }) => Promise<void> | void;
  onUpdateSubtaskText: (subtaskId: string, patch: { title?: string; notes?: string }) => Promise<void> | void;
  onUpdateTaskDetails: (taskId: string, patch: { projectId?: string; domainId?: string; priority?: Task['priority']; effort?: Task['effort']; tags?: string[] }) => Promise<void> | void;
  onAddSubtaskToTask: (input: { taskId: string; title: string; notes?: string }) => Promise<void> | void;
  onAddReminder?: (input: { taskId: string; subtaskId?: string | null; title: string; date: string; time: string; note?: string }) => Promise<void> | void;
  focusedTaskId?: string | null;
}

type WeeklyGroupId = 'open' | 'in_progress' | 'done' | 'cancelled' | 'backlog';

const groupMeta: Record<WeeklyGroupId, { title: string; description: string; cardClass: string }> = {
  open: {
    title: 'פתוחות השבוע',
    description: 'משימות שלא התחילו או עדיין צריכות טיפול.',
    cardClass: 'bg-sky-50 text-sky-900 ring-sky-100',
  },
  in_progress: {
    title: 'בתהליך השבוע',
    description: 'משימות שהתחלת דרך לפחות תת־משימה אחת.',
    cardClass: 'bg-violet-50 text-violet-900 ring-violet-100',
  },
  done: {
    title: 'בוצעו השבוע',
    description: 'משימות שהסתיימו ונשמרו לסטטיסטיקה עתידית.',
    cardClass: 'bg-emerald-50 text-emerald-900 ring-emerald-100',
  },
  cancelled: {
    title: 'בוטלו השבוע',
    description: 'לא נמחקות — נשארות ללמידה ודוח.',
    cardClass: 'bg-rose-50 text-rose-900 ring-rose-100',
  },
  backlog: {
    title: 'באקלוג השבוע',
    description: 'דברים שהועברו או מחכים מחוץ להיום.',
    cardClass: 'bg-amber-50 text-amber-900 ring-amber-100',
  },
};

function getWeekBounds(todayISO: string): { start: string; end: string } {
  const date = new Date(`${todayISO}T12:00:00`);
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function isInRange(dateLike: string | null | undefined, start: string, end: string): boolean {
  if (!dateLike) return false;
  const value = dateLike.slice(0, 10);
  return value >= start && value <= end;
}

function getProjectName(settings: AppSettings | null, task: Task): string | undefined {
  return settings?.projects.find((project) => project.id === task.projectId)?.name;
}

function getDomainName(settings: AppSettings | null, task: Task): string | undefined {
  return settings?.domains.find((domain) => domain.id === task.domainId)?.name;
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.title.localeCompare(b.title));
}

export function WeeklyOverviewTab({
  tasks,
  subtasks,
  settings,
  todayISO,
  isSaving,
  onChangeSubtaskStatus,
  onMoveToTomorrow,
  onChangeTaskDate,
  onCancelTask,
  onUpdateTaskText,
  onUpdateSubtaskText,
  onUpdateTaskDetails,
  onAddSubtaskToTask,
  onAddReminder,
  focusedTaskId,
}: WeeklyOverviewTabProps) {
  const { start, end } = getWeekBounds(todayISO);
  const weekTasks = tasks.filter((task) =>
    isInRange(task.date, start, end) ||
    isInRange(task.originalDate, start, end) ||
    isInRange(task.completedAt, start, end) ||
    isInRange(task.cancelledAt, start, end) ||
    isInRange(task.updatedAt, start, end),
  );

  const grouped: Record<WeeklyGroupId, Task[]> = {
    open: [],
    in_progress: [],
    done: [],
    cancelled: [],
    backlog: [],
  };

  weekTasks.forEach((task) => {
    const progress = getTaskProgress(task, subtasks);
    if (progress.status === 'cancelled' || task.statusOverride === 'cancelled') {
      grouped.cancelled.push(task);
      return;
    }
    if (progress.status === 'done') {
      grouped.done.push(task);
      return;
    }
    if (task.bucket === 'backlog') {
      grouped.backlog.push(task);
      return;
    }
    if (progress.status === 'in_progress') {
      grouped.in_progress.push(task);
      return;
    }
    grouped.open.push(task);
  });

  const groups: WeeklyGroupId[] = ['open', 'in_progress', 'done', 'cancelled', 'backlog'];

  return (
    <div className="space-y-5">
      <SectionCard title="כל השבוע" description={`שבוע נוכחי: ${start} עד ${end}. כולל פתוחות, בתהליך, בוצעו, בוטלו ובאקלוג.`}>
        <div className="grid gap-3 md:grid-cols-5">
          {groups.map((groupId) => (
            <div key={groupId} className={`rounded-2xl px-4 py-3 ring-1 ${groupMeta[groupId].cardClass}`}>
              <p className="text-xs font-black">{groupMeta[groupId].title}</p>
              <p className="text-2xl font-black">{grouped[groupId].length}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {groups.map((groupId) => {
        const groupTasks = sortTasks(grouped[groupId]);
        const meta = groupMeta[groupId];
        return (
          <SectionCard key={groupId} title={meta.title} description={meta.description}>
            {groupTasks.length === 0 ? (
              <p className="text-sm text-slate-500">אין משימות בקטגוריה הזו השבוע.</p>
            ) : (
              <div className="space-y-3">
                {groupTasks.map((task) => (
                  <ReadOnlyTaskCard
                    key={task.id}
                    task={task}
                    subtasks={subtasks}
                    projectName={getProjectName(settings, task)}
                    domainName={getDomainName(settings, task)}
                    settings={settings}
                    isSaving={isSaving}
                    isCompletedArchived={groupId === 'done'}
                    onChangeSubtaskStatus={onChangeSubtaskStatus}
                    onMoveToTomorrow={onMoveToTomorrow}
                    onChangeTaskDate={onChangeTaskDate}
                    onCancelTask={onCancelTask}
                    onUpdateTaskText={onUpdateTaskText}
                    onUpdateSubtaskText={onUpdateSubtaskText}
                    onUpdateTaskDetails={onUpdateTaskDetails}
                    onAddSubtaskToTask={onAddSubtaskToTask}
                    onAddReminder={onAddReminder}
                    isFocused={focusedTaskId === task.id}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}
