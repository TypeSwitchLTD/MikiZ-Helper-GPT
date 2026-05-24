import type { Subtask, Task, TaskStatusDerived } from './taskTypes';

export interface TaskProgress {
  status: TaskStatusDerived;
  percent: number;
  startedCount: number;
  doneCount: number;
  totalCount: number;
}

export function getTaskProgress(task: Task, subtasks: Subtask[]): TaskProgress {
  if (task.deletedAt) {
    return { status: 'cancelled', percent: 0, startedCount: 0, doneCount: 0, totalCount: 0 };
  }

  if (task.statusOverride === 'cancelled') {
    return { status: 'cancelled', percent: 0, startedCount: 0, doneCount: 0, totalCount: 0 };
  }

  if (task.statusOverride === 'moved') {
    return { status: 'moved', percent: 0, startedCount: 0, doneCount: 0, totalCount: 0 };
  }

  const taskSubtasks = subtasks.filter((subtask) => subtask.taskId === task.id && !subtask.deletedAt);
  const activeSubtasks = taskSubtasks.filter((subtask) => subtask.status !== 'cancelled');
  const startedSubtasks = activeSubtasks.filter(
    (subtask) => subtask.status === 'started' || subtask.status === 'done',
  );
  const doneSubtasks = activeSubtasks.filter((subtask) => subtask.status === 'done');

  if (activeSubtasks.length === 0) {
    return { status: 'not_started', percent: 0, startedCount: 0, doneCount: 0, totalCount: 0 };
  }

  if (doneSubtasks.length === activeSubtasks.length) {
    return {
      status: 'done',
      percent: 100,
      startedCount: startedSubtasks.length,
      doneCount: doneSubtasks.length,
      totalCount: activeSubtasks.length,
    };
  }

  if (startedSubtasks.length > 0) {
    return {
      status: 'in_progress',
      percent: Math.round((doneSubtasks.length / activeSubtasks.length) * 100),
      startedCount: startedSubtasks.length,
      doneCount: doneSubtasks.length,
      totalCount: activeSubtasks.length,
    };
  }

  return {
    status: 'not_started',
    percent: 0,
    startedCount: 0,
    doneCount: 0,
    totalCount: activeSubtasks.length,
  };
}
