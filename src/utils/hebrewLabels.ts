import type { BacklogGroup, TaskEffort, TaskPriority, TaskStatusDerived } from '../domain/tasks/taskTypes';
import type { RecurrenceFrequency } from '../domain/recurring/recurringTypes';

export const statusLabels: Record<TaskStatusDerived, string> = {
  not_started: 'פתוח',
  in_progress: 'בתהליך',
  done: 'בוצע',
  cancelled: 'בוטל',
  moved: 'הועבר',
};

export const priorityLabels: Record<TaskPriority, string> = {
  high: 'גבוהה',
  medium: 'בינונית',
  low: 'נמוכה',
};

export const effortLabels: Record<TaskEffort, string> = {
  quick: 'קלילה',
  medium: 'בינונית',
  deep: 'עמוקה',
};

export const backlogLabels: Record<BacklogGroup, string> = {
  tomorrow: 'מחר',
  this_week: 'השבוע',
  waiting: 'ממתין',
  later: 'בהמשך',
};

export const recurrenceLabels: Record<RecurrenceFrequency, string> = {
  every_day: 'כל יום',
  three_times_per_week: '3 פעמים בשבוע',
  once_per_week: 'פעם בשבוע',
  once_every_two_weeks: 'פעם בשבועיים',
  once_per_month: 'פעם בחודש',
};
