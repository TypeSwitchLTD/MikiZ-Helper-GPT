import { useEffect, useMemo, useRef, useState } from 'react';
import { useDragSort } from '../../hooks/useDragSort';
import { SectionCard } from '../../components/layout/SectionCard';
import { ReportTab } from '../reports/ReportTab';
import type { AppSettings, ColorThemeId, Domain, Project } from '../../domain/settings/settingsTypes';
import type { Task } from '../../domain/tasks/taskTypes';
import type { DailyReport } from '../../domain/reports/reportTypes';
import type { DailyReportImportTaskDraft } from '../../domain/import/dailyReportImport';
import type { SettingsPatch } from '../../domain/settings/settingsService';
import { isFileSystemAccessAvailable, isIndexedDBAvailable } from '../../utils/storageGuards';
import { createElevenLabsAudioUrl, getElevenLabsConfigStatus } from '../../domain/voice/elevenLabsTts';
import { normalizeSpeechRate } from '../../domain/voice/speechRate';
import type { SettingsFormState, LeadTableSettingsRow } from './settingsFormTypes';
import { MorningSection } from './sections/MorningSection';
import { ApiSection } from './sections/ApiSection';
import { AuthSection } from './sections/AuthSection';
import { WorkdaySection } from './sections/WorkdaySection';
import { AutomationSection } from './sections/AutomationSection';
import { ProjectsSection } from './sections/ProjectsSection';
import { ConnectDeviceSection } from './ConnectDeviceSection';
import { PushNotificationsSection } from './PushNotificationsSection';

// ─── Lead table config ────────────────────────────────────────────────────────

const LEADS_TABLE_CONFIG_KEY = 'mission-control.supabase-leads.table-config.v1';

const defaultLeadTableSettings: LeadTableSettingsRow[] = [
  { id: 'typeswitch-primary', project: 'TypeSwitch', label: 'TypeSwitch — טבלה 1', table: '', dateColumn: 'created_at' },
  { id: 'typeswitch-secondary', project: 'TypeSwitch', label: 'TypeSwitch — טבלה 2', table: '', dateColumn: 'created_at' },
  { id: 'timeraligner-b2b', project: 'TimerAligner B2B', label: 'B2B TimerAligner', table: '', dateColumn: 'created_at' },
];

function loadLeadTableSettings(): LeadTableSettingsRow[] {
  if (typeof window === 'undefined') return defaultLeadTableSettings;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEADS_TABLE_CONFIG_KEY) || 'null');
    if (!Array.isArray(parsed)) return defaultLeadTableSettings;
    return defaultLeadTableSettings.map((fallback, index) => ({
      ...fallback,
      ...(parsed[index] || {}),
      id: fallback.id,
      project: fallback.project,
    }));
  } catch {
    return defaultLeadTableSettings;
  }
}

// ─── City / timezone hints ────────────────────────────────────────────────────

const cityTimezoneHints: Array<{ terms: string[]; timezone: string; country: string; label?: string }> = [
  { terms: ['תל אביב', 'tel aviv', 'tel-aviv', 'telaviv'], timezone: 'Asia/Jerusalem', country: 'ישראל', label: 'תל אביב' },
  { terms: ['ירושלים', 'jerusalem'], timezone: 'Asia/Jerusalem', country: 'ישראל', label: 'ירושלים' },
  { terms: ['חיפה', 'haifa'], timezone: 'Asia/Jerusalem', country: 'ישראל', label: 'חיפה' },
  { terms: ['רמת גן', 'ramat gan'], timezone: 'Asia/Jerusalem', country: 'ישראל', label: 'רמת גן' },
  { terms: ['גבעתיים', 'givatayim'], timezone: 'Asia/Jerusalem', country: 'ישראל', label: 'גבעתיים' },
  { terms: ['הרצליה', 'herzliya', 'herzeliya'], timezone: 'Asia/Jerusalem', country: 'ישראל', label: 'הרצליה' },
  { terms: ['לונדון', 'london'], timezone: 'Europe/London', country: 'United Kingdom', label: 'London' },
  { terms: ['ניו יורק', 'new york', 'nyc'], timezone: 'America/New_York', country: 'United States', label: 'New York' },
  { terms: ['ברלין', 'berlin'], timezone: 'Europe/Berlin', country: 'Germany', label: 'Berlin' },
  { terms: ['בנגקוק', 'bangkok', 'krung thep', 'תאילנד', 'thailand'], timezone: 'Asia/Bangkok', country: 'Thailand', label: 'Bangkok' },
];

