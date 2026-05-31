import { db } from '../../db/db';
import { getTodayISO, nowISO, getTomorrowISO } from '../../utils/dates';
import { createId } from '../../utils/ids';
import { createLogEvent } from '../logs/logService';
import type { DailyReportImportTaskDraft } from '../import/dailyReportImport';
import type { Subtask, SubtaskStatus, Task } from './taskTypes';

export interface CreateTaskInput extends Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'movedCount' | 'source'> {
  source?: Task['source'];
  subtasks: Array<Pick<Subtask, 'title' | 'domainId' | 'estimatedDurationMinutes' | 'durationLabel' | 'toolsNeeded' | 'notes' | 'aiConversationUrl'>>;
}

export interface AddSubtaskInput {
  taskId: string;
  title: string;
  domainId?: string | null;
  estimatedDurationMinutes?: number | null;
  durationLabel?: string;
  toolsNeeded?: string;
  notes?: string;
  aiConversationUrl?: string | null;
  status?: SubtaskStatus;
}

export type UpdateTaskDetailsPatch = Pick<Partial<Task>, 'projectId' | 'domainId' | 'priority' | 'effort' | 'tags'>;

export async function createTaskWithSubtasks(input: CreateTaskInput): Promise<Task> {
  const timestamp = nowISO();
  const task: Task = {
    ...input,
    id: createId('task'),
    movedCount: 0,
    source: input.source ?? 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const normalizedSubtasks = input.subtasks.length > 0 ? input.subtasks : [{ title: input.title }];
  const subtasks: Subtask[] = normalizedSubtasks.map((subtask, index) => ({
    id: createId('subtask'),
    taskId: task.id,
    title: subtask.title,
    domainId: subtask.domainId ?? task.domainId,
    estimatedDurationMinutes: subtask.estimatedDurationMinutes ?? null,
    durationLabel: subtask.durationLabel,
    toolsNeeded: subtask.toolsNeeded,
    notes: subtask.notes,
    aiConversationUrl: subtask.aiConversationUrl ?? null,
    status: 'not_started',
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    sortOrder: index,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  await db.transaction('rw', db.tasks, db.subtasks, db.logs, async () => {
    await db.tasks.add(task);
    await db.subtasks.bulkAdd(subtasks);
    await createLogEvent({
      type: 'task_created',
      entityType: 'task',
      entityId: task.id,
      message: `Task created: ${task.title}`,
    });
  });

  return task;
}


export async function addSubtaskToTask(input: AddSubtaskInput): Promise<Subtask> {
  const timestamp = nowISO();
  const title = input.title.trim();

  if (!title) {
    throw new Error('Subtask title is required');
  }

  return db.transaction('rw', db.tasks, db.subtasks, db.logs, async () => {
    const task = await db.tasks.get(input.taskId);
    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    const currentSubtasks = await db.subtasks.where('taskId').equals(input.taskId).toArray();
    const nextSortOrder = currentSubtasks.reduce((max, subtask) => Math.max(max, subtask.sortOrder), -1) + 1;
    const status = input.status ?? 'not_started';
    const subtask: Subtask = {
      id: createId('subtask'),
      taskId: input.taskId,
      title,
      domainId: input.domainId ?? task.domainId,
      estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
      durationLabel: input.durationLabel,
      toolsNeeded: input.toolsNeeded,
      notes: input.notes?.trim() || undefined,
      aiConversationUrl: input.aiConversationUrl?.trim() || null,
      status,
      startedAt: status === 'started' || status === 'done' ? timestamp : null,
      completedAt: status === 'done' ? timestamp : null,
      cancelledAt: status === 'cancelled' ? timestamp : null,
      sortOrder: nextSortOrder,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await db.subtasks.add(subtask);
    await db.tasks.update(input.taskId, { completedAt: null, updatedAt: timestamp });
    await createLogEvent({
      type: 'task_updated',
      entityType: 'subtask',
      entityId: subtask.id,
      message: `Subtask added to task: ${task.title}`,
      metadata: { taskId: input.taskId, source: 'manual_subtask_add' },
    });

    return subtask;
  });
}

export async function importDailyReportTasks(drafts: DailyReportImportTaskDraft[]): Promise<Task[]> {
  const timestamp = nowISO();
  const createdTasks: Task[] = [];
  const createdSubtasks: Subtask[] = [];
  const mergedSubtasks: Subtask[] = [];
  const mergedTaskIds = new Set<string>();

  await db.transaction('rw', db.tasks, db.subtasks, db.logs, async () => {
    for (const draft of drafts) {
      if (draft.mergeTargetTaskId) {
        const targetTask = await db.tasks.get(draft.mergeTargetTaskId);
        if (!targetTask) {
          continue;
        }

        const currentSubtasks = await db.subtasks.where('taskId').equals(targetTask.id).toArray();
        let nextSortOrder = currentSubtasks.reduce((max, subtask) => Math.max(max, subtask.sortOrder), -1) + 1;
        const sourceSubtasks = draft.subtasks.length > 0 ? draft.subtasks : [{ title: draft.title, status: 'not_started' as const }];

        const subtasksToMerge: Subtask[] = sourceSubtasks.map((subtask) => ({
          id: createId('subtask'),
          taskId: targetTask.id,
          title: subtask.title,
          domainId: draft.domainId,
          estimatedDurationMinutes: null,
          durationLabel: undefined,
          toolsNeeded: undefined,
          notes: `יובא ומוזג מדוח: ${draft.title}`,
          status: subtask.status,
          startedAt: subtask.status === 'started' || subtask.status === 'done' ? timestamp : null,
          completedAt: subtask.status === 'done' ? timestamp : null,
          cancelledAt: null,
          sortOrder: nextSortOrder++,
          createdAt: timestamp,
          updatedAt: timestamp,
        }));

        if (subtasksToMerge.length > 0) {
          await db.subtasks.bulkAdd(subtasksToMerge);
          mergedSubtasks.push(...subtasksToMerge);
        }

        const mergedTags = Array.from(new Set([...(targetTask.tags ?? []), ...draft.tags]));
        const mergedNotes = [targetTask.notes, draft.notes ? `Imported note: ${draft.notes}` : undefined]
          .filter(Boolean)
          .join('\n\n') || undefined;

        await db.tasks.update(targetTask.id, {
          tags: mergedTags,
          notes: mergedNotes,
          completedAt: null,
          updatedAt: timestamp,
        });
        mergedTaskIds.add(targetTask.id);
        continue;
      }

      const task: Task = {
        id: createId('task'),
        title: draft.title,
        projectId: draft.projectId,
        domainId: draft.domainId,
        bucket: draft.bucket,
        date: draft.date,
        originalDate: draft.date,
        scheduledTimeLabel: draft.scheduledTimeLabel,
        estimatedDurationMinutes: draft.isQuickWin ? 10 : null,
        durationLabel: draft.isQuickWin ? '10 דק׳' : undefined,
        priority: draft.priority,
        effort: draft.effort,
        isQuickWin: draft.isQuickWin,
        isRecurring: draft.bucket === 'weekly',
        recurrenceDefinitionId: null,
        backlogGroup: draft.backlogGroup,
        tags: draft.tags,
        whyNow: draft.whyNow,
        notes: draft.notes,
        statusOverride: null,
        movedCount: 0,
        movedToDate: null,
        source: 'imported',
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: draft.subtasks.length > 0 && draft.subtasks.every((subtask) => subtask.status === 'done') ? timestamp : null,
        cancelledAt: null,
      };

      createdTasks.push(task);

      const taskSubtasks = (draft.subtasks.length > 0 ? draft.subtasks : [{ title: draft.title, status: 'not_started' as const }]).map(
        (subtask, index): Subtask => ({
          id: createId('subtask'),
          taskId: task.id,
          title: subtask.title,
          domainId: draft.domainId,
          estimatedDurationMinutes: null,
          durationLabel: undefined,
          toolsNeeded: undefined,
          notes: undefined,
          status: subtask.status,
          startedAt: subtask.status === 'started' || subtask.status === 'done' ? timestamp : null,
          completedAt: subtask.status === 'done' ? timestamp : null,
          cancelledAt: null,
          sortOrder: index,
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
      );

      createdSubtasks.push(...taskSubtasks);
    }

    if (createdTasks.length > 0) await db.tasks.bulkAdd(createdTasks);
    if (createdSubtasks.length > 0) await db.subtasks.bulkAdd(createdSubtasks);
    await createLogEvent({
      type: 'task_created',
      entityType: 'system',
      entityId: null,
      message: `Imported ${createdTasks.length} tasks and merged ${mergedSubtasks.length} subtasks from daily report`,
      metadata: {
        taskIds: createdTasks.map((task) => task.id),
        mergedTaskIds: Array.from(mergedTaskIds),
        mergedSubtaskIds: mergedSubtasks.map((subtask) => subtask.id),
        source: 'daily_report_import',
      },
    });
  });

  return createdTasks;
}

export async function deleteLastDailyReportImport(): Promise<{ deletedTasks: number; deletedSubtasks: number }> {
  const logs = await db.logs.where('type').equals('task_created').reverse().sortBy('timestamp');
  const importLog = logs.find((log) => log.metadata?.source === 'daily_report_import' && Array.isArray(log.metadata?.taskIds));
  const taskIds = (importLog?.metadata?.taskIds as string[] | undefined) ?? [];
  const mergedSubtaskIds = (importLog?.metadata?.mergedSubtaskIds as string[] | undefined) ?? [];
  if (taskIds.length === 0 && mergedSubtaskIds.length === 0) {
    return { deletedTasks: 0, deletedSubtasks: 0 };
  }
  let deletedSubtasks = 0;
  await db.transaction('rw', db.tasks, db.subtasks, db.logs, async () => {
    const timestamp = nowISO();
    for (const taskId of taskIds) {
      const taskSubtasks = await db.subtasks.where('taskId').equals(taskId).toArray();
      await db.subtasks.bulkPut(taskSubtasks.map((subtask) => ({
        ...subtask,
        deletedAt: subtask.deletedAt ?? timestamp,
        updatedAt: timestamp,
      })));
      deletedSubtasks += taskSubtasks.length;
    }
    if (mergedSubtaskIds.length > 0) {
      const mergedSubtasks = (await db.subtasks.bulkGet(mergedSubtaskIds)).filter(
        (subtask): subtask is Subtask => Boolean(subtask),
      );
      await db.subtasks.bulkPut(mergedSubtasks.map((subtask) => ({
        ...subtask,
        deletedAt: subtask.deletedAt ?? timestamp,
        updatedAt: timestamp,
      })));
      deletedSubtasks += mergedSubtaskIds.length;
    }
    if (taskIds.length > 0) {
      const importedTasks = (await db.tasks.bulkGet(taskIds)).filter(
        (task): task is Task => Boolean(task),
      );
      await db.tasks.bulkPut(importedTasks.map((task) => ({
        ...task,
        deletedAt: task.deletedAt ?? timestamp,
        updatedAt: timestamp,
      })));
    }
    await createLogEvent({
      type: 'task_cancelled',
      entityType: 'system',
      entityId: null,
      message: `Soft-deleted last daily report import: ${taskIds.length} tasks, ${deletedSubtasks} subtasks`,
      metadata: { source: 'daily_report_import_rollback', taskIds, mergedSubtaskIds },
    });
  });
  return { deletedTasks: taskIds.length, deletedSubtasks };
}

export async function softDeleteAllTasks(): Promise<{ deletedTasks: number; deletedSubtasks: number }> {
  const timestamp = nowISO();
  let deletedTasks = 0;
  let deletedSubtasks = 0;

  await db.transaction('rw', db.tasks, db.subtasks, db.logs, async () => {
    const tasks = await db.tasks.toArray();
    const subtasks = await db.subtasks.toArray();
    const activeTasks = tasks.filter((task) => !task.deletedAt);
    const activeSubtasks = subtasks.filter((subtask) => !subtask.deletedAt);

    deletedTasks = activeTasks.length;
    deletedSubtasks = activeSubtasks.length;

    if (activeTasks.length > 0) {
      await db.tasks.bulkPut(activeTasks.map((task) => ({
        ...task,
        deletedAt: timestamp,
        updatedAt: timestamp,
      })));
    }

    if (activeSubtasks.length > 0) {
      await db.subtasks.bulkPut(activeSubtasks.map((subtask) => ({
        ...subtask,
        deletedAt: timestamp,
        updatedAt: timestamp,
      })));
    }

    await createLogEvent({
      type: 'task_cancelled',
      entityType: 'system',
      entityId: null,
      message: `Soft-deleted all tasks: ${deletedTasks} tasks, ${deletedSubtasks} subtasks`,
      metadata: { source: 'clear_all_tasks', deletedTasks, deletedSubtasks },
    });
  });

  return { deletedTasks, deletedSubtasks };
}

export async function updateTask(taskId: string, patch: Partial<Task>): Promise<void> {
  await db.transaction('rw', db.tasks, db.logs, async () => {
    await db.tasks.update(taskId, { ...patch, updatedAt: nowISO() });
    await createLogEvent({
      type: 'task_updated',
      entityType: 'task',
      entityId: taskId,
      message: 'Task updated',
      metadata: { patch },
    });
  });
}


export async function updateTaskText(taskId: string, patch: Pick<Partial<Task>, 'title' | 'whyNow' | 'notes' | 'aiConversationUrl'>): Promise<void> {
  const normalizedPatch: Pick<Partial<Task>, 'title' | 'whyNow' | 'notes' | 'aiConversationUrl'> = {};
  if (typeof patch.title === 'string') normalizedPatch.title = patch.title.trim();
  if (typeof patch.whyNow === 'string') normalizedPatch.whyNow = patch.whyNow.trim() || undefined;
  if (typeof patch.notes === 'string') normalizedPatch.notes = patch.notes.trim() || undefined;
  if (typeof patch.aiConversationUrl === 'string') normalizedPatch.aiConversationUrl = patch.aiConversationUrl.trim() || null;

  await db.transaction('rw', db.tasks, db.logs, async () => {
    await db.tasks.update(taskId, { ...normalizedPatch, updatedAt: nowISO() });
    await createLogEvent({
      type: 'task_updated',
      entityType: 'task',
      entityId: taskId,
      message: 'Task text updated',
      metadata: { patch: normalizedPatch },
    });
  });
}


export async function updateTaskDetails(taskId: string, patch: UpdateTaskDetailsPatch): Promise<void> {
  const normalizedPatch: UpdateTaskDetailsPatch = {};
  if (typeof patch.projectId === 'string') normalizedPatch.projectId = patch.projectId;
  if (typeof patch.domainId === 'string') normalizedPatch.domainId = patch.domainId;
  if (patch.priority) normalizedPatch.priority = patch.priority;
  if (patch.effort) normalizedPatch.effort = patch.effort;
  if (Array.isArray(patch.tags)) normalizedPatch.tags = Array.from(new Set(patch.tags.map((tag) => tag.trim()).filter(Boolean)));

  const updatePatch: Partial<Task> = {
    ...normalizedPatch,
    ...(patch.effort ? { isQuickWin: patch.effort === 'quick' } : {}),
    updatedAt: nowISO(),
  };

  await db.transaction('rw', db.tasks, db.logs, async () => {
    await db.tasks.update(taskId, updatePatch);
    await createLogEvent({
      type: 'task_updated',
      entityType: 'task',
      entityId: taskId,
      message: 'Task details updated',
      metadata: { patch: updatePatch },
    });
  });
}

export async function updateSubtaskStatus(subtaskId: string, status: SubtaskStatus): Promise<void> {
  const timestamp = nowISO();

  await db.transaction('rw', db.tasks, db.subtasks, db.logs, async () => {
    const currentSubtask = await db.subtasks.get(subtaskId);
    if (!currentSubtask) {
      throw new Error(`Subtask not found: ${subtaskId}`);
    }

    const patch: Partial<Subtask> = {
      status,
      updatedAt: timestamp,
    };

    if (status === 'started') {
      patch.startedAt = currentSubtask.startedAt ?? timestamp;
      patch.completedAt = null;
      patch.cancelledAt = null;
    }

    if (status === 'done') {
      patch.startedAt = currentSubtask.startedAt ?? timestamp;
      patch.completedAt = currentSubtask.completedAt ?? timestamp;
      patch.cancelledAt = null;
    }

    if (status === 'cancelled') {
      patch.cancelledAt = currentSubtask.cancelledAt ?? timestamp;
    }

    if (status === 'not_started') {
      patch.startedAt = null;
      patch.completedAt = null;
      patch.cancelledAt = null;
    }

    await db.subtasks.update(subtaskId, patch);

    const taskSubtasks = await db.subtasks.where('taskId').equals(currentSubtask.taskId).toArray();
    const updatedSubtasks = taskSubtasks.map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, ...patch } : subtask,
    );
    const activeSubtasks = updatedSubtasks.filter((subtask) => !subtask.deletedAt && subtask.status !== 'cancelled');
    const allActiveDone = activeSubtasks.length > 0 && activeSubtasks.every((subtask) => subtask.status === 'done');

    await db.tasks.update(currentSubtask.taskId, {
      completedAt: allActiveDone ? timestamp : null,
      updatedAt: timestamp,
    });

    await createLogEvent({
      type:
        status === 'done'
          ? 'subtask_completed'
          : status === 'started'
            ? 'subtask_started'
            : status === 'cancelled'
              ? 'subtask_cancelled'
              : 'task_updated',
      entityType: 'subtask',
      entityId: subtaskId,
      message: `Subtask status changed to ${status}`,
      metadata: { taskId: currentSubtask.taskId, previousStatus: currentSubtask.status, nextStatus: status },
    });
  });
}

export async function updateSubtaskText(
  subtaskId: string,
  patch: { title?: string; notes?: string; aiConversationUrl?: string | null },
): Promise<void> {
  const timestamp = nowISO();
  const title = patch.title?.trim();
  if (patch.title !== undefined && !title) {
    throw new Error('Subtask title is required');
  }

  await db.transaction('rw', db.subtasks, db.logs, async () => {
    const currentSubtask = await db.subtasks.get(subtaskId);
    if (!currentSubtask) {
      throw new Error(`Subtask not found: ${subtaskId}`);
    }

    const updatePatch: Partial<Subtask> = {
      updatedAt: timestamp,
    };
    if (patch.title !== undefined) updatePatch.title = title;
    if (patch.notes !== undefined) updatePatch.notes = patch.notes;
    if (patch.aiConversationUrl !== undefined) updatePatch.aiConversationUrl = patch.aiConversationUrl?.trim() || null;

    await db.subtasks.update(subtaskId, updatePatch);
    await createLogEvent({
      type: 'task_updated',
      entityType: 'subtask',
      entityId: subtaskId,
      message: 'Subtask text updated',
      metadata: { taskId: currentSubtask.taskId },
    });
  });
}

export async function moveTaskToDate(task: Task, targetDate: string): Promise<void> {
  const today = getTodayISO();
  const tomorrow = getTomorrowISO(new Date(`${today}T12:00:00`));
  const targetBucket = targetDate === today ? 'today' : 'backlog';
  const targetBacklogGroup = targetDate === today ? null : targetDate === tomorrow ? 'tomorrow' : 'this_week';

  await db.transaction('rw', db.tasks, db.logs, async () => {
    await db.tasks.update(task.id, {
      bucket: targetBucket,
      backlogGroup: targetBacklogGroup,
      date: targetDate,
      movedToDate: targetDate,
      movedCount: task.movedCount + 1,
      updatedAt: nowISO(),
    });
    await createLogEvent({
      type: 'task_moved',
      entityType: 'task',
      entityId: task.id,
      message: `Task moved to ${targetDate}`,
      metadata: { fromDate: task.date, toDate: targetDate, targetBucket, targetBacklogGroup },
    });
  });
}

export async function moveTaskToTomorrow(task: Task): Promise<void> {
  const today = getTodayISO();
  await moveTaskToDate(task, getTomorrowISO(new Date(`${today}T12:00:00`)));
}

export async function cancelTask(taskId: string): Promise<void> {
  const timestamp = nowISO();
  await db.transaction('rw', db.tasks, db.logs, async () => {
    await db.tasks.update(taskId, {
      statusOverride: 'cancelled',
      cancelledAt: timestamp,
      updatedAt: timestamp,
    });
    await createLogEvent({
      type: 'task_cancelled',
      entityType: 'task',
      entityId: taskId,
      message: 'Task cancelled',
    });
  });
}

export type FocusOrderAction = 'first' | 'up' | 'down' | 'bottom';

function compareTasksForFocus(a: Task, b: Task): number {
  const aOrder = typeof a.focusOrder === 'number' ? a.focusOrder : null;
  const bOrder = typeof b.focusOrder === 'number' ? b.focusOrder : null;
  if (aOrder !== null && bOrder !== null && aOrder !== bOrder) return aOrder - bOrder;
  if (aOrder !== null && bOrder === null) return -1;
  if (aOrder === null && bOrder !== null) return 1;
  const created = (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0);
  if (created !== 0) return created;
  return a.title.localeCompare(b.title);
}

export async function reorderTodayTaskFocus(taskId: string, action: FocusOrderAction, todayISO: string = getTodayISO()): Promise<void> {
  const timestamp = nowISO();

  await db.transaction('rw', db.tasks, db.logs, async () => {
    const tasks = (await db.tasks.toArray())
      .filter((task) => !task.deletedAt && task.statusOverride !== 'cancelled' && task.bucket === 'today' && task.date === todayISO)
      .sort(compareTasksForFocus);

    const currentIndex = tasks.findIndex((task) => task.id === taskId);
    if (currentIndex < 0) return;

    const [selected] = tasks.splice(currentIndex, 1);
    if (!selected) return;

    if (action === 'first') {
      tasks.unshift(selected);
    } else if (action === 'up') {
      tasks.splice(Math.max(0, currentIndex - 1), 0, selected);
    } else if (action === 'down') {
      tasks.splice(Math.min(tasks.length, currentIndex + 1), 0, selected);
    } else {
      tasks.push(selected);
    }

    await Promise.all(tasks.map((task, index) => db.tasks.update(task.id, {
      focusOrder: (index + 1) * 1000,
      focusUpdatedAt: timestamp,
      updatedAt: timestamp,
    })));

    await createLogEvent({
      type: 'task_updated',
      entityType: 'task',
      entityId: taskId,
      message: `Task focus order changed: ${action}`,
      metadata: { action, todayISO },
    });
  });
}


export async function addRecurringDefinitionToToday(definitionId: string): Promise<Task> {
  const timestamp = nowISO();
  const today = getTodayISO();

  return db.transaction('rw', db.tasks, db.subtasks, db.recurringDefinitions, db.logs, async () => {
    const definition = await db.recurringDefinitions.get(definitionId);
    if (!definition) {
      throw new Error(`Recurring definition not found: ${definitionId}`);
    }

    const existingTask = await db.tasks
      .where('date')
      .equals(today)
      .filter((task) => !task.deletedAt && task.recurrenceDefinitionId === definition.id && task.statusOverride !== 'cancelled')
      .first();

    if (existingTask) {
      return existingTask;
    }

    const task: Task = {
      id: createId('task'),
      title: definition.title,
      projectId: definition.projectId,
      domainId: definition.domainId,
      bucket: 'today',
      date: today,
      originalDate: today,
      scheduledTimeLabel: definition.defaultScheduledTimeLabel ?? 'היום',
      estimatedDurationMinutes: definition.defaultSubtasks.reduce(
        (sum, subtask) => sum + (subtask.estimatedDurationMinutes ?? 0),
        0,
      ) || null,
      durationLabel: undefined,
      priority: 'medium',
      effort: 'medium',
      isQuickWin: definition.defaultSubtasks.every((subtask) => (subtask.estimatedDurationMinutes ?? 999) <= 10),
      isRecurring: true,
      recurrenceDefinitionId: definition.id,
      backlogGroup: null,
      tags: ['recurring'],
      whyNow: definition.preferredTimingNote ? `משימה חוזרת: ${definition.preferredTimingNote}` : 'משימה חוזרת שנוספה ידנית להיום.',
      notes: undefined,
      statusOverride: null,
      movedCount: 0,
      movedToDate: null,
      source: 'recurring',
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      cancelledAt: null,
    };

    const subtasks: Subtask[] = (definition.defaultSubtasks.length > 0 ? definition.defaultSubtasks : [{ title: definition.title, sortOrder: 0 }]).map(
      (subtask, index) => ({
        id: createId('subtask'),
        taskId: task.id,
        title: subtask.title,
        domainId: subtask.domainId ?? definition.domainId,
        estimatedDurationMinutes: subtask.estimatedDurationMinutes ?? null,
        durationLabel: undefined,
        toolsNeeded: subtask.toolsNeeded,
        notes: subtask.notes,
        status: 'not_started',
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        sortOrder: subtask.sortOrder ?? index,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );

    await db.tasks.add(task);
    await db.subtasks.bulkAdd(subtasks);
    await db.recurringDefinitions.update(definition.id, { lastGeneratedAt: timestamp, updatedAt: timestamp });
    await createLogEvent({
      type: 'recurring_added_to_today',
      entityType: 'recurring',
      entityId: definition.id,
      message: `Recurring definition added to today: ${definition.title}`,
      metadata: { taskId: task.id, date: today },
    });

    return task;
  });
}
