import type { Subtask, Task } from './taskTypes';
import { getTaskProgress } from './taskProgress';

export function getSubtasksForTask(taskId: string, subtasks: Subtask[]): Subtask[] {
  return subtasks
    .filter((subtask) => subtask.taskId === taskId && !subtask.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getTodayTasks(tasks: Task[], todayISO: string): Task[] {
  // Show all bucket=today tasks due today or earlier (handles import before rollover)
  return tasks.filter(
    (task) =>
      task.bucket === 'today' &&
      (task.date ?? '') <= todayISO &&
      !task.deletedAt &&
      task.statusOverride !== 'cancelled' &&
      !task.completedAt,
  );
}

export function getInProgressTasks(tasks: Task[], subtasks: Subtask[]): Task[] {
  return tasks.filter((task) => !task.deletedAt && getTaskProgress(task, subtasks).status === 'in_progress');
}

export function getQuickWinTasks(tasks: Task[]): Task[] {
  return tasks.filter(
    (task) =>
      task.statusOverride !== 'cancelled' &&
      !task.deletedAt &&
      (task.isQuickWin || task.estimatedDurationMinutes === 10 || (task.estimatedDurationMinutes ?? 999) < 10),
  );
}

export function getBacklogTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => task.bucket === 'backlog' && !task.deletedAt);
}
