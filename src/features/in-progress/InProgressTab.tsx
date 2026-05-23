import { SectionCard } from '../../components/layout/SectionCard';
import { ReadOnlyTaskCard } from '../../components/task/ReadOnlyTaskCard';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import { getSubtasksForTask } from '../../domain/tasks/taskSelectors';
import type { Subtask, Task } from '../../domain/tasks/taskTypes';

interface InProgressTabProps {
  tasks: Task[];
  subtasks: Subtask[];
  settings: AppSettings | null;
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

function getUnfinishedSubtaskCount(task: Task, subtasks: Subtask[]): number {
  return getSubtasksForTask(task.id, subtasks).filter((subtask) => subtask.status !== 'done' && subtask.status !== 'cancelled').length;
}

function getLastTouchedAt(task: Task, subtasks: Subtask[]): string {
  const subtaskDates = getSubtasksForTask(task.id, subtasks).map((subtask) => subtask.updatedAt);
  return [task.updatedAt, ...subtaskDates].sort().at(-1) ?? task.updatedAt;
}

export function InProgressTab({ tasks, subtasks, settings, isSaving, onChangeSubtaskStatus, onMoveToTomorrow, onChangeTaskDate, onCancelTask, onUpdateTaskText, onUpdateSubtaskText, onUpdateTaskDetails, onAddSubtaskToTask, onAddReminder, focusedTaskId }: InProgressTabProps) {
  const sortedTasks = [...tasks].sort((a, b) => getLastTouchedAt(b, subtasks).localeCompare(getLastTouchedAt(a, subtasks)));

  return (
    <div className="space-y-5">
      <SectionCard title="בתהליך" description="כל מה שהתחיל ולא נסגר — גם אם התאריך המקורי עבר. זה המסך שמונע ממשימות להיעלם.">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
            <p className="text-xs font-bold text-sky-700">משימות פעילות</p>
            <p className="text-2xl font-black text-sky-950">{tasks.length}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
            <p className="text-xs font-bold text-amber-700">תתי־משימות פתוחות</p>
            <p className="text-2xl font-black text-amber-950">
              {tasks.reduce((total, task) => total + getUnfinishedSubtaskCount(task, subtasks), 0)}
            </p>
          </div>
          <div className="rounded-2xl bg-fuchsia-50 px-4 py-3 ring-1 ring-fuchsia-100">
            <p className="text-xs font-bold text-fuchsia-700">הועברו פעם או יותר</p>
            <p className="text-2xl font-black text-fuchsia-950">{tasks.filter((task) => task.movedCount > 0).length}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="רשימת עבודה פעילה" description="מסודר לפי עדכון אחרון. פתח משימה כדי לראות מה נשאר לסגור.">
        {sortedTasks.length === 0 ? (
          <p className="text-sm text-slate-500">אין כרגע משימות בתהליך.</p>
        ) : (
          <div className="space-y-3">
            {sortedTasks.map((task) => (
              <div key={task.id} className="space-y-2">
                <div className="flex flex-wrap gap-2 px-1 text-xs text-slate-500">
                  <span>תאריך מקורי: {task.originalDate ?? 'לא נקבע'}</span>
                  <span>·</span>
                  <span>תאריך נוכחי: {task.date ?? 'לא מתוזמן'}</span>
                  <span>·</span>
                  <span>הועבר {task.movedCount} פעמים</span>
                  <span>·</span>
                  <span>{getUnfinishedSubtaskCount(task, subtasks)} תתי־משימות פתוחות</span>
                </div>
                <ReadOnlyTaskCard
                  task={task}
                  subtasks={subtasks}
                  projectName={settings?.projects.find((project) => project.id === task.projectId)?.name}
                  domainName={settings?.domains.find((domain) => domain.id === task.domainId)?.name}
                  settings={settings}
                  isSaving={isSaving}
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
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
