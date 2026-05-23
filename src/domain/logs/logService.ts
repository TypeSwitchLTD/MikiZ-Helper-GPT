import { db } from '../../db/db';
import { createId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import type { LogEvent, LogEventType } from './logTypes';

interface CreateLogInput {
  type: LogEventType;
  entityType: LogEvent['entityType'];
  entityId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}

export async function createLogEvent(input: CreateLogInput): Promise<LogEvent> {
  const logEvent: LogEvent = {
    id: createId('log'),
    timestamp: nowISO(),
    ...input,
  };

  await db.logs.add(logEvent);
  return logEvent;
}
