import type { DailyPlan } from '../domain/dailyPlans/dailyPlanTypes';
import type { LogEvent } from '../domain/logs/logTypes';
import type { RecurringTaskDefinition } from '../domain/recurring/recurringTypes';
import type { DailyReport } from '../domain/reports/reportTypes';
import type { Reminder } from '../domain/reminders/reminderTypes';
import type { AppSettings } from '../domain/settings/settingsTypes';
import type { Subtask, Task } from '../domain/tasks/taskTypes';

export const DATABASE_NAME = 'mission-control-local';
export const DATABASE_VERSION = 5;
export const APP_VERSION = '0.7.4';

export interface BackupSnapshot {
  id: string;
  createdAt: string;
  reason: 'interval' | 'manual' | 'before_close' | 'report' | 'import' | 'visibility_hidden' | 'seed' | 'app_update' | 'migration';
  appVersion: string;
  data: {
    tasks: Task[];
    subtasks: Subtask[];
    dailyPlans: DailyPlan[];
    recurringDefinitions: RecurringTaskDefinition[];
    reports: DailyReport[];
    logs: LogEvent[];
    reminders?: Reminder[];
    settings: AppSettings;
  };
}
