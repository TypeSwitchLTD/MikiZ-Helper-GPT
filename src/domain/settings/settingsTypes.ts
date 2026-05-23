export interface Project {
  id: string;
  name: string;
  colorLabel?: string;
  isActive: boolean;
}

export interface Domain {
  id: string;
  name: string;
  isActive: boolean;
}

export interface RestWindow {
  enabled: boolean;
  label: string;
  startTime: string;
  endTime: string;
}

export interface SocialConnectionSettings {
  linkedin: {
    enabled: boolean;
    profileUrl?: string;
    accessTokenPlaceholder?: string;
    lastCheckedAt?: string | null;
  };
  instagram: {
    enabled: boolean;
    username?: string;
    accessTokenPlaceholder?: string;
    lastCheckedAt?: string | null;
  };
}

export interface InstantlySettings {
  apiKey?: string;
}

export interface MetaSettings {
  appId?: string;
  accessToken?: string;
  instagramUserId?: string;
  facebookPageId?: string;
  connectedAt?: string | null;
  tokenExpiresAt?: string | null;
}

export type ColorThemeId = 'slate-sky' | 'indigo-clean' | 'deep-warm';

export interface AppSettings {
  id: 'default';
  colorTheme?: ColorThemeId;
  pinEnabled: boolean;
  pinHash?: string | null;
  pinUpdatedAt?: string | null;
  workday: {
    startTime: string;
    endTime: string;
    primaryRestWindow: RestWindow;
    secondaryRestWindow?: RestWindow | null;
  };
  location: {
    label?: string;
    city?: string;
    country?: string;
    timezone?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  scheduling: {
    warnOnRestWindowConflict: boolean;
    autoAddRecurringToToday: boolean;
  };
  backup: {
    autoBackupEnabled: boolean;
    backupIntervalMinutes: number;
    lastBackupAt?: string | null;
    lastSnapshotAt?: string | null;
    fileBackupEnabled: boolean;
  };
  morningBriefing: {
    nickname: string;
    motivationLine: string;
    closingLine: string;
    style: 'calm' | 'push' | 'funny' | 'business' | 'big_brother';
    includeExerciseReminder: boolean;
    exerciseLine: string;
    includeGreeting?: boolean;
    includeSummary?: boolean;
    includeDate?: boolean;
    includeWeather?: boolean;
    includeMotivation?: boolean;
    includeReminders?: boolean;
    includeTopTasks?: boolean;
    includeLeads?: boolean;
    includeClosing?: boolean;
    sectionOrder?: string[];
    alarmTime?: string;
    ringtoneUrl?: string;
    androidPublishEndpoint?: string;
    androidPublishToken?: string;
    lastPublishedAt?: string | null;
  };
  voice: {
    engine: 'browser' | 'elevenlabs';
    elevenLabsApiKey?: string;
    elevenLabsVoiceId?: string;
    elevenLabsModelId?: string;
    elevenLabsOutputFormat?: string;
    elevenLabsProxyUrl?: string;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
    speechRate?: number;
    narratorGender?: 'male' | 'female';
  };
  socialConnections?: SocialConnectionSettings;
  instantly?: InstantlySettings;
  meta?: MetaSettings;
  taskGroupOrder?: string[];
  projects: Project[];
  domains: Domain[];
  createdAt: string;
  updatedAt: string;
}
