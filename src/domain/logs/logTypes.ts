export type LogEventType =
  | 'task_created'
  | 'task_updated'
  | 'task_moved'
  | 'task_cancelled'
  | 'subtask_started'
  | 'subtask_completed'
  | 'subtask_cancelled'
  | 'report_generated'
  | 'backup_created'
  | 'settings_updated'
  | 'recurring_created'
  | 'recurring_added_to_today'
  | 'snapshot_created'
  | 'note_added';

export interface LogEvent {
  id: string;
  timestamp: string;
  type: LogEventType;
  entityType: 'task' | 'subtask' | 'report' | 'settings' | 'backup' | 'recurring' | 'reminder' | 'system';
  entityId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}
