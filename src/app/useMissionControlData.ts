import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllLocalData, importDailyStatePayload, initializeLocalDatabase, rolloverStaleTodayTasks } from '../db/localData';
import { hasCloudSyncToken, pullCloudSyncPayload, pushCloudSyncPayload, type CloudSyncPayload } from '../domain/cloud/cloudSync';
import { db } from '../db/db';
import type { DailyPlan, DailyPlanBlock } from '../domain/dailyPlans/dailyPlanTypes';
import type { LogEvent } from '../domain/logs/logTypes';
import type { RecurringTaskDefinition } from '../domain/recurring/recurringTypes';
import type { DailyReportImportTaskDraft } from '../domain/import/dailyReportImport';
import type { DailyReport } from '../domain/reports/reportTypes';
import type { Reminder } from '../domain/reminders/reminderTypes';
import { cancelReminder, createReminder, markReminderSent, snoozeReminder, type CreateReminderInput } from '../domain/reminders/reminderMutations';
import { createHabit, updateHabit, deleteHabit, reorderHabits, incrementHabitCount, type CreateHabitInput } from '../domain/habits/habitMutations';
import type { DailyHabit, DailyHabitLog } from '../domain/habits/habitTypes';
import { updateAppSettings, type SettingsPatch } from '../domain/settings/settingsService';
import { createDefaultSettings } from '../domain/settings/defaultSettings';
import type { AppSettings } from '../domain/settings/settingsTypes';
import {
  addRecurringDefinitionToToday,
  addSubtaskToTask,
  cancelTask,
  softDeleteAllTasks,
  importDailyReportTasks,
  deleteLastDailyReportImport,
  createTaskWithSubtasks,
  moveTaskToDate,
  moveTaskToTomorrow,
  updateSubtaskStatus,
  updateSubtaskText,
  updateTaskDetails,
  updateTaskText,
  reorderTodayTaskFocus,
  type AddSubtaskInput,
  type FocusOrderAction,
  type CreateTaskInput,
} from '../domain/tasks/taskMutations';
import type { Subtask, Task } from '../domain/tasks/taskTypes';
import { getTaskProgress } from '../domain/tasks/taskProgress';
import { getInProgressTasks, getQuickWinTasks, getTodayTasks } from '../domain/tasks/taskSelectors';
import { getTodayISO, nowISO } from '../utils/dates';
import { createId } from '../utils/ids';

interface MissionControlData {
  tasks: Task[];
  subtasks: Subtask[];
  dailyPlans: DailyPlan[];
  recurringDefinitions: RecurringTaskDefinition[];
  reports: DailyReport[];
  logs: LogEvent[];
  reminders: Reminder[];
  settings: AppSettings | null;
  habits: DailyHabit[];
  habitLogs: DailyHabitLog[];
}

const emptyData: MissionControlData = {
  tasks: [],
  subtasks: [],
  dailyPlans: [],
  recurringDefinitions: [],
  reports: [],
  logs: [],
  reminders: [],
  settings: null,
  habits: [],
  habitLogs: [],
};

function getCloudTokenFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return (params.get('token') || params.get('mc_token') || params.get('morning_token') || '').trim();
}

function getCloudEndpointFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return (params.get('endpoint') || params.get('mc_endpoint') || '').trim();
}

function removeCloudBootstrapParamsFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  ['token', 'mc_token', 'morning_token', 'endpoint', 'mc_endpoint'].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}


function mergeCloudWithLocalTokens(cloudPayload: CloudSyncPayload, localSettings: AppSettings | null): CloudSyncPayload {
  if (!localSettings || !cloudPayload.settings) return cloudPayload;
  const cloud = cloudPayload.settings;
  const local = localSettings;
  const mergedSettings: AppSettings = {
    ...cloud,
    voice: {
      ...cloud.voice,
      elevenLabsApiKey: local.voice?.elevenLabsApiKey || cloud.voice?.elevenLabsApiKey || '',
      elevenLabsVoiceId: local.voice?.elevenLabsVoiceId || cloud.voice?.elevenLabsVoiceId || '',
      elevenLabsProxyUrl: local.voice?.elevenLabsProxyUrl || cloud.voice?.elevenLabsProxyUrl || '',
    },
    morningBriefing: {
      ...cloud.morningBriefing,
      androidPublishToken: local.morningBriefing?.androidPublishToken || cloud.morningBriefing?.androidPublishToken || '',
      androidPublishEndpoint: local.morningBriefing?.androidPublishEndpoint || cloud.morningBriefing?.androidPublishEndpoint || '/api/morning-briefing',
    },
    instantly: { apiKey: local.instantly?.apiKey || cloud.instantly?.apiKey },
  };
  const tasks = Array.isArray(cloudPayload.tasks) ? cloudPayload.tasks : [];
  const subtasks = Array.isArray(cloudPayload.subtasks) ? cloudPayload.subtasks : [];
  return { ...cloudPayload, settings: mergedSettings, tasks, subtasks };
}

