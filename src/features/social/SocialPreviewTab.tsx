import { useMemo, useState } from 'react';
import type { SettingsPatch } from '../../domain/settings/settingsService';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import type { CreateTaskInput } from '../../domain/tasks/taskMutations';
import { getTaskProgress } from '../../domain/tasks/taskProgress';
import { getSubtasksForTask } from '../../domain/tasks/taskSelectors';
import type { Subtask, Task } from '../../domain/tasks/taskTypes';
import { isSameDatePrefix, normalizeSearch } from '../../utils/strings';
import { InstantlyCard } from './InstantlyCard';
import { MetaConnectCard } from './MetaConnectCard';

type SourceFilter = 'all' | 'supabase' | 'shopify' | 'ga4' | 'tasks';

type SupabaseLeadTableConfig = {
  id: string;
  project: 'TypeSwitch' | 'TimerAligner B2B';
  label: string;
  table: string;
  dateColumn: string;
};

type SupabaseLeadTableResult = SupabaseLeadTableConfig & {
  ok: boolean;
  total?: number;
  today?: number;
  sinceLast?: number;
  checkedAt?: string;
  lastCheckedAt?: string | null;
  error?: string;
  skipped?: boolean;
};

type LeadSignal = {
  id: string;
  source: SourceFilter | 'instantly' | 'meta';
  sourceLabel: string;
  title: string;
  person?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  project?: string | null;
  status?: string | null;
  value?: number | null;
  sourceUrl?: string | null;
  occurredAt?: string | null;
};

type ShopifyStats = {
  ok: boolean;
  checkedAt: string;
  metrics: {
    ordersToday: number;
    openOrders: number;
    customersToday: number;
    revenueToday: number;
  };
  recentOrders: Array<{
    id: string | number;
    name: string;
    email: string;
    customerName: string;
    totalPrice: number;
    currency: string;
    createdAt: string;
    financialStatus: string;
    fulfillmentStatus: string;
    itemsCount: number;
  }>;
};

type GoogleAnalyticsStats = {
  ok: boolean;
  checkedAt: string;
  metrics: {
    sessions7d: number;
    users7d: number;
    pageViews7d: number;
    conversions7d: number;
    revenue7d: number;
    sessionsToday: number;
    usersToday: number;
  };
  channels: Array<{ channel: string; sessions: number; users: number }>;
};

const LEADS_TABLE_CONFIG_KEY = 'mission-control.supabase-leads.table-config.v1';
const LEADS_TABLE_LAST_SEEN_KEY = 'mission-control.supabase-leads.last-seen.v1';

const defaultLeadTableConfigs: SupabaseLeadTableConfig[] = [
  { id: 'typeswitch-primary', project: 'TypeSwitch', label: 'TypeSwitch - Table 1', table: '', dateColumn: 'created_at' },
  { id: 'typeswitch-secondary', project: 'TypeSwitch', label: 'TypeSwitch - Table 2', table: '', dateColumn: 'created_at' },
  { id: 'timeraligner-b2b', project: 'TimerAligner B2B', label: 'B2B TimerAligner', table: '', dateColumn: 'created_at' },
];

function loadLeadTableConfigs(): SupabaseLeadTableConfig[] {
  if (typeof window === 'undefined') return defaultLeadTableConfigs;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEADS_TABLE_CONFIG_KEY) || 'null');
    if (!Array.isArray(parsed)) return defaultLeadTableConfigs;
    return defaultLeadTableConfigs.map((fallback, index) => ({
      ...fallback,
      ...(parsed[index] || {}),
      id: fallback.id,
      project: fallback.project,
    }));
  } catch {
    return defaultLeadTableConfigs;
  }
}

function loadLeadTableLastSeen(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEADS_TABLE_LAST_SEEN_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLeadTableLastSeen(value: Record<string, string>) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LEADS_TABLE_LAST_SEEN_KEY, JSON.stringify(value));
  }
}

