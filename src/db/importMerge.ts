import type { Subtask, Task } from '../domain/tasks/taskTypes';

export interface ImportMergeOptions {
  allowDeletedRestore?: boolean;
}

export interface ImportMergeDecision<T> {
  shouldUpsert: boolean;
  item: T;
}

export function prepareTaskForImport(
  incomingTask: Task,
  localTask: Task | undefined,
  options: ImportMergeOptions = {},
): ImportMergeDecision<Task> {
  if (!localTask) return { shouldUpsert: true, item: incomingTask };

  const item = { ...incomingTask };

  if (item.deletedAt) {
    return { shouldUpsert: !localTask.deletedAt || item.updatedAt > localTask.updatedAt, item };
  }

  if (localTask.deletedAt) {
    if (options.allowDeletedRestore) {
      item.deletedAt = null;
      return { shouldUpsert: true, item };
    }
    return { shouldUpsert: false, item };
  }

  if (localTask.statusOverride === 'cancelled' && item.statusOverride !== 'cancelled') {
    return { shouldUpsert: false, item };
  }

  if (localTask.completedAt && !item.completedAt) {
    return { shouldUpsert: false, item };
  }

  return { shouldUpsert: item.updatedAt > localTask.updatedAt, item };
}

export function prepareSubtaskForImport(
  incomingSubtask: Subtask,
  localSubtask: Subtask | undefined,
  localParentTask: Task | undefined,
  options: ImportMergeOptions = {},
): ImportMergeDecision<Subtask> {
  if (!localSubtask) return { shouldUpsert: true, item: incomingSubtask };

  const item = { ...incomingSubtask };

  if (item.deletedAt) {
    return { shouldUpsert: !localSubtask.deletedAt || item.updatedAt > localSubtask.updatedAt, item };
  }

  if (localSubtask.deletedAt || localParentTask?.deletedAt) {
    if (options.allowDeletedRestore) {
      item.deletedAt = null;
      return { shouldUpsert: true, item };
    }
    return { shouldUpsert: false, item };
  }

  if (localSubtask.status === 'cancelled' && item.status !== 'cancelled') {
    return { shouldUpsert: false, item };
  }

  if (localSubtask.status === 'done' && item.status !== 'done') {
    return { shouldUpsert: false, item };
  }

  return { shouldUpsert: item.updatedAt > localSubtask.updatedAt, item };
}
