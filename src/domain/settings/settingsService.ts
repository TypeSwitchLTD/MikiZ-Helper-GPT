import { db } from '../../db/db';
import { nowISO } from '../../utils/dates';
import { createDefaultSettings } from './defaultSettings';
import type { AppSettings } from './settingsTypes';
import { createLogEvent } from '../logs/logService';

export type SettingsPatch = Partial<Omit<AppSettings, 'id' | 'createdAt' | 'updatedAt'>>;

export async function updateAppSettings(patch: SettingsPatch): Promise<AppSettings> {
  const existing = (await db.settings.get('default')) ?? createDefaultSettings();
  const updated: AppSettings = {
    ...existing,
    ...patch,
    workday: patch.workday ?? existing.workday,
    location: patch.location ?? existing.location,
    scheduling: patch.scheduling ?? existing.scheduling,
    backup: patch.backup ?? existing.backup,
    morningBriefing: patch.morningBriefing ?? existing.morningBriefing ?? createDefaultSettings().morningBriefing,
    voice: patch.voice ?? existing.voice ?? createDefaultSettings().voice,
    socialConnections: patch.socialConnections ?? existing.socialConnections ?? createDefaultSettings().socialConnections,
    projects: patch.projects ?? existing.projects,
    domains: patch.domains ?? existing.domains,
    id: 'default',
    createdAt: existing.createdAt,
    updatedAt: nowISO(),
  };

  await db.transaction('rw', db.settings, db.logs, async () => {
    await db.settings.put(updated);
    await createLogEvent({
      type: 'settings_updated',
      entityType: 'settings',
      entityId: 'default',
      message: 'Settings updated',
    });
  });

  return updated;
}
