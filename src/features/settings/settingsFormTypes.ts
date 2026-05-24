import type { AppSettings } from '../../domain/settings/settingsTypes';

export interface SettingsFormState {
  workdayStartTime: string;
  workdayEndTime: string;
  primaryRestEnabled: boolean;
  primaryRestLabel: string;
  primaryRestStartTime: string;
  primaryRestEndTime: string;
  secondaryRestEnabled: boolean;
  secondaryRestLabel: string;
  secondaryRestStartTime: string;
  secondaryRestEndTime: string;
  locationLabel: string;
  city: string;
  country: string;
  timezone: string;
  warnOnRestWindowConflict: boolean;
  autoAddRecurringToToday: boolean;
  autoBackupEnabled: boolean;
  backupIntervalMinutes: number;
  fileBackupEnabled: boolean;
  pinEnabled: boolean;
  authPinCode: string;
  passkeyCredentialId: string | null;
  voiceNarratorGender: 'male' | 'female';
  morningNickname: string;
  morningMotivationLine: string;
  morningClosingLine: string;
  morningStyle: 'calm' | 'push' | 'funny' | 'business' | 'big_brother';
  morningIncludeExerciseReminder: boolean;
  morningExerciseLine: string;
  morningIncludeGreeting: boolean;
  morningIncludeSummary: boolean;
  morningIncludeDate: boolean;
  morningIncludeWeather: boolean;
  morningIncludeMotivation: boolean;
  morningIncludeReminders: boolean;
  morningIncludeTopTasks: boolean;
  morningIncludeLeads: boolean;
  morningIncludeClosing: boolean;
  morningSectionOrder: string[];
  morningAlarmTime: string;
  morningRingtoneUrl: string;
  morningAndroidPublishEndpoint: string;
  morningAndroidPublishToken: string;
  voiceEngine: 'browser' | 'elevenlabs';
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsModelId: string;
  elevenLabsOutputFormat: string;
  elevenLabsProxyUrl: string;
  elevenLabsStability: number;
  elevenLabsSimilarityBoost: number;
  elevenLabsStyle: number;
  elevenLabsUseSpeakerBoost: boolean;
  speechRate: number;
  linkedinEnabled: boolean;
  linkedinProfileUrl: string;
  linkedinAccessTokenPlaceholder: string;
  instagramEnabled: boolean;
  instagramUsername: string;
  instagramAccessTokenPlaceholder: string;
  instantlyApiKey: string;
  metaAppId: string;
  taskGroupOrder: string[];
}

export type UpdateFieldFn = <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) => void;

export type { AppSettings };

export interface LeadTableSettingsRow {
  id: string;
  project: 'TypeSwitch' | 'TimerAligner B2B';
  label: string;
  table: string;
  dateColumn: string;
}
