import { useEffect, useMemo, useState } from 'react';
import { SectionCard } from '../../components/layout/SectionCard';
import { ReadOnlyTaskCard } from '../../components/task/ReadOnlyTaskCard';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import { getTaskProgress } from '../../domain/tasks/taskProgress';
import type { Subtask, Task } from '../../domain/tasks/taskTypes';

const DONE_ARCHIVE_DELAY_MS = 60_000;

interface TodayTabProps {
  tasks: Task[];
  subtasks: Subtask[];
  settings: AppSettings | null;
  backlogPreviewCount: number;
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
  onReorderTaskFocus?: (taskId: string, action: 'first' | 'up' | 'down' | 'bottom') => Promise<void> | void;
  onAddReminder?: (input: { taskId: string; subtaskId?: string | null; title: string; date: string; time: string; note?: string }) => Promise<void> | void;
  focusedTaskId?: string | null;
}

function getTaskCompletedAtMs(task: Task): number | null {
  const completedAt = task.completedAt ?? task.updatedAt;
  if (!completedAt) return null;
  const completedAtMs = Date.parse(completedAt);
  return Number.isNaN(completedAtMs) ? null : completedAtMs;
}

function shouldShowInCompletedSection(task: Task, subtasks: Subtask[], nowMs: number): boolean {
  const progress = getTaskProgress(task, subtasks);
  const completedAtMs = getTaskCompletedAtMs(task);
  return progress.status === 'done' && completedAtMs !== null && nowMs - completedAtMs >= DONE_ARCHIVE_DELAY_MS;
}

function getProjectName(settings: AppSettings | null, task: Task): string | undefined {
  return settings?.projects.find((project) => project.id === task.projectId)?.name;
}

function getDomainName(settings: AppSettings | null, task: Task): string | undefined {
  return settings?.domains.find((domain) => domain.id === task.domainId)?.name;
}

function compareTodayFocus(a: Task, b: Task): number {
  const aOrder = typeof a.focusOrder === 'number' ? a.focusOrder : null;
  const bOrder = typeof b.focusOrder === 'number' ? b.focusOrder : null;
  if (aOrder !== null && bOrder !== null && aOrder !== bOrder) return aOrder - bOrder;
  if (aOrder !== null && bOrder === null) return -1;
  if (aOrder === null && bOrder !== null) return 1;
  const created = (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0);
  if (created !== 0) return created;
  return a.title.localeCompare(b.title);
}

export function TodayTab({
  tasks,
  subtasks,
  settings,
  backlogPreviewCount,
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
  onReorderTaskFocus,
  onAddReminder,
  focusedTaskId,
}: TodayTabProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 5_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const { activeTasks, completedTasks, backlogPreviewTasks } = useMemo(() => {
    const active: Task[] = [];
    const completed: Task[] = [];

    tasks.forEach((task) => {
      if (shouldShowInCompletedSection(task, subtasks, nowMs)) {
        completed.push(task);
      } else if (task.statusOverride !== 'cancelled' && task.bucket === 'today' && task.date === todayISO) {
        active.push(task);
      }
    });

    const backlogPreview = tasks
      .filter((task) => task.statusOverride !== 'cancelled' && task.bucket === 'backlog' && getTaskProgress(task, subtasks).status !== 'done')
      .sort((a, b) => (a.backlogGroup ?? '').localeCompare(b.backlogGroup ?? '') || a.title.localeCompare(b.title))
      .slice(0, 5);

    active.sort(compareTodayFocus);
    completed.sort((a, b) => (getTaskCompletedAtMs(b) ?? 0) - (getTaskCompletedAtMs(a) ?? 0));

    return { activeTasks: active, completedTasks: completed, backlogPreviewTasks: backlogPreview };
  }, [tasks, subtasks, nowMs, todayISO]);

  return (
    <div className="space-y-5">
      <SectionCard
        title="היום"
        description="משימות שמתוזמנות להיום בלבד. משימות שהועברו למחר יורדות מכאן ונשמרות ליום הבא."
      >
        {activeTasks.length === 0 ? (
          <p className="text-sm text-slate-500">אין משימות פתוחות להצגה.</p>
        ) : (
          <div className="space-y-3">
            {activeTasks.map((task) => (
              <ReadOnlyTaskCard
                key={task.id}
                task={task}
                subtasks={subtasks}
                projectName={getProjectName(settings, task)}
                domainName={getDomainName(settings, task)}
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
                onReorderTaskFocus={onReorderTaskFocus}
                canReorderFocus
                onAddReminder={onAddReminder}
                isFocused={focusedTaskId === task.id}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="תצוגת Backlog קצרה" description="מופיע מעל משימות גמורות כדי שעתיד קרוב לא ייעלם מהעין.">
        {backlogPreviewTasks.length === 0 ? (
          <p className="text-sm text-slate-600">כרגע קיימות {backlogPreviewCount} משימות באקלוג, ואין פריטים פתוחים לתצוגה קצרה.</p>
        ) : (
          <div className="space-y-3">
            {backlogPreviewTasks.map((task) => (
              <ReadOnlyTaskCard
                key={task.id}
                task={task}
                subtasks={subtasks}
                projectName={getProjectName(settings, task)}
                domainName={getDomainName(settings, task)}
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

      {completedTasks.length > 0 ? (
        <SectionCard title="משימות גמורות" description="משימות שהושלמו נשארות רגע במסך הראשי, ואז יורדות לכאן עם קו מחיקה. אפשר לפתוח ולבטל סימון אם לחצת בטעות.">
          <div className="space-y-3">
            {completedTasks.map((task) => (
              <ReadOnlyTaskCard
                key={task.id}
                task={task}
                subtasks={subtasks}
                projectName={getProjectName(settings, task)}
                domainName={getDomainName(settings, task)}
                settings={settings}
                isSaving={isSaving}
                isCompletedArchived
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
        </SectionCard>
      ) : null}
    </div>
  );
}
