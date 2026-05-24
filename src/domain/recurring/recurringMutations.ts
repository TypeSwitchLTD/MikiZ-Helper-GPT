import { db } from '../../db/db';
import type { LogEvent } from '../logs/logTypes';
import type { RecurrenceFrequency, RecurringTaskDefinition } from './recurringTypes';
import { nowISO } from '../../utils/dates';
import { createId } from '../../utils/ids';

type RecurringImportTask = {
  title?: string;
  durationMinutes?: number | null;
  estimatedDurationMinutes?: number | null;
  bucket?: string;
  isRecurring?: boolean;
  scheduledTimeLabel?: string | null;
  projectId?: string;
  domainId?: string;
  tags?: string[];
  notes?: string;
};

function addLog(message: string, metadata: Record<string, unknown>): LogEvent {
  return {
    id: createId('log'),
    timestamp: nowISO(),
    type: 'recurring_created',
    entityType: 'recurring',
    entityId: null,
    message,
    metadata,
  };
}

function asTaskArray(payload: unknown): RecurringImportTask[] {
  if (Array.isArray(payload)) return payload as RecurringImportTask[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { tasks?: unknown[] }).tasks)) {
    return (payload as { tasks: RecurringImportTask[] }).tasks;
  }
  return [];
}

function getFrequency(task: RecurringImportTask): RecurrenceFrequency {
  const text = `${task.title ?? ''} ${(task.tags ?? []).join(' ')}`.toLowerCase();
  if (text.includes('monthly') || text.includes('חודשי')) return 'once_per_month';
  if (text.includes('weekly') || text.includes('שבועי')) return 'once_per_week';
  if (text.includes('daily') || text.includes('יומי')) return 'every_day';
  return 'once_per_week';
}

function cleanRecurringTitle(title: string): string {
  return title
    .replace(/^\s*(יומי|שבועי|חודשי)\s*[—–-]\s*/u, '')
    .trim();
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

export function buildRecurringDefinitionsFromTaskImport(payload: unknown): RecurringTaskDefinition[] {
  const timestamp = nowISO();
  const tasks = asTaskArray(payload).filter((task) => task.bucket === 'recurring' || task.isRecurring);

  return tasks
    .map((task, index): RecurringTaskDefinition | null => {
      const rawTitle = task.title?.trim();
      if (!rawTitle) return null;
      const title = cleanRecurringTitle(rawTitle) || rawTitle;
      const frequency = getFrequency(task);
      const duration = task.durationMinutes ?? task.estimatedDurationMinutes ?? null;
      const projectId = task.projectId || 'personal';
      const domainId = task.domainId || 'personal';
      const id = `recurring-import-${frequency}-${hashString(`${rawTitle}:${projectId}:${domainId}:${index}`)}`;

      return {
        id,
        sourceTaskId: null,
        title,
        projectId,
        domainId,
        frequency,
        preferredTimingNote: task.notes,
        defaultScheduledTimeLabel: task.scheduledTimeLabel ?? undefined,
        defaultSubtasks: [
          {
            title,
            domainId,
            estimatedDurationMinutes: duration,
            sortOrder: 0,
          },
        ],
        isActive: true,
        deletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastGeneratedAt: null,
      };
    })
    .filter((definition): definition is RecurringTaskDefinition => Boolean(definition));
}

export async function softDeleteAllRecurringDefinitions(): Promise<number> {
  const timestamp = nowISO();
  return db.transaction('rw', db.recurringDefinitions, db.logs, async () => {
    const definitions = await db.recurringDefinitions.filter((definition) => !definition.deletedAt).toArray();
    if (!definitions.length) return 0;
    await db.recurringDefinitions.bulkPut(
      definitions.map((definition) => ({
        ...definition,
        isActive: false,
        deletedAt: timestamp,
        updatedAt: timestamp,
      })),
    );
    await db.logs.add(addLog('Recurring definitions cleared', { count: definitions.length }));
    return definitions.length;
  });
}

export async function replaceRecurringDefinitionsFromTaskImport(payload: unknown): Promise<number> {
  const definitions = buildRecurringDefinitionsFromTaskImport(payload);
  if (!definitions.length) {
    throw new Error('לא נמצאו משימות חוזרות בקובץ.');
  }

  const timestamp = nowISO();
  return db.transaction('rw', db.recurringDefinitions, db.logs, async () => {
    const existing = await db.recurringDefinitions.filter((definition) => !definition.deletedAt).toArray();
    if (existing.length) {
      await db.recurringDefinitions.bulkPut(
        existing.map((definition) => ({
          ...definition,
          isActive: false,
          deletedAt: timestamp,
          updatedAt: timestamp,
        })),
      );
    }
    await db.recurringDefinitions.bulkPut(definitions);
    await db.logs.add(addLog('Recurring definitions replaced from import', {
      cleared: existing.length,
      imported: definitions.length,
    }));
    return definitions.length;
  });
}
