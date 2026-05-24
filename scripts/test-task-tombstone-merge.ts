import assert from 'node:assert/strict';
import { prepareSubtaskForImport, prepareTaskForImport } from '../src/db/importMerge.ts';
import type { Subtask, Task } from '../src/domain/tasks/taskTypes.ts';

const baseTask: Task = {
  id: 'task-a',
  title: 'Task A',
  projectId: 'personal',
  domainId: 'operations',
  bucket: 'today',
  date: '2026-05-24',
  originalDate: '2026-05-24',
  priority: 'medium',
  effort: 'medium',
  isQuickWin: false,
  isRecurring: false,
  backlogGroup: null,
  tags: [],
  statusOverride: null,
  movedCount: 0,
  movedToDate: null,
  source: 'manual',
  createdAt: '2026-05-24T08:00:00.000Z',
  updatedAt: '2026-05-24T08:00:00.000Z',
  completedAt: null,
  cancelledAt: null,
  deletedAt: null,
};

const baseSubtask: Subtask = {
  id: 'subtask-a',
  taskId: 'task-a',
  title: 'Subtask A',
  status: 'not_started',
  sortOrder: 0,
  createdAt: '2026-05-24T08:00:00.000Z',
  updatedAt: '2026-05-24T08:00:00.000Z',
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  deletedAt: null,
};

function task(patch: Partial<Task>): Task {
  return { ...baseTask, ...patch };
}

function subtask(patch: Partial<Subtask>): Subtask {
  return { ...baseSubtask, ...patch };
}

{
  const decision = prepareTaskForImport(
    task({ updatedAt: '2026-05-24T08:00:00.000Z' }),
    task({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
  );
  assert.equal(decision.shouldUpsert, false, 'cloud pull must not resurrect a locally deleted task');
}

{
  const decision = prepareTaskForImport(
    task({ updatedAt: '2026-05-24T08:00:00.000Z' }),
    task({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
    { allowDeletedRestore: true },
  );
  assert.equal(decision.shouldUpsert, true, 'manual Daily State import must restore a deleted task');
  assert.equal(decision.item.deletedAt, null, 'manual restore clears the task tombstone');
}

{
  const decision = prepareTaskForImport(
    task({ deletedAt: '2026-05-24T11:00:00.000Z', updatedAt: '2026-05-24T11:00:00.000Z' }),
    task({ updatedAt: '2026-05-24T09:00:00.000Z' }),
  );
  assert.equal(decision.shouldUpsert, true, 'incoming task tombstone must be accepted when newer');
}

{
  const decision = prepareTaskForImport(
    task({ completedAt: null, updatedAt: '2026-05-24T09:00:00.000Z' }),
    task({ completedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
  );
  assert.equal(decision.shouldUpsert, false, 'cloud pull must not undo a locally completed task');
}

{
  const decision = prepareSubtaskForImport(
    subtask({ updatedAt: '2026-05-24T08:00:00.000Z' }),
    subtask({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
    task({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
  );
  assert.equal(decision.shouldUpsert, false, 'cloud pull must not resurrect subtasks under a deleted task');
}

{
  const decision = prepareSubtaskForImport(
    subtask({ updatedAt: '2026-05-24T08:00:00.000Z' }),
    subtask({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
    task({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
    { allowDeletedRestore: true },
  );
  assert.equal(decision.shouldUpsert, true, 'manual Daily State import must restore deleted subtasks');
  assert.equal(decision.item.deletedAt, null, 'manual restore clears the subtask tombstone');
}

{
  const decision = prepareSubtaskForImport(
    subtask({ status: 'started', updatedAt: '2026-05-24T09:00:00.000Z' }),
    subtask({ status: 'done', completedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
    task({}),
  );
  assert.equal(decision.shouldUpsert, false, 'cloud pull must not undo a locally completed subtask');
}

console.log('task tombstone merge regression tests passed');
