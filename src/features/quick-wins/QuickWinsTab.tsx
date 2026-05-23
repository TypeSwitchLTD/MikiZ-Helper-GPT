import { useMemo, useState } from 'react';
import { SectionCard } from '../../components/layout/SectionCard';
import { ReadOnlyTaskCard } from '../../components/task/ReadOnlyTaskCard';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import { getTaskProgress } from '../../domain/tasks/taskProgress';
import type { Subtask, Task } from '../../domain/tasks/taskTypes';

interface QuickWinsTabProps {
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

const priorityScore: Record<Task['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function sortQuickWins(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const durationA = a.estimatedDurationMinutes ?? 999;
    const durationB = b.estimatedDurationMinutes ?? 999;
    return durationA - durationB || priorityScore[a.priority] - priorityScore[b.priority] || a.title.localeCompare(b.title);
  });
}

export function QuickWinsTab({ tasks, subtasks, settings, isSaving, onChangeSubtaskStatus, onMoveToTomorrow, onChangeTaskDate, onCancelTask, onUpdateTaskText, onUpdateSubtaskText, onUpdateTaskDetails, onAddSubtaskToTask, onAddReminder, focusedTaskId }: QuickWinsTabProps) {
  const [showOnlyTopThree, setShowOnlyTopThree] = useState(false);
  const sortedTasks = useMemo(() => sortQuickWins(tasks), [tasks]);
  const visibleTasks = showOnlyTopThree ? sortedTasks.slice(0, 3) : sortedTasks;
  const completedToday = tasks.filter((task) => getTaskProgress(task, subtasks).status === 'done').length;

  return (
    <div className="space-y-5">
      <SectionCard title="קלילים" description="מצב אנרגיה נמוכה: משימות קצרות, פחות החלטות, פחות עומס קוגניטיבי.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
              <p className="text-xs font-bold text-sky-700">פתוחות</p>
              <p className="text-2xl font-black text-sky-950">{sortedTasks.length}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
              <p className="text-xs font-bold text-emerald-700">בוצעו</p>
              <p className="text-2xl font-black text-emerald-950">{completedToday}</p>
            </div>
            <div className="rounded-2xl bg-fuchsia-50 px-4 py-3 ring-1 ring-fuchsia-100">
              <p className="text-xs font-bold text-fuchsia-700">מומלצות עכשיו</p>
              <p className="text-2xl font-black text-fuchsia-950">{Math.min(3, sortedTasks.length)}</p>
            </div>
          </div>

          <button
            type="button"
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
            onClick={() => setShowOnlyTopThree((current) => !current)}
          >
            {showOnlyTopThree ? 'הצג את כל הקלילות' : 'בחר לי 3 קלילות'}
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title={showOnlyTopThree ? '3 משימות מומלצות עכשיו' : 'כל ה־Quick Wins'}
        description="הסדר הוא לפי משך קצר, ואז עדיפות. אפשר לסמן התחלה/סיום כמו במסך היום."
      >
        {visibleTasks.length === 0 ? (
          <p className="text-sm text-slate-500">אין כרגע Quick Wins פתוחים.</p>
        ) : (
          <div className="space-y-3">
            {visibleTasks.map((task) => (
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
    </div>
  );
}