function getFunctionEndpoint(settings: AppSettings | null, functionName: string): string {
  const base = settings?.morningBriefing?.androidPublishEndpoint?.trim() || '/api/morning-briefing';
  const known = [
    'morning-briefing',
    'sync-state',
    'table-stats',
    'lead-feed',
    'instantly-stats',
    'meta-proxy',
    'shopify-stats',
    'google-analytics-stats',
  ];
  for (const name of known) {
    if (base.includes(`/api/${name}`)) return base.replace(`/api/${name}`, `/api/${functionName}`);
  }
  return `/api/${functionName}`;
}

function isCloudFunctionUnavailable(endpoint: string): boolean {
  if (typeof window === 'undefined') return false;
  return endpoint.startsWith('/api/') && ['127.0.0.1', 'localhost'].includes(window.location.hostname);
}

function formatNumber(value: number | string | null | undefined): string {
  if (value == null || value === '') return '-';
  if (typeof value === 'string') return value;
  return new Intl.NumberFormat('he-IL', { maximumFractionDigits: value >= 1000 ? 0 : 1 }).format(value);
}

function formatMoney(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatTime(value?: string | null): string {
  if (!value) return 'לא עודכן';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function isTaskDone(task: Task, subtasks: Subtask[]) {
  if (task.completedAt) return true;
  const progress = getTaskProgress(task, getSubtasksForTask(task.id, subtasks));
  return progress.status === 'done';
}

function isLeadTask(task: Task) {
  const text = normalizeSearch(`${task.title} ${(task.tags ?? []).join(' ')} ${task.projectId ?? ''} ${task.domainId ?? ''}`);
  return /lead|leads|apollo|instantly|linkedin|instagram|meta|shopify|analytics|social|clinic|ליד|לידים|סושיאל|פולואפ|מעקב|follow.up/.test(text);
}

function isContentTask(task: Task) {
  const text = normalizeSearch(`${task.title} ${(task.tags ?? []).join(' ')} ${task.domainId ?? ''}`);
  return /content|post|instagram|linkedin|meta|פוסט|תוכן|newsletter|article|סושיאל/.test(text);
}

function leadTitle(signal: LeadSignal): string {
  return signal.person || signal.company || signal.title || signal.email || 'ליד חדש';
}

interface MetricCardProps {
  label: string;
  value: number | string;
  hint: string;
  tone: 'sky' | 'emerald' | 'amber' | 'violet' | 'slate';
}

function MetricCard({ label, value, hint, tone }: MetricCardProps) {
  const toneClass = {
    sky: 'bg-sky-50 text-sky-950 ring-sky-100',
    emerald: 'bg-emerald-50 text-emerald-950 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-950 ring-amber-100',
    violet: 'bg-violet-50 text-violet-950 ring-violet-100',
    slate: 'bg-white text-slate-950 ring-slate-100',
  }[tone];
  return (
    <div className={`rounded-[1.5rem] p-4 shadow-soft ring-1 ${toneClass}`}>
      <p className="text-[11px] font-black text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black leading-none">{formatNumber(value)}</p>
      <p className="mt-1 text-[11px] font-bold text-slate-500">{hint}</p>
    </div>
  );
}

interface SocialPreviewTabProps {
  settings: AppSettings | null;
  todayISO: string;
  tasks: Task[];
  subtasks: Subtask[];
  onJumpToTask: (task: Task) => void;
  onCompleteTask: (taskId: string) => void;
  onCreateTask?: (input: CreateTaskInput) => Promise<void> | void;
  onSaveSettings: (patch: SettingsPatch) => Promise<void>;
}

export function SocialPreviewTab({
  settings,
  todayISO,
  tasks,
  subtasks,
  onJumpToTask,
  onCompleteTask,
  onCreateTask,
  onSaveSettings,
}: SocialPreviewTabProps) {
  const [configs] = useState<SupabaseLeadTableConfig[]>(loadLeadTableConfigs);
  const [lastSeen, setLastSeen] = useState<Record<string, string>>(loadLeadTableLastSeen);
  const [results, setResults] = useState<SupabaseLeadTableResult[]>([]);
  const [leadFeed, setLeadFeed] = useState<LeadSignal[]>([]);
  const [shopifyStats, setShopifyStats] = useState<ShopifyStats | null>(null);
  const [gaStats, setGaStats] = useState<GoogleAnalyticsStats | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('מוכן לרענון נתוני לידים וסושיאל.');
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  const token = settings?.morningBriefing?.androidPublishToken?.trim();
  const activeConfigs = configs.filter((config) => config.table.trim());

  const leadTasks = useMemo(() => tasks.filter(isLeadTask), [tasks]);
  const openLeadTasks = useMemo(
    () => leadTasks.filter((task) => !isTaskDone(task, subtasks) && task.statusOverride !== 'cancelled'),
    [leadTasks, subtasks],
  );
  const todayLeadTasks = useMemo(
    () => openLeadTasks.filter((task) => task.bucket === 'today' || isSameDatePrefix(task.date, todayISO)),
    [openLeadTasks, todayISO],
  );
  const doneLeadToday = useMemo(
    () => leadTasks.filter((task) => task.bucket === 'today' || isSameDatePrefix(task.date, todayISO)).filter((task) => isTaskDone(task, subtasks)).length,
    [leadTasks, subtasks, todayISO],
  );
  const contentTasks = useMemo(
    () => tasks.filter(isContentTask).filter((task) => !isTaskDone(task, subtasks)).slice(0, 8),
    [tasks, subtasks],
  );

  const taskSignals: LeadSignal[] = useMemo(
    () => openLeadTasks.slice(0, 12).map((task) => ({
      id: task.id,
      source: 'tasks',
      sourceLabel: 'משימה',
      title: task.title,
      project: task.projectId,
      status: task.bucket === 'today' ? 'היום' : task.bucket === 'weekly' ? 'השבוע' : 'Backlog',
      occurredAt: task.updatedAt,
    })),
    [openLeadTasks],
  );

  const shopifySignals: LeadSignal[] = useMemo(
    () => (shopifyStats?.recentOrders || []).slice(0, 8).map((order) => ({
      id: String(order.id),
      source: 'shopify',
      sourceLabel: 'Shopify',
      title: order.name,
      person: order.customerName || null,
      email: order.email || null,
      status: order.fulfillmentStatus,
      value: order.totalPrice,
      occurredAt: order.createdAt,
      project: 'Shopify',
    })),
    [shopifyStats],
  );

  const gaSignals: LeadSignal[] = useMemo(
    () => {
      if (!gaStats) return [];
      return gaStats.channels.slice(0, 5).map((channel) => ({
        id: channel.channel,
        source: 'ga4',
        sourceLabel: 'GA4',
        title: `${channel.channel}: ${formatNumber(channel.sessions)} סשנים`,
        status: `${formatNumber(channel.users)} משתמשים`,
        occurredAt: gaStats.checkedAt,
        project: 'Analytics',
      }));
    },
    [gaStats],
  );

  const allSignals = useMemo(
    () => [...leadFeed, ...shopifySignals, ...gaSignals, ...taskSignals]
      .sort((a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime()),
    [leadFeed, shopifySignals, gaSignals, taskSignals],
  );
  const visibleSignals = sourceFilter === 'all' ? allSignals : allSignals.filter((signal) => signal.source === sourceFilter);

  const supabaseTotals = results.reduce(
    (sum, row) => ({
      total: sum.total + (row.total || 0),
      today: sum.today + (row.today || 0),
      sinceLast: sum.sinceLast + (row.sinceLast || 0),
    }),
    { total: 0, today: 0, sinceLast: 0 },
  );

  async function fetchJson(endpoint: string, body: Record<string, unknown>) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ token, ...body }),
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new Error(`API החזיר ${response.status}, אבל לא JSON.`);
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || `API failed (${response.status})`);
    return payload;
  }

  async function refreshSupabase() {
    if (!token) throw new Error('חסר Token בהגדרות.');
    if (!activeConfigs.length) throw new Error('חסרים שמות טבלאות Supabase בהגדרות.');
    const statsEndpoint = getFunctionEndpoint(settings, 'table-stats');
    const feedEndpoint = getFunctionEndpoint(settings, 'lead-feed');
    if (isCloudFunctionUnavailable(statsEndpoint) || isCloudFunctionUnavailable(feedEndpoint)) {
      throw new Error('ב-dev רגיל אין Cloudflare Functions. בדיקה מלאה עובדת אחרי build/deploy.');
    }
    const tables = activeConfigs.map((config) => ({ ...config, lastCheckedAt: lastSeen[config.id] || null, limit: 30 }));
    const [statsPayload, feedPayload] = await Promise.all([
      fetchJson(statsEndpoint, { todayISO, tables }),
      fetchJson(feedEndpoint, { todayISO, tables }),
    ]);
    const checkedAt = statsPayload.checkedAt || feedPayload.checkedAt || new Date().toISOString();
    const mergedResults: SupabaseLeadTableResult[] = configs.map((config) => {
      const match = (statsPayload.results || []).find((item: SupabaseLeadTableResult) => item.id === config.id);
      return match ? { ...config, ...match } : { ...config, ok: false, error: 'לא הוחזר מידע' };
    });
    const nextSeen = { ...lastSeen };
    mergedResults.forEach((row) => {
      if (row.ok && row.checkedAt) nextSeen[row.id] = row.checkedAt;
    });
    setLastSeen(nextSeen);
    saveLeadTableLastSeen(nextSeen);
    setResults(mergedResults);
    setLeadFeed((feedPayload.items || []) as LeadSignal[]);
    return checkedAt;
  }

  async function refreshShopify() {
    const shopDomain = settings?.shopify?.shopDomain?.trim();
    const adminAccessToken = settings?.shopify?.adminAccessToken?.trim();
    if (!shopDomain || !adminAccessToken) return null;
    const endpoint = getFunctionEndpoint(settings, 'shopify-stats');
    if (isCloudFunctionUnavailable(endpoint)) return null;
    const payload = await fetchJson(endpoint, { shopDomain, adminAccessToken });
    setShopifyStats(payload as ShopifyStats);
    return payload.checkedAt as string;
  }

  async function refreshGoogleAnalytics() {
    const propertyId = settings?.googleAnalytics?.propertyId?.trim();
    if (!propertyId) return null;
    const endpoint = getFunctionEndpoint(settings, 'google-analytics-stats');
    if (isCloudFunctionUnavailable(endpoint)) return null;
    const payload = await fetchJson(endpoint, { propertyId });
    setGaStats(payload as GoogleAnalyticsStats);
    return payload.checkedAt as string;
  }

  async function refreshDashboard() {
    setIsLoading(true);
    setStatusMessage('מרענן נתונים מ-Supabase, Shopify ו-GA4...');
    try {
      const outcomes = await Promise.allSettled([refreshSupabase(), refreshShopify(), refreshGoogleAnalytics()]);
      const errors = outcomes
        .filter((item): item is PromiseRejectedResult => item.status === 'rejected')
        .map((item) => item.reason instanceof Error ? item.reason.message : String(item.reason));
      const lastDate = outcomes
        .filter((item): item is PromiseFulfilledResult<string | null> => item.status === 'fulfilled' && Boolean(item.value))
        .map((item) => item.value)
        .at(0);
      const checkedAt = lastDate || new Date().toISOString();
      setLastRefreshAt(checkedAt);
      setStatusMessage(errors.length ? `רוענן חלקית: ${errors.join(' | ')}` : 'הדשבורד עודכן בהצלחה.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'שגיאה לא ידועה ברענון הדשבורד.');
    } finally {
      setIsLoading(false);
    }
  }

  async function createFollowUpTask(signal: LeadSignal) {
    if (!onCreateTask) return;
    const title = `פולואפ: ${leadTitle(signal)}`;
    const notes = [
      `מקור: ${signal.sourceLabel}`,
      signal.email ? `אימייל: ${signal.email}` : '',
      signal.phone ? `טלפון: ${signal.phone}` : '',
      signal.company ? `חברה: ${signal.company}` : '',
      signal.status ? `סטטוס: ${signal.status}` : '',
      signal.sourceUrl ? `קישור: ${signal.sourceUrl}` : '',
    ].filter(Boolean).join('\n');
    const input: CreateTaskInput = {
      title,
      projectId: signal.project || 'Sales',
      domainId: 'Sales',
      bucket: 'today',
      date: todayISO,
      originalDate: todayISO,
      scheduledTimeLabel: undefined,
      estimatedDurationMinutes: 15,
      durationLabel: '15 דק',
      priority: 'medium',
      effort: 'quick',
      isQuickWin: true,
      isRecurring: false,
      recurrenceDefinitionId: null,
      backlogGroup: null,
      tags: ['lead', 'social', signal.source],
      whyNow: 'נוצר מתוך דשבורד לידים וסושיאל',
      notes,
      statusOverride: null,
      movedToDate: null,
      focusOrder: null,
      focusUpdatedAt: null,
      subtasks: [{ title: `לחזור ל${leadTitle(signal)}`, domainId: 'Sales', estimatedDurationMinutes: 15, durationLabel: '15 דק', notes }],
      source: 'manual',
    };
    await onCreateTask(input);
    setStatusMessage(`נוצרה משימת פולואפ: ${leadTitle(signal)}`);
  }

  const shopifyCurrency = shopifyStats?.recentOrders.find((order) => order.currency)?.currency || 'USD';
  const metaConnected = Boolean(settings?.meta?.accessToken && settings?.meta?.instagramUserId);

  return (
    <section className="space-y-4 pb-6" dir="rtl">
      <div className="rounded-[1.75rem] bg-white/95 p-4 shadow-soft ring-1 ring-sky-100">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-sky-600">Leads & Social Command Center</p>
            <h2 className="mt-1 text-2xl font-black leading-tight text-slate-950">מרכז נתונים חי</h2>
            <p className="mt-1 max-w-2xl text-sm font-bold leading-6 text-slate-500">
              Supabase, Instantly, Instagram / Meta, Shopify ו-GA4 במקום אחד, עם מעבר מהיר למשימת פעולה.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void refreshDashboard()}
              disabled={isLoading}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {isLoading ? 'מרענן...' : 'רענן דשבורד'}
            </button>
            <span className="rounded-2xl bg-sky-50 px-4 py-3 text-center text-xs font-black text-sky-900 ring-1 ring-sky-100">
              עדכון אחרון: {formatTime(lastRefreshAt)}
            </span>
          </div>
        </div>
        <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-100">{statusMessage}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="לידים היום" value={results.length ? supabaseTotals.today : '-'} hint="Supabase tables" tone="sky" />
        <MetricCard label="חדשים מהרענון" value={results.length ? supabaseTotals.sinceLast : '-'} hint="מאז בדיקה קודמת" tone="amber" />
        <MetricCard label="פולואפים פתוחים" value={openLeadTasks.length} hint={`${todayLeadTasks.length} להיום`} tone="violet" />
        <MetricCard label="הזמנות היום" value={shopifyStats?.metrics.ordersToday ?? '-'} hint={shopifyStats ? formatMoney(shopifyStats.metrics.revenueToday, shopifyCurrency) : 'Shopify'} tone="emerald" />
        <MetricCard label="סשנים היום" value={gaStats?.metrics.sessionsToday ?? '-'} hint={gaStats ? `${formatNumber(gaStats.metrics.usersToday)} משתמשים` : 'GA4'} tone="slate" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <article className="rounded-[1.75rem] bg-white/95 p-4 shadow-soft ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Signal Feed</p>
              <h3 className="text-xl font-black text-slate-950">מה דורש פעולה</h3>
            </div>
            <div className="mission-chip-strip flex gap-2 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'הכל' },
                { id: 'supabase', label: 'Supabase' },
                { id: 'shopify', label: 'Shopify' },
                { id: 'ga4', label: 'GA4' },
                { id: 'tasks', label: 'משימות' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSourceFilter(item.id as SourceFilter)}
                  className={`shrink-0 rounded-2xl px-3 py-2 text-xs font-black ring-1 transition ${
                    sourceFilter === item.id
                      ? 'bg-slate-950 text-white ring-slate-950'
                      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {visibleSignals.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center ring-1 ring-slate-100">
                <p className="text-sm font-black text-slate-500">אין עדיין סיגנלים להצגה.</p>
                <p className="mt-1 text-xs font-bold text-slate-400">לחץ רענן דשבורד או ודא שהטבלאות מוגדרות בהגדרות.</p>
              </div>
            ) : (
              visibleSignals.slice(0, 20).map((signal) => (
                <div key={`${signal.source}-${signal.id}`} className="flex flex-col gap-3 rounded-2xl bg-slate-50 px-3 py-3 ring-1 ring-slate-100 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-xl bg-white px-2 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-200">{signal.sourceLabel}</span>
                      {signal.status ? <span className="rounded-xl bg-sky-50 px-2 py-1 text-[10px] font-black text-sky-700 ring-1 ring-sky-100">{signal.status}</span> : null}
                      {signal.value ? <span className="rounded-xl bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-100">{formatMoney(signal.value)}</span> : null}
                    </div>
                    <p className="mt-2 truncate text-sm font-black text-slate-950">{leadTitle(signal)}</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                      {[signal.email, signal.phone, signal.company, signal.project].filter(Boolean).join(' · ') || signal.title}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {signal.sourceUrl ? (
                      <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                        פתח
                      </a>
                    ) : null}
                    {signal.source === 'tasks' ? (
                      <button
                        type="button"
                        onClick={() => {
                          const task = tasks.find((item) => item.id === signal.id);
                          if (task) onJumpToTask(task);
                        }}
                        className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white"
                      >
                        למשימה
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void createFollowUpTask(signal)}
                        disabled={!onCreateTask}
                        className="rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        פולואפ
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <div className="space-y-4">
          <article className="rounded-[1.75rem] bg-gradient-to-l from-emerald-50 to-white p-4 shadow-soft ring-1 ring-emerald-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Next Best Action</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  {todayLeadTasks[0]?.title || openLeadTasks[0]?.title || 'אין פולואפ דחוף כרגע'}
                </h3>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  הושלמו היום {doneLeadToday} משימות לידים. פתוחות להיום {todayLeadTasks.length}.
                </p>
              </div>
            </div>
            {todayLeadTasks[0] || openLeadTasks[0] ? (
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => onCompleteTask((todayLeadTasks[0] || openLeadTasks[0]).id)}
                  className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white"
                >
                  סיים
                </button>
                <button
                  type="button"
                  onClick={() => onJumpToTask(todayLeadTasks[0] || openLeadTasks[0])}
                  className="rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-slate-700 ring-1 ring-slate-200"
                >
                  פתח
                </button>
              </div>
            ) : null}
          </article>

          <article className="rounded-[1.75rem] bg-white/95 p-4 shadow-soft ring-1 ring-slate-100">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Connector Status</p>
            <div className="mt-3 space-y-2">
              {[
                { label: 'Supabase', value: activeConfigs.length ? `${activeConfigs.length} טבלאות` : 'לא מוגדר', ok: activeConfigs.length > 0 },
                { label: 'Instagram / Meta', value: metaConnected ? 'מחובר' : 'דורש חיבור', ok: metaConnected },
                { label: 'Shopify', value: settings?.shopify?.shopDomain ? settings.shopify.shopDomain : 'לא מוגדר', ok: Boolean(settings?.shopify?.shopDomain && settings?.shopify?.adminAccessToken) },
                { label: 'Google Analytics', value: settings?.googleAnalytics?.propertyId ? `Property ${settings.googleAnalytics.propertyId}` : 'לא מוגדר', ok: Boolean(settings?.googleAnalytics?.propertyId) },
                { label: 'LinkedIn', value: 'API מוגבל, בשלב הבא', ok: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900">{item.label}</p>
                    <p className="truncate text-[11px] font-bold text-slate-500">{item.value}</p>
                  </div>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <InstantlyCard settings={settings} />
        <MetaConnectCard settings={settings} onSaveSettings={onSaveSettings} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-[1.75rem] bg-white/95 p-4 shadow-soft ring-1 ring-emerald-100">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-emerald-600">Shopify</p>
              <h3 className="text-lg font-black text-slate-950">מכירות והזמנות</h3>
            </div>
            <button type="button" onClick={() => void refreshShopify()} className="rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-black text-white">
              רענן
            </button>
          </div>
          {shopifyStats ? (
            <>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <MetricCard label="הזמנות היום" value={shopifyStats.metrics.ordersToday} hint="נוצרו היום" tone="emerald" />
                <MetricCard label="פתוחות" value={shopifyStats.metrics.openOrders} hint="דורשות טיפול" tone="amber" />
                <MetricCard label="לקוחות חדשים" value={shopifyStats.metrics.customersToday} hint="היום" tone="sky" />
              </div>
              <div className="mt-4 space-y-2">
                {shopifyStats.recentOrders.slice(0, 4).map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{order.name} · {order.customerName || order.email || 'לקוח'}</p>
                      <p className="text-[11px] font-bold text-slate-500">{order.fulfillmentStatus} · {formatTime(order.createdAt)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-emerald-700">{formatMoney(order.totalPrice, order.currency || shopifyCurrency)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm font-bold text-slate-500 ring-1 ring-slate-100">
              הוסף Shopify store domain ו-Admin access token בהגדרות, ואז לחץ רענן.
            </div>
          )}
        </article>

        <article className="rounded-[1.75rem] bg-white/95 p-4 shadow-soft ring-1 ring-sky-100">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-sky-600">Google Analytics</p>
              <h3 className="text-lg font-black text-slate-950">תנועה והמרות</h3>
            </div>
            <button type="button" onClick={() => void refreshGoogleAnalytics()} className="rounded-2xl bg-sky-600 px-4 py-2 text-xs font-black text-white">
              רענן
            </button>
          </div>
          {gaStats ? (
            <>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <MetricCard label="סשנים 7 ימים" value={gaStats.metrics.sessions7d} hint="כל הערוצים" tone="sky" />
                <MetricCard label="משתמשים" value={gaStats.metrics.users7d} hint="7 ימים" tone="violet" />
                <MetricCard label="המרות" value={gaStats.metrics.conversions7d || '-'} hint="7 ימים" tone="emerald" />
              </div>
              <div className="mt-4 space-y-2">
                {gaStats.channels.map((channel) => (
                  <div key={channel.channel} className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-black text-slate-900">{channel.channel}</p>
                      <p className="shrink-0 text-xs font-black text-sky-700">{formatNumber(channel.sessions)} סשנים</p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-sky-400"
                        style={{ width: `${Math.min(100, Math.max(4, (channel.sessions / Math.max(1, gaStats.metrics.sessions7d)) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-5 text-sm font-bold text-slate-500 ring-1 ring-slate-100">
              הוסף GA4 Property ID בהגדרות. ב-Cloudflare צריך להוסיף גם service account.
            </div>
          )}
        </article>
      </div>

      {contentTasks.length > 0 ? (
        <div>
          <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-500">תוכן וסושיאל פתוח</p>
          <div className="mission-chip-strip flex gap-3 overflow-x-auto pb-2">
            {contentTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onJumpToTask(task)}
                className="shrink-0 rounded-2xl bg-white px-4 py-3 text-right shadow-soft ring-1 ring-slate-100 transition hover:ring-sky-200"
                style={{ minWidth: '220px', maxWidth: '260px' }}
              >
                <p className="truncate text-sm font-black text-slate-900">{task.title}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  {task.projectId || 'ללא פרויקט'} · {task.bucket === 'today' ? 'היום' : task.bucket === 'weekly' ? 'השבוע' : 'Backlog'}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
