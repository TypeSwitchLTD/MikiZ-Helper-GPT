import type { RecurringTaskDefinition } from './recurringTypes';
import type { Task } from '../tasks/taskTypes';

export type RecurringDisplayState = 'due_today' | 'already_added_today' | 'not_due_today' | 'missed';

export interface RecurringDefinitionViewModel {
  definition: RecurringTaskDefinition;
  state: RecurringDisplayState;
  alreadyAddedToday: boolean;
  lastGeneratedDate: string | null;
}

function toLocalDate(dateISO: string): Date {
  return new Date(`${dateISO}T12:00:00`);
}

function dateOnly(value?: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function getDaysSinceEpoch(dateISO: string): number {
  const date = toLocalDate(dateISO);
  return Math.floor(date.getTime() / 86_400_000);
}

export function isRecurringDueToday(definition: RecurringTaskDefinition, todayISO: string): boolean {
  const date = toLocalDate(todayISO);
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();

  switch (definition.frequency) {
    case 'every_day':
      return true;
    case 'three_times_per_week':
      return dayOfWeek === 0 || dayOfWeek === 2 || dayOfWeek === 4;
    case 'once_per_week':
      return dayOfWeek === 0;
    case 'once_every_two_weeks':
      return dayOfWeek === 0 && Math.floor(getDaysSinceEpoch(todayISO) / 14) % 2 === 0;
    case 'once_per_month':
      return dayOfMonth === 1;
    default:
      return false;
  }
}

export function buildRecurringViewModels(
  definitions: RecurringTaskDefinition[],
  tasks: Task[],
  todayISO: string,
): RecurringDefinitionViewModel[] {
  return definitions
    .filter((definition) => definition.isActive && !definition.deletedAt)
    .map((definition) => {
      const alreadyAddedToday = tasks.some(
        (task) =>
          task.recurrenceDefinitionId === definition.id &&
          task.date === todayISO &&
          task.statusOverride !== 'cancelled',
      );
      const lastGeneratedDate = dateOnly(definition.lastGeneratedAt);
      const dueToday = isRecurringDueToday(definition, todayISO);
      const missed = Boolean(lastGeneratedDate && lastGeneratedDate < todayISO && !alreadyAddedToday);

      let state: RecurringDisplayState = 'not_due_today';
      if (alreadyAddedToday) {
        state = 'already_added_today';
      } else if (dueToday) {
        state = 'due_today';
      } else if (missed) {
        state = 'missed';
      }

      return { definition, state, alreadyAddedToday, lastGeneratedDate };
    })
    .sort((a, b) => {
      const stateOrder: Record<RecurringDisplayState, number> = {
        due_today: 0,
        missed: 1,
        already_added_today: 2,
        not_due_today: 3,
      };
      return stateOrder[a.state] - stateOrder[b.state] || a.definition.title.localeCompare(b.definition.title);
    });
}

export function getRecurringStateLabel(state: RecurringDisplayState): string {
  switch (state) {
    case 'due_today':
      return 'מומלץ להיום';
    case 'already_added_today':
      return 'כבר נוסף להיום';
    case 'missed':
      return 'לא טופל לאחרונה';
    case 'not_due_today':
      return 'לא דחוף היום';
    default:
      return 'לא ידוע';
  }
}
