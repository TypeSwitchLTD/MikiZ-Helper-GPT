import type { Subtask, Task } from './taskTypes';
import { getTaskProgress } from './taskProgress';

export function getSubtasksForTask(taskId: string, subtasks: Subtask[]): Subtask[] {
  return subtasks
    .filter((subtask) => subtask.taskId === taskId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getTodayTasks(tasks: Task[], todayISO: string): Task[] {
  return tasks.filter((task) => task.bucket === 'today' && task.date === todayISO);
}

export function getInProgressTasks(tasks: Task[], subtasks: Subtask[]): Task[] {
  return tasks.filter((task) => getTaskProgress(task, subtasks).status === 'in_progress');
}

export function getQuickWinTasks(tasks: Task[]): Task[] {
  return tasks.filter(
    (task) =>
      task.statusOverride !== 'cancelled' &&
      (task.isQuickWin || task.estimatedDurationMinutes === 10 || (task.estimatedDurationMinutes ?? 999) < 10),
  );
}

export function getBacklogTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => task.bucket === 'backlog');
}
