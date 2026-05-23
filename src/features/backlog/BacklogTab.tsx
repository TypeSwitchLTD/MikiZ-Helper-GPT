import { SectionCard } from '../../components/layout/SectionCard';
import { ReadOnlyTaskCard } from '../../components/task/ReadOnlyTaskCard';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import { getTaskProgress } from '../../domain/tasks/taskProgress';
import type { BacklogGroup, Subtask, Task } from '../../domain/tasks/taskTypes';
import { backlogLabels } from '../../utils/hebrewLabels';

interface BacklogTabProps {
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

const groups: BacklogGroup[] = ['tomorrow', 'this_week', 'waiting', 'later'];

function sortBacklogTasks(tasks: Task[]): Task[] {
  const priorityOrder: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.title.localeCompare(b.title));
}

export function BacklogTab({ tasks, subtasks, settings, isSaving, onChangeSubtaskStatus, onMoveToTomorrow, onChangeTaskDate, onCancelTask, onUpdateTaskText, onUpdateSubtaskText, onUpdateTaskDetails, onAddSubtaskToTask, onAddReminder, focusedTaskId }: BacklogTabProps) {
  const openTasks = tasks.filter((task) => getTaskProgress(task, subtasks).status !== 'done' && task.statusOverride !== 'cancelled');
  const waitingCount = openTasks.filter((task) => task.backlogGroup === 'waiting').length;
  const thisWeekCount = openTasks.filter((task) => task.backlogGroup === 'this_week').length;

  return (
    <div className="space-y-5">
      <SectionCard title="באקלוג" description="מקום בטוח למשימות שלא חייבות להיות על הראש עכשיו. שום דבר לא נמחק בשקט.">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
            <p className="text-xs font-bold text-sky-700">פתוחות</p>
            <p className="text-2xl font-black text-sky-950">{openTasks.length}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
            <p className="text-xs font-bold text-emerald-700">השבוע</p>
            <p className="text-2xl font-black text-emerald-950">{thisWeekCount}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
            <p className="text-xs font-bold text-amber-700">ממתין</p>
            <p className="text-2xl font-black text-amber-950">{waitingCount}</p>
          </div>
          <div className="rounded-2xl bg-fuchsia-50 px-4 py-3 ring-1 ring-fuchsia-100">
            <p className="text-xs font-bold text-fuchsia-700">סה״כ בקבוצות</p>
            <p className="text-2xl font-black text-fuchsia-950">{tasks.length}</p>
          </div>
        </div>
      </SectionCard>

      {groups.map((group) => {
        const groupTasks = sortBacklogTasks(tasks.filter((task) => task.backlogGroup === group));
        return (
          <SectionCard key={group} title={backlogLabels[group]} description={`${groupTasks.length} משימות בקבוצה הזו`}>
            {groupTasks.length === 0 ? (
              <p className="text-sm text-slate-500">אין משימות בקבוצה הזו.</p>
            ) : (
              <div className="space-y-3">
                {groupTasks.map((task) => (
                  <ReadOnlyTaskCard
                    key={task.id}
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
                ))}
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}
