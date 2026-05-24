export type TaskBucket = 'today' | 'backlog' | 'weekly' | 'recurring';

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskEffort = 'quick' | 'medium' | 'deep';

export type BacklogGroup = 'tomorrow' | 'this_week' | 'waiting' | 'later';

export type TaskStatusDerived = 'not_started' | 'in_progress' | 'done' | 'cancelled' | 'moved';

export interface Task {
  id: string;
  title: string;
  projectId: string;
  domainId: string;
  bucket: TaskBucket;
  date: string | null;
  originalDate: string | null;
  scheduledTimeLabel?: string;
  estimatedDurationMinutes?: number | null;
  durationLabel?: string;
  priority: TaskPriority;
  effort: TaskEffort;
  isQuickWin: boolean;
  isRecurring: boolean;
  recurrenceDefinitionId?: string | null;
  backlogGroup?: BacklogGroup | null;
  tags: string[];
  whyNow?: string;
  notes?: string;
  statusOverride?: 'cancelled' | 'moved' | null;
  movedCount: number;
  movedToDate?: string | null;
  focusOrder?: number | null;
  focusUpdatedAt?: string | null;
  source: 'manual' | 'recurring' | 'imported' | 'interruption' | 'seed';
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
  deletedAt?: string | null;
}

export type SubtaskStatus = 'not_started' | 'started' | 'done' | 'cancelled';

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  domainId?: string | null;
  estimatedDurationMinutes?: number | null;
  durationLabel?: string;
  toolsNeeded?: string;
  notes?: string;
  status: SubtaskStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  deletedAt?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