function findCityTimezoneHint(city: string) {
  const normalized = city.trim().toLowerCase();
  if (!normalized) return undefined;
  return cityTimezoneHints.find((hint) =>
    hint.terms.some((term) => {
      const t = term.toLowerCase();
      return normalized === t || normalized.includes(t) || t.includes(normalized);
    }),
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

function applyLocationHint(form: SettingsFormState): SettingsFormState {
  const hint = findCityTimezoneHint(form.city) ?? findCityTimezoneHint(form.locationLabel);
  if (!hint) return form;
  return { ...form, city: hint.label || form.city || '', country: hint.country || form.country, timezone: hint.timezone, locationLabel: hint.label || form.locationLabel || form.city };
}

function toFormState(s: AppSettings): SettingsFormState {
  return {
    workdayStartTime: s.workday.startTime,
    workdayEndTime: s.workday.endTime,
    primaryRestEnabled: s.workday.primaryRestWindow.enabled,
    primaryRestLabel: s.workday.primaryRestWindow.label,
    primaryRestStartTime: s.workday.primaryRestWindow.startTime,
    primaryRestEndTime: s.workday.primaryRestWindow.endTime,
    secondaryRestEnabled: s.workday.secondaryRestWindow?.enabled ?? false,
    secondaryRestLabel: s.workday.secondaryRestWindow?.label ?? 'הפסקה קצרה',
    secondaryRestStartTime: s.workday.secondaryRestWindow?.startTime ?? '17:00',
    secondaryRestEndTime: s.workday.secondaryRestWindow?.endTime ?? '17:20',
    locationLabel: s.location.label ?? '',
    city: s.location.city ?? '',
    country: s.location.country ?? '',
    timezone: s.location.timezone ?? 'Asia/Jerusalem',
    warnOnRestWindowConflict: s.scheduling.warnOnRestWindowConflict,
    autoAddRecurringToToday: s.scheduling.autoAddRecurringToToday,
    autoBackupEnabled: s.backup.autoBackupEnabled,
    backupIntervalMinutes: s.backup.backupIntervalMinutes,
    fileBackupEnabled: s.backup.fileBackupEnabled,
    pinEnabled: s.pinEnabled,
    authPinCode: '',
    passkeyCredentialId: s.passkeyCredentialId ?? null,
    voiceNarratorGender: s.voice?.narratorGender ?? 'female',
    morningNickname: s.morningBriefing?.nickname ?? 'מיקי',
    morningMotivationLine: s.morningBriefing?.motivationLine ?? 'לא צריך לנצח את כל היום בבת אחת, רק את הצעד הראשון.',
    morningClosingLine: s.morningBriefing?.closingLine ?? 'יום נקי, מיקי. מתחילים.',
    morningStyle: s.morningBriefing?.style ?? 'big_brother',
    morningIncludeExerciseReminder: s.morningBriefing?.includeExerciseReminder ?? true,
    morningExerciseLine: s.morningBriefing?.exerciseLine ?? 'קום, תעשה תרגיל בוקר קצר, ותכניס אנרגיה לגוף לפני המסך.',
    morningIncludeGreeting: s.morningBriefing?.includeGreeting ?? true,
    morningIncludeSummary: s.morningBriefing?.includeSummary ?? true,
    morningIncludeDate: s.morningBriefing?.includeDate ?? true,
    morningIncludeWeather: s.morningBriefing?.includeWeather ?? true,
    morningIncludeMotivation: s.morningBriefing?.includeMotivation ?? true,
    morningIncludeReminders: s.morningBriefing?.includeReminders ?? true,
    morningIncludeTopTasks: s.morningBriefing?.includeTopTasks ?? true,
    morningIncludeLeads: s.morningBriefing?.includeLeads ?? true,
    morningIncludeClosing: s.morningBriefing?.includeClosing ?? true,
    morningSectionOrder: s.morningBriefing?.sectionOrder ?? ['greeting', 'weather', 'topTasks', 'reminders', 'closing'],
    morningAlarmTime: s.morningBriefing?.alarmTime ?? '07:00',
    morningRingtoneUrl: s.morningBriefing?.ringtoneUrl ?? '',
    morningAndroidPublishEndpoint: s.morningBriefing?.androidPublishEndpoint ?? '/api/morning-briefing',
    morningAndroidPublishToken: s.morningBriefing?.androidPublishToken ?? '',
    voiceEngine: s.voice?.engine ?? 'browser',
    elevenLabsApiKey: s.voice?.elevenLabsApiKey ?? '',
    elevenLabsVoiceId: s.voice?.elevenLabsVoiceId ?? '',
    elevenLabsModelId: s.voice?.elevenLabsModelId ?? 'eleven_v3',
    elevenLabsOutputFormat: s.voice?.elevenLabsOutputFormat ?? 'mp3_44100_128',
    elevenLabsProxyUrl: s.voice?.elevenLabsProxyUrl ?? '',
    elevenLabsStability: s.voice?.stability ?? 0.45,
    elevenLabsSimilarityBoost: s.voice?.similarityBoost ?? 0.82,
    elevenLabsStyle: s.voice?.style ?? 0.2,
    elevenLabsUseSpeakerBoost: s.voice?.useSpeakerBoost ?? true,
    speechRate: s.voice?.speechRate ?? 0.86,
    linkedinEnabled: s.socialConnections?.linkedin?.enabled ?? false,
    linkedinProfileUrl: s.socialConnections?.linkedin?.profileUrl ?? '',
    linkedinAccessTokenPlaceholder: s.socialConnections?.linkedin?.accessTokenPlaceholder ?? '',
    instagramEnabled: s.socialConnections?.instagram?.enabled ?? false,
    instagramUsername: s.socialConnections?.instagram?.username ?? '',
    instagramAccessTokenPlaceholder: s.socialConnections?.instagram?.accessTokenPlaceholder ?? '',
    instantlyApiKey: s.instantly?.apiKey ?? '',
    metaAppId: s.meta?.appId ?? '',
    shopifyShopDomain: s.shopify?.shopDomain ?? '',
    shopifyAdminAccessToken: s.shopify?.adminAccessToken ?? '',
    googleAnalyticsPropertyId: s.googleAnalytics?.propertyId ?? '',
    taskGroupOrder: s.taskGroupOrder ?? ['today', 'in_progress', 'quick', 'backlog'],
  };
}

function toProjectsTextarea(projects: Project[]): string {
  return projects.map((p) => `${p.id}|${p.name}|${p.isActive ? 'active' : 'inactive'}`).join('\n');
}

function toDomainsTextarea(domains: Domain[]): string {
  return domains.map((d) => `${d.id}|${d.name}|${d.isActive ? 'active' : 'inactive'}`).join('\n');
}

function parseProjects(value: string): Project[] {
  return value.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [id, name, status] = line.split('|').map((p) => p.trim());
    return { id, name: name || id, isActive: status !== 'inactive' };
  }).filter((p) => p.id.length > 0);
}

