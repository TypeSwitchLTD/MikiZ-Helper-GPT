export type RecurrenceFrequency =
  | 'every_day'
  | 'three_times_per_week'
  | 'once_per_week'
  | 'once_every_two_weeks'
  | 'once_per_month';

export interface RecurringTaskDefinition {
  id: string;
  sourceTaskId?: string | null;
  title: string;
  projectId: string;
  domainId: string;
  frequency: RecurrenceFrequency;
  preferredTimingNote?: string;
  defaultScheduledTimeLabel?: string;
  defaultSubtasks: Array<{
    title: string;
    domainId?: string | null;
    estimatedDurationMinutes?: number | null;
    toolsNeeded?: string;
    notes?: string;
    sortOrder: number;
  }>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastGeneratedAt?: string | null;
}