function buildCloudSyncPayload(localData: MissionControlData): CloudSyncPayload | null {
  if (!localData.settings) return null;
  return {
    schemaVersion: '0.6.0',
    exportedAt: nowISO(),
    appVersion: '0.6.0-cloud-sync-foundation',
    tasks: localData.tasks,
    subtasks: localData.subtasks,
    dailyPlans: localData.dailyPlans,
    recurringDefinitions: localData.recurringDefinitions,
    reports: localData.reports,
    logs: localData.logs,
    reminders: localData.reminders,
    settings: localData.settings,
  };
}

export function useMissionControlData() {
  const [data, setData] = useState<MissionControlData>(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<string>('');

  const reloadData = useCallback(async () => {
    await initializeLocalDatabase();
    const localData = await getAllLocalData();
    setData(localData);
    setError(null);
  }, []);

  const pushLocalDataToCloud = useCallback(async () => {
    await initializeLocalDatabase();
    const localData = await getAllLocalData({ includeDeleted: true });
    const payload = buildCloudSyncPayload(localData);
    if (!payload || !hasCloudSyncToken(localData.settings)) {
      const message = 'Cloud sync לא הופעל: חסר Token בהגדרות Android Morning.';
      setCloudSyncStatus(message);
      return { ok: false, error: message };
    }
    setCloudSyncStatus('מסנכרן לענן...');
    const result = await pushCloudSyncPayload(localData.settings, payload);
    setCloudSyncStatus(result.ok ? `סונכרן לענן: ${result.counts?.tasks ?? 0} משימות, ${result.counts?.subtasks ?? 0} תתי־משימות` : `שגיאת Cloud sync: ${result.error}`);
    return result;
  }, []);

  const pullCloudDataToLocal = useCallback(async () => {
    await initializeLocalDatabase();
    const localData = await getAllLocalData();
    if (!hasCloudSyncToken(localData.settings)) {
      const message = 'Cloud pull לא הופעל: חסר Token בהגדרות Android Morning.';
      setCloudSyncStatus(message);
      return { ok: false, error: message };
    }
    setCloudSyncStatus('טוען מהענן...');
    try {
      const result = await pullCloudSyncPayload(localData.settings);
      if (!result.ok || !result.payload) {
        setCloudSyncStatus(`שגיאת טעינה מהענן: ${result.error ?? 'לא נמצא מידע בענן'}`);
        return result;
      }
      // Merge: always preserve local API tokens — never let a cloud pull erase them
      const local = localData.settings;
      const cloud = result.payload.settings;
      const mergedSettings: AppSettings | null = cloud && local ? {
        ...cloud,
        voice: {
          ...cloud.voice,
          elevenLabsApiKey: local.voice?.elevenLabsApiKey || cloud.voice?.elevenLabsApiKey || '',
          elevenLabsVoiceId: local.voice?.elevenLabsVoiceId || cloud.voice?.elevenLabsVoiceId || '',
          elevenLabsProxyUrl: local.voice?.elevenLabsProxyUrl || cloud.voice?.elevenLabsProxyUrl || '',
        },
        morningBriefing: {
          ...cloud.morningBriefing,
          androidPublishToken: local.morningBriefing?.androidPublishToken || cloud.morningBriefing?.androidPublishToken || '',
          androidPublishEndpoint: local.morningBriefing?.androidPublishEndpoint || cloud.morningBriefing?.androidPublishEndpoint || '/api/morning-briefing',
        },
        instantly: { apiKey: local.instantly?.apiKey || cloud.instantly?.apiKey },
      } : (cloud ?? local ?? null);

      const mergedPayload = { ...result.payload, settings: mergedSettings };
      const tasks = Array.isArray(mergedPayload.tasks) ? mergedPayload.tasks : [];
      const subtasks = Array.isArray(mergedPayload.subtasks) ? mergedPayload.subtasks : [];
      // Skip the tasks-required check for cloud pulls — settings sync is valid even with no tasks
      if (tasks.length > 0 || subtasks.length > 0 || mergedSettings) {
        await importDailyStatePayload(mergedPayload);
      }
      const nextData = await getAllLocalData();
      setData(nextData);
      setCloudSyncStatus(`נטען מהענן: ${result.counts?.tasks ?? tasks.length} משימות`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'שגיאה לא ידועה בטעינה מהענן';
      setCloudSyncStatus(`שגיאת טעינה מהענן: ${message}`);
      return { ok: false, error: message };
    }
  }, []);

  const reloadDataAndPushCloud = useCallback(async () => {
    await reloadData();
    try {
      const localData = await getAllLocalData({ includeDeleted: true });
      if (hasCloudSyncToken(localData.settings)) {
        const payload = buildCloudSyncPayload(localData);
        if (payload) {
          const result = await pushCloudSyncPayload(localData.settings, payload);
          setCloudSyncStatus(result.ok ? `סונכרן לענן: ${result.counts?.tasks ?? 0} משימות` : `שגיאת Cloud sync: ${result.error}`);
        }
      }
    } catch (syncError) {
      setCloudSyncStatus(syncError instanceof Error ? `שגיאת Cloud sync: ${syncError.message}` : 'שגיאת Cloud sync לא ידועה');
    }
  }, [reloadData]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        await initializeLocalDatabase();
        // Roll-over stale "today" tasks once per day
        const ROLLOVER_KEY = `mc-rollover:${getTodayISO()}`;
        if (typeof window !== 'undefined' && !sessionStorage.getItem(ROLLOVER_KEY)) {
          await rolloverStaleTodayTasks();
          sessionStorage.setItem(ROLLOVER_KEY, 'done');
        }
        let localData = await getAllLocalData();

        const urlToken = getCloudTokenFromUrl();
        const urlEndpoint = getCloudEndpointFromUrl();
        if (urlToken && !hasCloudSyncToken(localData.settings)) {
          // ── Bootstrap: first time on this device with a URL token ──
          const existingSettings = localData.settings ?? createDefaultSettings();
          await updateAppSettings({
            morningBriefing: {
              ...existingSettings.morningBriefing,
              androidPublishToken: urlToken,
              androidPublishEndpoint: urlEndpoint || existingSettings.morningBriefing.androidPublishEndpoint || '/api/morning-briefing',
            },
          });
          localData = await getAllLocalData();
          if (localData.settings && hasCloudSyncToken(localData.settings)) {
            try {
              const cloudResult = await pullCloudSyncPayload(localData.settings);
              if (cloudResult.ok && cloudResult.payload && cloudResult.payload.settings) {
                const mergedBootstrap = mergeCloudWithLocalTokens(cloudResult.payload, localData.settings);
                await importDailyStatePayload(mergedBootstrap);
                await rolloverStaleTodayTasks(); // move any stale today-tasks to today after bootstrap
                localData = await getAllLocalData();
                setCloudSyncStatus(`נטען מהענן למכשיר חדש: ${cloudResult.counts?.tasks ?? localData.tasks.length} משימות`);
              } else {
                setCloudSyncStatus(`Token נשמר, אבל טעינת ענן נכשלה: ${cloudResult.error ?? 'לא נמצא מידע בענן'}`);
              }
            } catch {
              // Bootstrap cloud pull failed — continue with local data
            }
          }
          removeCloudBootstrapParamsFromUrl();
        } else if (!urlToken && hasCloudSyncToken(localData.settings)) {
          // ── Auto-sync: pull from cloud on every startup, throttled to 3 minutes ──
          // Using localStorage (not sessionStorage) so the throttle persists across
          // page reloads, but a fresh pull still happens after 3 minutes of inactivity.
          const LAST_PULL_KEY = 'mc-last-cloud-pull';
          const PULL_THROTTLE_MS = 3 * 60 * 1000; // 3 minutes
          const lastPull = Number(localStorage.getItem(LAST_PULL_KEY) || '0');
          const shouldPull = Date.now() - lastPull > PULL_THROTTLE_MS;

          if (shouldPull) {
            localStorage.setItem(LAST_PULL_KEY, String(Date.now()));
            try {
              const cloudResult = await pullCloudSyncPayload(localData.settings);
              if (cloudResult.ok && cloudResult.payload && cloudResult.payload.settings) {
                const mergedAuto = mergeCloudWithLocalTokens(cloudResult.payload, localData.settings);
                await importDailyStatePayload(mergedAuto);
                // After cloud pull, roll over stale today-tasks immediately
                await rolloverStaleTodayTasks();
                localData = await getAllLocalData();
                setCloudSyncStatus(`סונכרן מהענן: ${cloudResult.counts?.tasks ?? localData.tasks.length} משימות`);
              }
            } catch {
              // Silent — don't block app load if cloud is unreachable
            }
          }
        }

        if (!cancelled) {
          setData(localData);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unknown IndexedDB error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-pull when app returns to foreground (handles phone tab-switch)
  useEffect(() => {
    let lastPulledAt = 0;
    const THROTTLE_MS = 3 * 60 * 1000; // 3 minutes minimum between pulls

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastPulledAt < THROTTLE_MS) return;
      lastPulledAt = now;
      void pullCloudDataToLocal();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pullCloudDataToLocal]);

  const saveSettings = useCallback(
    async (patch: SettingsPatch) => {
      try {
        setIsSaving(true);
        await updateAppSettings(patch);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown settings save error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );

  const createTask = useCallback(
    async (input: CreateTaskInput) => {
      try {
        setIsSaving(true);
        await createTaskWithSubtasks(input);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown task create error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );

  const changeSubtaskStatus = useCallback(
    async (subtaskId: string, status: Subtask['status']) => {
      try {
        setIsSaving(true);
        await updateSubtaskStatus(subtaskId, status);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown subtask status update error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );



  const updateExistingSubtaskText = useCallback(
    async (subtaskId: string, patch: { title?: string; notes?: string }) => {
      try {
        setIsSaving(true);
        await updateSubtaskText(subtaskId, patch);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown subtask text update error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );

  const addSubtaskToExistingTask = useCallback(
    async (input: AddSubtaskInput) => {
      try {
        setIsSaving(true);
        await addSubtaskToTask(input);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown subtask create error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );

  const updateExistingTaskText = useCallback(
    async (taskId: string, patch: { title?: string; whyNow?: string; notes?: string }) => {
      try {
        setIsSaving(true);
        await updateTaskText(taskId, patch);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown task text update error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );


  const updateExistingTaskDetails = useCallback(
    async (taskId: string, patch: { projectId?: string; domainId?: string; priority?: Task['priority']; effort?: Task['effort']; tags?: string[] }) => {
      try {
        setIsSaving(true);
        await updateTaskDetails(taskId, patch);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown task details update error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );

  const completeExistingTask = useCallback(
    async (taskId: string) => {
      try {
        setIsSaving(true);
        const timestamp = nowISO();
        await db.tasks.update(taskId, { completedAt: timestamp, updatedAt: timestamp });
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown task complete error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );

  const changeTaskDate = useCallback(
    async (task: Task, targetDate: string) => {
      try {
        setIsSaving(true);
        await moveTaskToDate(task, targetDate);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown task date update error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );

  const moveTaskTomorrow = useCallback(
    async (task: Task) => {
      try {
        setIsSaving(true);
        await moveTaskToTomorrow(task);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown move to tomorrow error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );

  const cancelExistingTask = useCallback(
    async (taskId: string) => {
      try {
        setIsSaving(true);
        await cancelTask(taskId);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown task cancel error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );


  const reorderTaskFocus = useCallback(
    async (taskId: string, action: FocusOrderAction) => {
      try {
        setIsSaving(true);
        await reorderTodayTaskFocus(taskId, action, getTodayISO());
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown focus order update error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );

  const addReminder = useCallback(
    async (input: CreateReminderInput) => {
      try {
        setIsSaving(true);
        await createReminder(input);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown reminder create error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );

  const markReminderAsSent = useCallback(
    async (reminderId: string) => {
      try {
        await markReminderSent(reminderId);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown reminder sent update error');
      }
    },
    [reloadDataAndPushCloud],
  );

  const snoozeExistingReminder = useCallback(
    async (reminderId: string, snoozeMinutes: number) => {
      try {
        await snoozeReminder(reminderId, snoozeMinutes);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown reminder snooze error');
      }
    },
    [reloadDataAndPushCloud],
  );

  const dismissReminder = useCallback(
    async (reminderId: string) => {
      try {
        await cancelReminder(reminderId);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown reminder dismiss error');
      }
    },
    [reloadDataAndPushCloud],
  );

  const addHabit = useCallback(
    async (input: CreateHabitInput) => {
      try {
        setIsSaving(true);
        await createHabit(input);
        await reloadData();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown habit create error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadData],
  );

  const editHabit = useCallback(
    async (habitId: string, patch: Parameters<typeof updateHabit>[1]) => {
      try {
        setIsSaving(true);
        await updateHabit(habitId, patch);
        await reloadData();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown habit update error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadData],
  );

  const removeHabit = useCallback(
    async (habitId: string) => {
      try {
        setIsSaving(true);
        await deleteHabit(habitId);
        await reloadData();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown habit delete error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadData],
  );

  const changeHabitOrder = useCallback(
    async (orderedIds: string[]) => {
      try {
        await reorderHabits(orderedIds);
        await reloadData();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown habit reorder error');
      }
    },
    [reloadData],
  );

  const nudgeHabitCount = useCallback(
    async (habitId: string, date: string, delta: number) => {
      try {
        await incrementHabitCount(habitId, date, delta);
        await reloadData();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown habit count update error');
      }
    },
    [reloadData],
  );

  const clearAllTasks = useCallback(async () => {
    try {
      setIsSaving(true);
      await softDeleteAllTasks();
      await reloadDataAndPushCloud();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'שגיאה במחיקת משימות');
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, [reloadDataAndPushCloud]);

  const addRecurringToToday = useCallback(
    async (definitionId: string) => {
      try {
        setIsSaving(true);
        await addRecurringDefinitionToToday(definitionId);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown recurring add error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );



  const saveDailyPlan = useCallback(
    async (input: { date: string; taskIds: string[]; blocks: DailyPlanBlock[]; focusNote?: string }) => {
      try {
        setIsSaving(true);
        const timestamp = nowISO();
        const existing = await db.dailyPlans.where('date').equals(input.date).first();
        const plan: DailyPlan = {
          id: existing?.id ?? createId('daily-plan'),
          date: input.date,
          focusNote: input.focusNote,
          plannedTaskIds: input.taskIds.map((taskId, index) => ({ taskId, order: index + 1 })),
          blocks: input.blocks,
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
        };
        await db.dailyPlans.put(plan);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown daily plan save error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );

  const importReportTasks = useCallback(
    async (drafts: DailyReportImportTaskDraft[]) => {
      try {
        setIsSaving(true);
        await importDailyReportTasks(drafts);
        await reloadDataAndPushCloud();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown daily report import error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );



  const deleteLastImport = useCallback(
    async () => {
      try {
        setIsSaving(true);
        const result = await deleteLastDailyReportImport();
        await reloadDataAndPushCloud();
        return result;
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown delete import error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );

  const importDailyState = useCallback(
    async (payload: unknown) => {
      try {
        setIsSaving(true);
        const result = await importDailyStatePayload(payload as Parameters<typeof importDailyStatePayload>[0]);
        // After import, roll over any stale "today" tasks (handles import of yesterday's JSON)
        await rolloverStaleTodayTasks();
        await reloadDataAndPushCloud();
        return result;
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unknown daily state import error');
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [reloadDataAndPushCloud],
  );

  const todayISO = getTodayISO();

  const computed = useMemo(() => {
    const todayTasks = getTodayTasks(data.tasks, todayISO);
    const inProgressTasks = getInProgressTasks(data.tasks, data.subtasks);
    const quickWinTasks = getQuickWinTasks(data.tasks).filter(
      (task) => getTaskProgress(task, data.subtasks).status !== 'done',
    );
    const backlogTasks = data.tasks.filter((task) => task.bucket === 'backlog');
    const doneTasks = data.tasks.filter((task) => getTaskProgress(task, data.subtasks).status === 'done');

    return {
      todayISO,
      todayTasks,
      inProgressTasks,
      quickWinTasks,
      backlogTasks,
      doneTasks,
      progress: {
        totalTasks: data.tasks.length,
        todayCount: todayTasks.length,
        inProgressCount: inProgressTasks.length,
        backlogCount: backlogTasks.length,
        doneCount: doneTasks.length,
        recurringCount: data.recurringDefinitions.length,
      },
    };
  }, [data, todayISO]);

  return {
    ...data,
    ...computed,
    isLoading,
    isSaving,
    error,
    cloudSyncStatus,
    reloadData,
    pushLocalDataToCloud,
    pullCloudDataToLocal,
    saveSettings,
    createTask,
    changeSubtaskStatus,
    updateExistingSubtaskText,
    addSubtaskToExistingTask,
    updateExistingTaskText,
    updateExistingTaskDetails,
    completeExistingTask,
    changeTaskDate,
    moveTaskTomorrow,
    cancelExistingTask,
    reorderTaskFocus,
    addReminder,
    markReminderAsSent,
    snoozeExistingReminder,
    dismissReminder,
    addRecurringToToday,
    importReportTasks,
    deleteLastImport,
    importDailyState,
    saveDailyPlan,
    addHabit,
    editHabit,
    removeHabit,
    changeHabitOrder,
    nudgeHabitCount,
    clearAllTasks,
  };
}
