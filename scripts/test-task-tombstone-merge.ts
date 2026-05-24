import assert from 'node:assert/strict';
import { prepareSubtaskForImport, prepareTaskForImport } from '../src/db/importMerge.ts';
import { mergeImportedSettingsPreservingLocalSecrets } from '../src/db/settingsMerge.ts';
import { normalizeSpeechRate } from '../src/domain/voice/speechRate.ts';
import type { AppSettings } from '../src/domain/settings/settingsTypes.ts';
import type { Subtask, Task } from '../src/domain/tasks/taskTypes.ts';

const baseTask: Task = {
  id: 'task-a',
  title: 'Task A',
  projectId: 'personal',
  domainId: 'operations',
  bucket: 'today',
  date: '2026-05-24',
  originalDate: '2026-05-24',
  priority: 'medium',
  effort: 'medium',
  isQuickWin: false,
  isRecurring: false,
  backlogGroup: null,
  tags: [],
  statusOverride: null,
  movedCount: 0,
  movedToDate: null,
  source: 'manual',
  createdAt: '2026-05-24T08:00:00.000Z',
  updatedAt: '2026-05-24T08:00:00.000Z',
  completedAt: null,
  cancelledAt: null,
  deletedAt: null,
};

const baseSubtask: Subtask = {
  id: 'subtask-a',
  taskId: 'task-a',
  title: 'Subtask A',
  status: 'not_started',
  sortOrder: 0,
  createdAt: '2026-05-24T08:00:00.000Z',
  updatedAt: '2026-05-24T08:00:00.000Z',
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  deletedAt: null,
};

function task(patch: Partial<Task>): Task {
  return { ...baseTask, ...patch };
}

function subtask(patch: Partial<Subtask>): Subtask {
  return { ...baseSubtask, ...patch };
}

function settings(patch: Partial<AppSettings> = {}): AppSettings {
  const base: AppSettings = {
    id: 'default',
    colorTheme: 'slate-sky',
    pinEnabled: false,
    pinHash: null,
    pinUpdatedAt: null,
    passkeyCredentialId: null,
    workday: {
      startTime: '09:00',
      endTime: '18:00',
      primaryRestWindow: { enabled: true, label: 'Break', startTime: '14:00', endTime: '15:00' },
      secondaryRestWindow: null,
    },
    location: { label: 'Tel Aviv', city: 'Tel Aviv', country: 'Israel', timezone: 'Asia/Jerusalem' },
    scheduling: { warnOnRestWindowConflict: true, autoAddRecurringToToday: false },
    backup: { autoBackupEnabled: true, backupIntervalMinutes: 30, lastBackupAt: null, lastSnapshotAt: null, fileBackupEnabled: false },
    morningBriefing: {
      nickname: 'Miki',
      motivationLine: '',
      closingLine: '',
      style: 'big_brother',
      includeExerciseReminder: true,
      exerciseLine: '',
      androidPublishEndpoint: '/api/morning-briefing',
      androidPublishToken: '',
      lastPublishedAt: null,
    },
    voice: {
      engine: 'browser',
      elevenLabsApiKey: '',
      elevenLabsVoiceId: '',
      elevenLabsProxyUrl: '',
    },
    socialConnections: {
      linkedin: { enabled: false, profileUrl: '', accessTokenPlaceholder: '', lastCheckedAt: null },
      instagram: { enabled: false, username: '', accessTokenPlaceholder: '', lastCheckedAt: null },
    },
    instantly: { apiKey: '' },
    projects: [{ id: 'personal', name: 'Personal', isActive: true }],
    domains: [{ id: 'operations', name: 'Operations', isActive: true }],
    createdAt: '2026-05-24T08:00:00.000Z',
    updatedAt: '2026-05-24T08:00:00.000Z',
  };
  return { ...base, ...patch };
}

