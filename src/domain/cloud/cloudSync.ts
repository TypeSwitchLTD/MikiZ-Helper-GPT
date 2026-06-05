import type { DailyPlan } from '../dailyPlans/dailyPlanTypes';
import type { FocusItem } from '../focus/focusTypes';
import type { LogEvent } from '../logs/logTypes';
import type { RecurringTaskDefinition } from '../recurring/recurringTypes';
import type { DailyReport } from '../reports/reportTypes';
import type { Reminder } from '../reminders/reminderTypes';
import type { AppSettings } from '../settings/settingsTypes';
import type { Subtask, Task } from '../tasks/taskTypes';
import type { DailyHabit, DailyHabitLog } from '../habits/habitTypes';

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
  focusItems?: FocusItem[];
  habits?: DailyHabit[];
  habitLogs?: DailyHabitLog[];
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

function buildPullUrl(settings: AppSettings, token: string): string {
  const endpoint = getEndpoint(settings);
  const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const url = new URL(endpoint, base);
  url.searchParams.set('token', token);
  url.searchParams.set('_', String(Date.now()));

  if (/^https?:\/\//i.test(endpoint)) return url.toString();
  return `${url.pathname}${url.search}`;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(buildPullUrl(settings, token), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.ok) {
      return { ok: false, error: result?.error || `Cloud pull failed (${response.status})` };
    }
    return result as CloudSyncResult;
  } finally {
    clearTimeout(timeout);
  }
}
