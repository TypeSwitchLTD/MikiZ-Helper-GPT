import type { DailyPlan } from '../dailyPlans/dailyPlanTypes';
import type { LogEvent } from '../logs/logTypes';
import type { RecurringTaskDefinition } from '../recurring/recurringTypes';
import type { DailyReport } from '../reports/reportTypes';
import type { Reminder } from '../reminders/reminderTypes';
import type { AppSettings } from '../settings/settingsTypes';
import type { Subtask, Task } from '../tasks/taskTypes';

export interface CloudSyncPayload {
  schemaVersion: '0.6.0';
  exportedAt: string;
  appVersion: string;
  tasks: Task[];
  subtasks: Subtask[];
  dailyPlans: DailyPlan[];
  recurringDefinitions: RecurringTaskDefinition[];
  reports: DailyReport[];
  logs: LogEvent[];
  reminders: Reminder[];
  settings: AppSettings;
}

export interface CloudSyncResult {
  ok: boolean;
  message?: string;
  error?: string;
  payload?: CloudSyncPayload;
  counts?: Record<string, number>;
  syncedAt?: string;
}

function getEndpoint(settings: AppSettings | null | undefined): string {
  const base = settings?.morningBriefing?.androidPublishEndpoint?.trim() || '/api/morning-briefing';
  if (base.includes('/api/morning-briefing')) return base.replace('/api/morning-briefing', '/api/sync-state');
  if (base.includes('/api/sync-state')) return base;
  return '/api/sync-state';
}

export function hasCloudSyncToken(settings: AppSettings | null | undefined): boolean {
  return Boolean(settings?.morningBriefing?.androidPublishToken?.trim());
}

export async function pushCloudSyncPayload(settings: AppSettings, payload: CloudSyncPayload): Promise<CloudSyncResult> {
  const token = settings.morningBriefing?.androidPublishToken?.trim();
  if (!token) return { ok: false, error: 'חסר Token בהגדרות נאום בוקר / Android.' };

  const response = await fetch(getEndpoint(settings), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ token, payload }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.ok) {
    return { ok: false, error: result?.error || `Cloud sync failed (${response.status})` };
  }
  return result as CloudSyncResult;
}

export async function pullCloudSyncPayload(settings: AppSettings): Promise<CloudSyncResult> {
  const token = settings.morningBriefing?.androidPublishToken?.trim();
  if (!token) return { ok: false, error: 'חסר Token בהגדרות נאום בוקר / Android.' };
  const separator = getEndpoint(settings).includes('?') ? '&' : '?';
  const response = await fetch(`${getEndpoint(settings)}${separator}token=${encodeURIComponent(token)}`, { headers: { 'Cache-Control': 'no-store' } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.ok) {
    return { ok: false, error: result?.error || `Cloud pull failed (${response.status})` };
  }
  return result as CloudSyncResult;
}