{
  const decision = prepareTaskForImport(
    task({ updatedAt: '2026-05-24T08:00:00.000Z' }),
    task({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
  );
  assert.equal(decision.shouldUpsert, false, 'cloud pull must not resurrect a locally deleted task');
}

{
  const decision = prepareTaskForImport(
    task({ updatedAt: '2026-05-24T08:00:00.000Z' }),
    task({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
    { allowDeletedRestore: true },
  );
  assert.equal(decision.shouldUpsert, true, 'manual Daily State import must restore a deleted task');
  assert.equal(decision.item.deletedAt, null, 'manual restore clears the task tombstone');
}

{
  const decision = prepareTaskForImport(
    task({ updatedAt: '2026-05-24T08:00:00.000Z' }),
    task({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
    { allowDeletedRestore: true, restoreTimestamp: '2026-05-24T12:00:00.000Z' },
  );
  assert.equal(decision.shouldUpsert, true, 'manual restore must upsert deleted task');
  assert.equal(decision.item.updatedAt, '2026-05-24T12:00:00.000Z', 'manual restore must make task newer for other devices');
}

{
  const decision = prepareTaskForImport(
    task({ updatedAt: '2026-05-24T12:00:00.000Z' }),
    task({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
  );
  assert.equal(decision.shouldUpsert, true, 'cloud pull must accept a newer resurrected task from another device');
  assert.equal(decision.item.deletedAt, null, 'newer cloud task clears the local task tombstone');
}

{
  const decision = prepareTaskForImport(
    task({ deletedAt: '2026-05-24T11:00:00.000Z', updatedAt: '2026-05-24T11:00:00.000Z' }),
    task({ updatedAt: '2026-05-24T09:00:00.000Z' }),
  );
  assert.equal(decision.shouldUpsert, true, 'incoming task tombstone must be accepted when newer');
}

{
  const decision = prepareTaskForImport(
    task({ completedAt: null, updatedAt: '2026-05-24T09:00:00.000Z' }),
    task({ completedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
  );
  assert.equal(decision.shouldUpsert, false, 'cloud pull must not undo a locally completed task');
}

{
  const decision = prepareSubtaskForImport(
    subtask({ updatedAt: '2026-05-24T08:00:00.000Z' }),
    subtask({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
    task({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
  );
  assert.equal(decision.shouldUpsert, false, 'cloud pull must not resurrect subtasks under a deleted task');
}

{
  const decision = prepareSubtaskForImport(
    subtask({ updatedAt: '2026-05-24T08:00:00.000Z' }),
    subtask({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
    task({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
    { allowDeletedRestore: true },
  );
  assert.equal(decision.shouldUpsert, true, 'manual Daily State import must restore deleted subtasks');
  assert.equal(decision.item.deletedAt, null, 'manual restore clears the subtask tombstone');
}

{
  const decision = prepareSubtaskForImport(
    subtask({ updatedAt: '2026-05-24T12:00:00.000Z' }),
    subtask({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
    task({ deletedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
  );
  assert.equal(decision.shouldUpsert, true, 'cloud pull must accept a newer resurrected subtask from another device');
  assert.equal(decision.item.deletedAt, null, 'newer cloud subtask clears the local subtask tombstone');
}

{
  const decision = prepareSubtaskForImport(
    subtask({ status: 'started', updatedAt: '2026-05-24T09:00:00.000Z' }),
    subtask({ status: 'done', completedAt: '2026-05-24T10:00:00.000Z', updatedAt: '2026-05-24T10:00:00.000Z' }),
    task({}),
  );
  assert.equal(decision.shouldUpsert, false, 'cloud pull must not undo a locally completed subtask');
}

{
  const localSettings = settings();
  localSettings.pinEnabled = true;
  localSettings.pinHash = 'local-pin-hash';
  localSettings.passkeyCredentialId = 'local-passkey';
  localSettings.morningBriefing.androidPublishToken = 'local-cloud-token';
  localSettings.morningBriefing.androidPublishEndpoint = 'https://example.com/api/morning-briefing';
  localSettings.voice.elevenLabsApiKey = 'local-eleven-key';
  localSettings.instantly = { apiKey: 'local-instantly-key' };

  const importedSettings = settings();
  importedSettings.pinEnabled = false;
  importedSettings.pinHash = null;
  importedSettings.passkeyCredentialId = null;
  importedSettings.morningBriefing.androidPublishToken = '';
  importedSettings.morningBriefing.androidPublishEndpoint = '/api/morning-briefing';
  importedSettings.voice.elevenLabsApiKey = '';
  importedSettings.instantly = { apiKey: '' };
  importedSettings.projects = [{ id: 'new-project', name: 'New Project', isActive: true }];

  const mergedSettings = mergeImportedSettingsPreservingLocalSecrets(importedSettings, localSettings);
  assert.equal(mergedSettings.pinEnabled, true, 'manual import must preserve local PIN enabled state');
  assert.equal(mergedSettings.pinHash, 'local-pin-hash', 'manual import must preserve local PIN hash');
  assert.equal(mergedSettings.passkeyCredentialId, 'local-passkey', 'manual import must preserve local passkey');
  assert.equal(mergedSettings.morningBriefing.androidPublishToken, 'local-cloud-token', 'manual import must preserve cloud token');
  assert.equal(
    mergedSettings.morningBriefing.androidPublishEndpoint,
    'https://example.com/api/morning-briefing',
    'manual import must preserve cloud endpoint',
  );
  assert.equal(mergedSettings.voice.elevenLabsApiKey, 'local-eleven-key', 'manual import must preserve ElevenLabs key');
  assert.equal(mergedSettings.instantly?.apiKey, 'local-instantly-key', 'manual import must preserve Instantly key');
  assert.equal(mergedSettings.projects[0]?.id, 'new-project', 'manual import can still refresh imported projects');
}

{
  assert.equal(normalizeSpeechRate(0.2), 0.65, 'speech rate is clamped to the minimum');
  assert.equal(normalizeSpeechRate(3), 2, 'speech rate is clamped to the maximum');
  assert.equal(normalizeSpeechRate(1.35), 1.35, 'speech rate preserves valid values');
  assert.equal(normalizeSpeechRate(undefined), 0.86, 'speech rate falls back to the default');
}

console.log('task tombstone and settings merge regression tests passed');