function parseDomains(value: string): Domain[] {
  return value.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const [id, name, status] = line.split('|').map((p) => p.trim());
    return { id, name: name || id, isActive: status !== 'inactive' };
  }).filter((d) => d.id.length > 0);
}

async function hashPin(pin: string): Promise<string> {
  const payload = new TextEncoder().encode(`mission-control-pin:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Color theme palette config ───────────────────────────────────────────────

const COLOR_THEMES: Array<{
  id: ColorThemeId;
  label: string;
  tagline: string;
  swatchFrom: string;
  swatchTo: string;
  accentDot: string;
}> = [
  {
    id: 'slate-sky',
    label: 'Slate + Sky',
    tagline: 'המראה הנוכחי — כחול נקי',
    swatchFrom: '#e0f2fe',
    swatchTo: '#f8fbff',
    accentDot: '#0f172a',
  },
  {
    id: 'indigo-clean',
    label: 'Indigo Clean',
    tagline: 'מינימל — אינדיגו ווייולט',
    swatchFrom: '#EDE9FE',
    swatchTo: '#F0EEFF',
    accentDot: '#4f46e5',
  },
  {
    id: 'deep-warm',
    label: 'Deep + Warm',
    tagline: 'חם ועמוק — ויולט על קרם',
    swatchFrom: '#FFF5E6',
    swatchTo: '#FDF9F3',
    accentDot: '#7c3aed',
  },
];

// ─── Section metadata ─────────────────────────────────────────────────────────

const SETTINGS_SECTIONS = [
  { id: 'visual',       title: 'ויז׳ואל ותצוגה',      description: 'ערכת צבעים + סדר קבוצות משימות.',                    icon: '◑'  },
  { id: 'morning',      title: 'בוקר, קול והקראה',     description: 'נאום, קול, מהירות, ElevenLabs, שעון בוקר ואנדרואיד.', icon: '☀' },
  { id: 'connectivity', title: 'חיבור, ענן ואבטחה',    description: 'QR סנכרון מכשיר, Cloud tokens, PIN כניסה.',          icon: '🔐' },
  { id: 'workday',      title: 'יום עבודה ואוטומציה',  description: 'שעות, עיר, אזור זמן, גיבוי ותזמון אוטומטי.',        icon: '📍' },
  { id: 'projects',     title: 'פרויקטים ודומיינים',   description: 'עריכה זהירה של רשימות הבסיס.',                        icon: '☰'  },
  { id: 'import',       title: 'דוח / ייבוא',           description: 'ייבוא דוחות ומשימות ותיקון ייבוא שגוי.',             icon: '📥' },
  { id: 'advanced',     title: 'מתקדם',                 description: 'אחסון, Supabase ויכולות דפדפן.',                     icon: '⚙'  },
] as const;

const MORNING_SECTIONS = [
  { id: 'greeting', label: 'בוקר טוב + תאריך', field: 'morningIncludeGreeting' as const },
  { id: 'weather', label: 'מזג אוויר + שקיעה / שבת', field: 'morningIncludeWeather' as const },
  { id: 'topTasks', label: 'משימות להיום', field: 'morningIncludeTopTasks' as const },
  { id: 'reminders', label: 'תזכורות + חגים', field: 'morningIncludeReminders' as const },
  { id: 'closing', label: 'משפט סיום', field: 'morningIncludeClosing' as const },
];

const TASK_GROUPS = [
  { id: 'today',       label: 'היום',     color: 'bg-sky-400',     textColor: 'text-sky-700',     ringColor: 'ring-sky-300' },
  { id: 'in_progress', label: 'בתהליך',   color: 'bg-violet-400',  textColor: 'text-violet-700',  ringColor: 'ring-violet-300' },
  { id: 'quick',       label: 'קלילים',   color: 'bg-emerald-400', textColor: 'text-emerald-700', ringColor: 'ring-emerald-300' },
  { id: 'backlog',     label: 'בקלוג',    color: 'bg-slate-400',   textColor: 'text-slate-600',   ringColor: 'ring-slate-300' },
] as const;

export type TaskGroupId = typeof TASK_GROUPS[number]['id'];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MorningPreviewProps {
  text: string;
  isSpeaking: boolean;
  isGeneratingVoice: boolean;
  isMorningLoading: boolean;
  playText: (text: string) => Promise<void>;
  stop: () => void;
}

interface SettingsTabProps {
  settings: AppSettings | null;
  isSaving: boolean;
  onSaveSettings: (patch: SettingsPatch) => Promise<void>;
  onPushCloud?: () => Promise<unknown>;
  onPullCloud?: () => Promise<unknown>;
  cloudSyncStatus?: string;
  reports: DailyReport[];
  tasks: Task[];
  todayISO: string;
  onImportReportTasks: (drafts: DailyReportImportTaskDraft[]) => Promise<void>;
  onDeleteLastImport?: () => Promise<{ deletedTasks: number; deletedSubtasks: number }>;
  onClearAllTasks?: () => Promise<void>;
  morningPreview?: MorningPreviewProps;
}

// ─── Task Group Order Section ─────────────────────────────────────────────────

function TaskGroupOrderSection({
  orderedGroups,
  onReorder,
}: {
  orderedGroups: ReadonlyArray<typeof TASK_GROUPS[number]>;
  onReorder: (fromIdx: number, toIdx: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { dragIdx, dragOverIdx, startTouch, endTouch, startDrag, overDrag, leaveDrag, dropDrag, endDrag } =
    useDragSort(containerRef, onReorder);

  return (
    <SectionCard title="תצוגת משימות" description="גרור לשינוי סדר הקבוצות במסך המשימות. כל קבוצה מוצגת בצבע שלה.">
      <div className="grid gap-2" ref={containerRef}>
        {orderedGroups.map((group, index) => (
          <div
            key={group.id}
            data-drag-idx={index}
            draggable
            onDragStart={() => startDrag(index)}
            onDragOver={(e) => overDrag(e, index)}
            onDragLeave={leaveDrag}
            onDrop={() => dropDrag(index)}
            onDragEnd={endDrag}
            onTouchStart={() => startTouch(index)}
            onTouchEnd={endTouch}
            className={`flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 transition cursor-grab active:cursor-grabbing select-none ${dragOverIdx === index && dragIdx !== index ? 'ring-sky-400 bg-sky-50 scale-[1.01]' : 'ring-slate-200'} ${dragIdx === index ? 'opacity-50' : ''}`}
          >
            <span className={`h-3 w-3 shrink-0 rounded-full ${group.color}`} />
            <span className={`text-sm font-black ${group.textColor}`}>{group.label}</span>
            <span className="ml-auto text-slate-300 text-lg select-none">⠿</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-bold text-slate-400">הסדר נשמר בלחיצה על "שמור הגדרות" למטה.</p>
    </SectionCard>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsTab({ settings, isSaving, onSaveSettings, onPushCloud, onPullCloud, cloudSyncStatus, reports, tasks, todayISO, onImportReportTasks, onDeleteLastImport, onClearAllTasks, morningPreview }: SettingsTabProps) {
  const [form, setForm] = useState<SettingsFormState | null>(settings ? toFormState(settings) : null);
  const [projectsText, setProjectsText] = useState(settings ? toProjectsTextarea(settings.projects) : '');
  const [domainsText, setDomainsText] = useState(settings ? toDomainsTextarea(settings.domains) : '');
  const [saveStatus, setSaveStatus] = useState('');
  const [voiceTestStatus, setVoiceTestStatus] = useState('');
  const [apiTestStatus, setApiTestStatus] = useState('');
  const [leadTableSettings, setLeadTableSettings] = useState<LeadTableSettingsRow[]>(loadLeadTableSettings);
  const [leadTableSettingsStatus, setLeadTableSettingsStatus] = useState('');
  const VALID_SECTION_IDS = new Set(['visual', 'morning', 'connectivity', 'workday', 'projects', 'import', 'advanced']);
  const [openSection, setOpenSection] = useState<string>(() => {
    const saved = sessionStorage.getItem('mc-settings-section') ?? '';
    return VALID_SECTION_IDS.has(saved) ? saved : 'morning';
  });
  const openSectionAndPersist = (id: string) => {
    setOpenSection(id);
    sessionStorage.setItem('mc-settings-section', id);
  };

  useEffect(() => {
    if (!settings) return;
    setForm(toFormState(settings));
    setProjectsText(toProjectsTextarea(settings.projects));
    setDomainsText(toDomainsTextarea(settings.domains));
  }, [settings]);

  const parsedProjects = useMemo(() => parseProjects(projectsText), [projectsText]);
  const parsedDomains = useMemo(() => parseDomains(domainsText), [domainsText]);
  const cityHint = form ? (findCityTimezoneHint(form.city) ?? findCityTimezoneHint(form.locationLabel)) : undefined;

  if (!settings || !form) {
    return <SectionCard title="הגדרות" description="טוען הגדרות מקומיות...">טוען...</SectionCard>;
  }

  // ── Field update ──

  const updateField = <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) => {
    setForm((cur) => (cur ? { ...cur, [key]: value } : cur));
    setSaveStatus('');
  };

  const handleCityChange = (city: string) => {
    const hint = findCityTimezoneHint(city);
    setForm((cur) => cur ? { ...cur, city, timezone: hint?.timezone ?? cur.timezone, country: hint?.country ?? cur.country, locationLabel: hint?.label ?? cur.locationLabel } : cur);
    setSaveStatus('');
  };

  const handleLocationLabelChange = (locationLabel: string) => {
    const hint = findCityTimezoneHint(locationLabel);
    setForm((cur) => cur ? { ...cur, locationLabel, city: hint?.label ?? cur.city, timezone: hint?.timezone ?? cur.timezone, country: hint?.country ?? cur.country } : cur);
    setSaveStatus('');
  };

  // ── Morning section order ──

  const orderedMorningSections = form.morningSectionOrder
    .map((id) => MORNING_SECTIONS.find((s) => s.id === id))
    .filter((s): s is (typeof MORNING_SECTIONS)[number] => Boolean(s));

  const moveMorningSection = (sectionId: string, direction: -1 | 1) => {
    const order = [...form.morningSectionOrder];
    const index = order.indexOf(sectionId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    updateField('morningSectionOrder', order);
  };

  // ── Task group order ──

  const orderedTaskGroups = form.taskGroupOrder
    .map((id) => TASK_GROUPS.find((g) => g.id === id))
    .filter((g): g is (typeof TASK_GROUPS)[number] => Boolean(g));

  const reorderTaskGroups = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const order = [...form.taskGroupOrder];
    const [removed] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, removed);
    updateField('taskGroupOrder', order);
  };

  // ── Lead table ──

  const updateLeadTableSetting = (index: number, patch: Partial<LeadTableSettingsRow>) => {
    const next = leadTableSettings.map((row, i) => i === index ? { ...row, ...patch } : row);
    setLeadTableSettings(next);
    window.localStorage.setItem(LEADS_TABLE_CONFIG_KEY, JSON.stringify(next));
    setLeadTableSettingsStatus('נשמר מקומית. עבור ללידים וסושיאל ולחץ בדוק.');
  };

  // ── Save ──

  async function handleSave() {
    setSaveStatus('');
    if (!form || !settings) { setSaveStatus('ההגדרות עדיין נטענות. נסה שוב בעוד רגע.'); return; }

    const currentForm = applyLocationHint(form);
    const nextPinCode = currentForm.authPinCode.trim();

    if (currentForm.pinEnabled && !settings.pinHash && !/^\d{6}$/.test(nextPinCode)) {
      setSaveStatus('כדי להפעיל כניסה בסיסית צריך להגדיר קוד בן 6 ספרות.'); return;
    }
    if (nextPinCode && !/^\d{6}$/.test(nextPinCode)) {
      setSaveStatus('קוד הכניסה חייב להיות בדיוק 6 ספרות.'); return;
    }
    if (parsedProjects.length === 0 || parsedDomains.length === 0) {
      setSaveStatus('חובה להשאיר לפחות פרויקט אחד ודומיין אחד.'); return;
    }

    const nextPinHash = nextPinCode ? await hashPin(nextPinCode) : (settings.pinHash ?? null);

    await onSaveSettings({
      pinEnabled: currentForm.pinEnabled,
      pinHash: currentForm.pinEnabled ? nextPinHash : null,
      pinUpdatedAt: nextPinCode ? new Date().toISOString() : (settings.pinUpdatedAt ?? null),
      passkeyCredentialId: null,
      workday: {
        startTime: currentForm.workdayStartTime,
        endTime: currentForm.workdayEndTime,
        primaryRestWindow: { enabled: currentForm.primaryRestEnabled, label: currentForm.primaryRestLabel, startTime: currentForm.primaryRestStartTime, endTime: currentForm.primaryRestEndTime },
        secondaryRestWindow: { enabled: currentForm.secondaryRestEnabled, label: currentForm.secondaryRestLabel, startTime: currentForm.secondaryRestStartTime, endTime: currentForm.secondaryRestEndTime },
      },
      location: { ...settings.location, label: currentForm.locationLabel, city: currentForm.city, country: currentForm.country, timezone: currentForm.timezone },
      scheduling: { warnOnRestWindowConflict: currentForm.warnOnRestWindowConflict, autoAddRecurringToToday: currentForm.autoAddRecurringToToday },
      backup: { ...settings.backup, autoBackupEnabled: currentForm.autoBackupEnabled, backupIntervalMinutes: Math.max(5, Number(currentForm.backupIntervalMinutes) || 30), fileBackupEnabled: currentForm.fileBackupEnabled },
      morningBriefing: {
        nickname: currentForm.morningNickname || 'מיקי',
        motivationLine: currentForm.morningMotivationLine || 'לא צריך לנצח את כל היום בבת אחת, רק את הצעד הראשון.',
        closingLine: currentForm.morningClosingLine || 'יום נקי, מיקי. מתחילים.',
        style: currentForm.morningStyle,
        includeExerciseReminder: currentForm.morningIncludeExerciseReminder,
        exerciseLine: currentForm.morningExerciseLine || 'קום, תעשה תרגיל בוקר קצר, ותכניס אנרגיה לגוף לפני המסך.',
        includeGreeting: currentForm.morningIncludeGreeting,
        includeSummary: currentForm.morningIncludeSummary,
        includeDate: currentForm.morningIncludeDate,
        includeWeather: currentForm.morningIncludeWeather,
        includeMotivation: currentForm.morningIncludeMotivation,
        includeReminders: currentForm.morningIncludeReminders,
        includeTopTasks: currentForm.morningIncludeTopTasks,
        includeLeads: currentForm.morningIncludeLeads,
        includeClosing: currentForm.morningIncludeClosing,
        sectionOrder: currentForm.morningSectionOrder,
        alarmTime: currentForm.morningAlarmTime || '07:00',
        ringtoneUrl: currentForm.morningRingtoneUrl,
        androidPublishEndpoint: currentForm.morningAndroidPublishEndpoint || '/api/morning-briefing',
        androidPublishToken: currentForm.morningAndroidPublishToken,
        lastPublishedAt: settings.morningBriefing?.lastPublishedAt ?? null,
      },
      voice: {
        engine: currentForm.voiceEngine,
        elevenLabsApiKey: currentForm.elevenLabsApiKey,
        elevenLabsVoiceId: currentForm.elevenLabsVoiceId,
        elevenLabsModelId: currentForm.elevenLabsModelId || 'eleven_v3',
        elevenLabsOutputFormat: currentForm.elevenLabsOutputFormat || 'mp3_44100_128',
        elevenLabsProxyUrl: currentForm.elevenLabsProxyUrl,
        stability: Number(currentForm.elevenLabsStability) || 0.45,
        similarityBoost: Number(currentForm.elevenLabsSimilarityBoost) || 0.82,
        style: Number(currentForm.elevenLabsStyle) || 0.2,
        useSpeakerBoost: currentForm.elevenLabsUseSpeakerBoost,
        speechRate: currentForm.speechRate,
        narratorGender: currentForm.voiceNarratorGender,
      },
      socialConnections: {
        linkedin: { enabled: currentForm.linkedinEnabled, profileUrl: currentForm.linkedinProfileUrl, accessTokenPlaceholder: currentForm.linkedinAccessTokenPlaceholder, lastCheckedAt: settings.socialConnections?.linkedin?.lastCheckedAt ?? null },
        instagram: { enabled: currentForm.instagramEnabled, username: currentForm.instagramUsername, accessTokenPlaceholder: currentForm.instagramAccessTokenPlaceholder, lastCheckedAt: settings.socialConnections?.instagram?.lastCheckedAt ?? null },
      },
      instantly: { apiKey: currentForm.instantlyApiKey || undefined },
      meta: { ...settings.meta, appId: currentForm.metaAppId || undefined },
      shopify: { shopDomain: currentForm.shopifyShopDomain || undefined, adminAccessToken: currentForm.shopifyAdminAccessToken || undefined },
      googleAnalytics: { propertyId: currentForm.googleAnalyticsPropertyId || undefined },
      taskGroupOrder: currentForm.taskGroupOrder,
      projects: parsedProjects,
      domains: parsedDomains,
    });

    setSaveStatus('נשמר ✓');
  }

  // ── ElevenLabs test ──

  async function handleTestElevenLabs() {
    setVoiceTestStatus('');
    if (!form || !settings) { setVoiceTestStatus('ההגדרות עדיין נטענות.'); return; }
    const draftSettings: AppSettings = {
      ...settings,
      voice: {
        engine: form.voiceEngine, elevenLabsApiKey: form.elevenLabsApiKey, elevenLabsVoiceId: form.elevenLabsVoiceId,
        elevenLabsModelId: form.elevenLabsModelId || 'eleven_v3', elevenLabsOutputFormat: form.elevenLabsOutputFormat || 'mp3_44100_128',
        elevenLabsProxyUrl: form.elevenLabsProxyUrl, stability: Number(form.elevenLabsStability) || 0.45,
        similarityBoost: Number(form.elevenLabsSimilarityBoost) || 0.82, style: Number(form.elevenLabsStyle) || 0.2,
        useSpeakerBoost: form.elevenLabsUseSpeakerBoost, speechRate: form.speechRate, narratorGender: form.voiceNarratorGender,
      },
    };
    const cleanTestText = 'בדיקת קול קצרה ממישן קונטרול. אם שינית מהירות, אתה אמור לשמוע את ההבדל עכשיו.';
    const speechRate = normalizeSpeechRate(form.speechRate);
    if (form.voiceEngine === 'browser') {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setVoiceTestStatus('הדפדפן הזה לא תומך בהקראה.');
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanTestText);
      const voices = window.speechSynthesis.getVoices();
      const hebrewVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('he')) ?? voices[0] ?? null;
      if (hebrewVoice) utterance.voice = hebrewVoice;
      utterance.lang = hebrewVoice?.lang || 'he-IL';
      utterance.rate = speechRate;
      utterance.pitch = 0.98;
      utterance.volume = 1;
      utterance.onend = () => setVoiceTestStatus(`הצליח. דפדפן במהירות ${speechRate.toFixed(2)}x.`);
      utterance.onerror = () => setVoiceTestStatus('בדיקת קול בדפדפן נכשלה.');
      setVoiceTestStatus(`מנגן בדפדפן במהירות ${speechRate.toFixed(2)}x...`);
      window.speechSynthesis.speak(utterance);
      return;
    }
    const status = getElevenLabsConfigStatus(draftSettings);
    if (!status.ok) { setVoiceTestStatus(status.message); return; }
    setVoiceTestStatus(`בודק ElevenLabs במהירות ${speechRate.toFixed(2)}x... ${status.message}`);
    const result = await createElevenLabsAudioUrl(cleanTestText, draftSettings);
    if (!result.ok || !result.audioUrl) { setVoiceTestStatus(`נכשל: ${result.error || 'שגיאה לא ידועה'}`); return; }
    const audio = new Audio(result.audioUrl);
    audio.playbackRate = speechRate;
    audio.onended = () => {
      URL.revokeObjectURL(result.audioUrl ?? '');
      setVoiceTestStatus(`הצליח. ElevenLabs במהירות ${speechRate.toFixed(2)}x.`);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(result.audioUrl ?? '');
      setVoiceTestStatus('בדיקת ElevenLabs נכשלה בזמן ניגון.');
    };
    await audio.play();
    setVoiceTestStatus(`מנגן דרך ${result.usedProxy ? 'Proxy' : 'Direct'} במהירות ${speechRate.toFixed(2)}x.`);
  }

  // ── Cloudflare morning API test ──

  async function handleTestMorningApi() {
    setApiTestStatus('');
    if (!form) { setApiTestStatus('ההגדרות עדיין נטענות.'); return; }
    const endpoint = form.morningAndroidPublishEndpoint.trim() || '/api/morning-briefing';
    const token = form.morningAndroidPublishToken.trim();
    if (!token) { setApiTestStatus('חסר Token. אותו Token חייב להיות גם ב-Cloudflare.'); return; }
    const separator = endpoint.includes('?') ? '&' : '?';
    setApiTestStatus('בודק חיבור ל-Cloudflare API...');
    try {
      const response = await fetch(`${endpoint}${separator}token=${encodeURIComponent(token)}`);
      const ct = response.headers.get('content-type') || '';
      if (!ct.includes('application/json')) { setApiTestStatus(`ה־API החזיר ${response.status} אבל לא JSON. Function לא רץ בסביבה הזו.`); return; }
      const body = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (response.status === 401) { setApiTestStatus('Unauthorized: ה-Token לא זהה ל-MORNING_BRIEFING_TOKEN ב-Cloudflare.'); return; }
      if (response.status === 404 || body?.error === 'No morning briefing found') { setApiTestStatus('החיבור תקין. עדיין אין נאום בוקר מפורסם.'); return; }
      setApiTestStatus(body?.ok ? 'החיבור תקין וה-API החזיר נאום.' : `ה-API ענה אבל יש שגיאה: ${body?.error || response.status}`);
    } catch (error) {
      setApiTestStatus(error instanceof Error ? `בדיקה נכשלה: ${error.message}` : 'בדיקה נכשלה.');
    }
  }

  // ── Table stats test ──

  async function handleTestTableStatsApi() {
    if (!form) return;
    const endpoint = (form.morningAndroidPublishEndpoint || '/api/morning-briefing').replace('/api/morning-briefing', '/api/table-stats');
    const token = form.morningAndroidPublishToken.trim();
    if (!token) { setLeadTableSettingsStatus('חסר Token לפרסום / Android.'); return; }
    if (endpoint.startsWith('/api/') && window.location.hostname === '127.0.0.1') {
      setLeadTableSettingsStatus('בדיקה מלאה של table-stats לא עובדת ב־npm run dev.'); return;
    }
    try {
      setLeadTableSettingsStatus('בודק table-stats...');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token, todayISO, tables: leadTableSettings.filter((r) => r.table.trim()) }),
      });
      const ct = response.headers.get('content-type') || '';
      if (!ct.includes('application/json')) { setLeadTableSettingsStatus(`ה־API החזיר ${response.status} אבל לא JSON.`); return; }
      const body = await response.json().catch(() => null);
      setLeadTableSettingsStatus(body?.ok ? 'table-stats תקין.' : `שגיאה ב־table-stats: ${body?.error || response.status}`);
    } catch (error) {
      setLeadTableSettingsStatus(error instanceof Error ? `בדיקה נכשלה: ${error.message}` : 'בדיקה נכשלה.');
    }
  }

  // ── Section content ──

  const renderSection = () => {
    switch (openSection) {
      case 'visual': return (
        <div className="space-y-4">
          <SectionCard title="מראה ותצוגה" description="בחר ערכת צבעים — חל מיד.">
            <div className="grid grid-cols-3 gap-3">
              {COLOR_THEMES.map((t) => {
                const isActive = activeTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void onSaveSettings({ colorTheme: t.id })}
                    className={`relative rounded-[1.5rem] p-4 text-right transition ring-2 hover:-translate-y-0.5 ${isActive ? 'ring-slate-900 shadow-lg scale-[1.02]' : 'ring-slate-200 hover:ring-slate-400'}`}
                    style={{ background: `linear-gradient(135deg, ${t.swatchFrom} 0%, ${t.swatchTo} 100%)` }}
                  >
                    {isActive ? (
                      <span className="absolute left-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-slate-950 text-[11px] font-black text-white">✓</span>
                    ) : null}
                    <span className="mb-2 block h-3 w-3 rounded-full" style={{ background: t.accentDot }} />
                    <p className="text-sm font-black text-slate-950">{t.label}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-slate-500">{t.tagline}</p>
                  </button>
                );
              })}
            </div>
          </SectionCard>
          <TaskGroupOrderSection
            orderedGroups={orderedTaskGroups}
            onReorder={reorderTaskGroups}
          />
        </div>
      );
      case 'morning': return (
        <MorningSection
          form={form} updateField={updateField} settings={settings}
          orderedMorningSections={orderedMorningSections} moveMorningSection={moveMorningSection}
          voiceTestStatus={voiceTestStatus} onTestElevenLabs={() => void handleTestElevenLabs()}
          morningPreview={morningPreview}
        />
      );
      case 'connectivity': return (
        <div className="space-y-4">
          <ConnectDeviceSection settings={settings} />
          <PushNotificationsSection settings={settings} onSaveSettings={onSaveSettings} />
          <ApiSection
            form={form} updateField={updateField}
            leadTableSettings={leadTableSettings} updateLeadTableSetting={updateLeadTableSetting}
            leadTableSettingsStatus={leadTableSettingsStatus} apiTestStatus={apiTestStatus}
            onTestMorningApi={() => void handleTestMorningApi()} onTestTableStatsApi={() => void handleTestTableStatsApi()}
          />
          <AuthSection form={form} updateField={updateField} hasPinHash={Boolean(settings.pinHash)} />
        </div>
      );
      case 'workday': return (
        <div className="space-y-4">
          <WorkdaySection form={form} updateField={updateField} onCityChange={handleCityChange} onLocationLabelChange={handleLocationLabelChange} cityHint={cityHint} />
          <AutomationSection form={form} updateField={updateField} />
        </div>
      );
      case 'projects': return <ProjectsSection projectsText={projectsText} onProjectsChange={setProjectsText} domainsText={domainsText} onDomainsChange={setDomainsText} />;
      case 'import': return (
        <SectionCard title="דוח / ייבוא" description="ייבוא דוחות ומשימות.">
          <ReportTab reports={reports} tasks={tasks} settings={settings} todayISO={todayISO} isSaving={isSaving} onImportReportTasks={onImportReportTasks} onDeleteLastImport={onDeleteLastImport} />
        </SectionCard>
      );
      case 'advanced': return (
        <SectionCard title="מתקדם" description="בדיקת יכולות הדפדפן המקומיות.">
          <dl className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><dt className="text-sm text-slate-500">IndexedDB</dt><dd className="mt-1 font-bold text-slate-900">{isIndexedDBAvailable() ? 'זמין' : 'לא זמין'}</dd></div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><dt className="text-sm text-slate-500">File System Access API</dt><dd className="mt-1 font-bold text-slate-900">{isFileSystemAccessAvailable() ? 'זמין בכרום' : 'לא זמין / לא נתמך'}</dd></div>
          </dl>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><p className="text-sm font-bold text-slate-900">Supabase</p><p className="mt-1 text-xs text-slate-500">מכוון לעתיד בלבד — אין אינטגרציה ואין מפתחות בקוד.</p></div>
          {onClearAllTasks && (
            <div className="mt-4 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
              <p className="text-sm font-black text-rose-800">מחק את כל המשימות</p>
              <p className="mt-1 text-xs text-rose-600">מוחק את כל המשימות ותתי-המשימות מהדפדפן. לא ניתן לשחזר.</p>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  if (window.confirm(`למחוק את כל ${tasks.length} המשימות? פעולה זו אינה הפיכה.`)) {
                    void onClearAllTasks();
                  }
                }}
                className="mt-3 rounded-xl bg-rose-600 px-5 py-2 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-50 transition"
              >
                🗑 מחק הכל ({tasks.length} משימות)
              </button>
            </div>
          )}
        </SectionCard>
      );
      default: return null;
    }
  };

  // ── Render ──

  const activeTheme = settings.colorTheme ?? 'slate-sky';

  return (
    <div className="grid gap-4">
      <SectionCard title="הגדרות" description="לחיצה על שורה פותחת את התוכן בלי גלילה אוטומטית.">
        <div className="space-y-2">
          {SETTINGS_SECTIONS.map((section) => (
            <div key={section.id} className="space-y-2">
              <button
                type="button"
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-4 text-right ring-1 transition ${openSection === section.id ? 'bg-sky-50 text-slate-950 ring-sky-200' : 'bg-white text-slate-900 ring-slate-200 hover:bg-slate-50'}`}
                onClick={() => openSectionAndPersist(openSection === section.id ? '' : section.id)}
              >
                <span className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-2xl text-lg ${openSection === section.id ? 'bg-sky-100' : 'bg-slate-100'}`}>{section.icon}</span>
                  <span>
                    <span className="block text-base font-black">{section.title}</span>
                    <span className="mt-1 block text-xs font-bold text-slate-500">{section.description}</span>
                  </span>
                </span>
                <span className={openSection === section.id ? 'text-sky-700' : 'text-slate-400'}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points={openSection === section.id ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                  </svg>
                </span>
              </button>
              {openSection === section.id ? (
                <div className="rounded-3xl bg-slate-50/70 p-2 ring-1 ring-slate-200">
                  {renderSection()}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="sticky bottom-4 z-20 flex flex-col items-end gap-2">
        {(saveStatus || cloudSyncStatus) ? (
          <p className={`rounded-full px-4 py-2 text-sm font-bold shadow-sm ring-1 ${saveStatus?.includes('✓') ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-sky-50 text-sky-800 ring-sky-200'}`}>
            {saveStatus || cloudSyncStatus}
          </p>
        ) : null}
        <div className="flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 shadow-soft ring-1 ring-slate-200 backdrop-blur">
          {onPullCloud ? (
            <button type="button" className="rounded-full bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-800 ring-1 ring-sky-200 transition hover:bg-sky-100 disabled:opacity-50" onClick={() => void onPullCloud()} disabled={isSaving}>
              ↓ טען מהענן
            </button>
          ) : null}
          {onPushCloud ? (
            <button type="button" className="rounded-full bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-50" onClick={() => void onPushCloud()} disabled={isSaving}>
              ↑ סנכרן לענן
            </button>
          ) : null}
          <button type="button" className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור + סנכרן'}
          </button>
        </div>
      </div>
    </div>
  );
}
