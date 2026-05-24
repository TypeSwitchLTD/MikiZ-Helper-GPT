import { useState } from 'react';
import { getTaskProgress } from '../../domain/tasks/taskProgress';
import { getSubtasksForTask } from '../../domain/tasks/taskSelectors';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import type { SettingsPatch } from '../../domain/settings/settingsService';
import type { Subtask, Task } from '../../domain/tasks/taskTypes';
import { normalizeSearch, isSameDatePrefix } from '../../utils/strings';
import { InstantlyCard } from './InstantlyCard';
import { MetaConnectCard } from './MetaConnectCard';

// ─── Supabase lead table types ────────────────────────────────────────────────

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

const LEADS_TABLE_CONFIG_KEY = 'mission-control.supabase-leads.table-config.v1';
const LEADS_TABLE_LAST_SEEN_KEY = 'mission-control.supabase-leads.last-seen.v1';

const defaultLeadTableConfigs: SupabaseLeadTableConfig[] = [
  { id: 'typeswitch-primary', project: 'TypeSwitch', label: 'TypeSwitch — טבלה 1', table: '', dateColumn: 'created_at' },
  { id: 'typeswitch-secondary', project: 'TypeSwitch', label: 'TypeSwitch — טבלה 2', table: '', dateColumn: 'created_at' },
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

function getTableStatsEndpoint(settings: AppSettings | null): string {
  const endpoint = settings?.morningBriefing?.androidPublishEndpoint?.trim() || '/api/morning-briefing';
  if (endpoint.includes('/api/morning-briefing')) return endpoint.replace('/api/morning-briefing', '/api/table-stats');
  if (endpoint.includes('/api/sync-state')) return endpoint.replace('/api/sync-state', '/api/table-stats');
  if (endpoint.includes('/api/table-stats')) return endpoint;
  return '/api/table-stats';
}

function formatLeadSyncTime(value?: string | null): string {
  if (!value) return 'עוד לא בוצע עדכון';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function SupabaseMetricBubble({ label, value, tone }: { label: string; value: number | string; tone: 'sky' | 'emerald' | 'amber' }) {
  const toneClass =
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-950 ring-emerald-200' :
    tone === 'amber' ? 'bg-amber-50 text-amber-950 ring-amber-200' :
    'bg-sky-50 text-sky-950 ring-sky-200';
  return (
    <div className={`rounded-3xl px-3 py-3 text-center ring-1 ${toneClass}`}>
      <p className="text-[11px] font-black opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black leading-none">{value}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SocialPreviewTabProps {
  settings: AppSettings | null;
  todayISO: string;
  tasks: Task[];
  subtasks: Subtask[];
  onJumpToTask: (task: Task) => void;
  onCompleteTask: (taskId: string) => void;
  onSaveSettings: (patch: SettingsPatch) => Promise<void>;
}

export function SocialPreviewTab({
  settings,
  todayISO,
  tasks,
  subtasks,
  onJumpToTask,
  onCompleteTask,
  onSaveSettings,
}: SocialPreviewTabProps) {
  const [configs] = useState<SupabaseLeadTableConfig[]>(loadLeadTableConfigs);
  const [lastSeen, setLastSeen] = useState<Record<string, string>>(loadLeadTableLastSeen);
  const [results, setResults] = useState<SupabaseLeadTableResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('עדיין לא בוצע עדכון Supabase.');
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  const refreshStats = async () => {
    const token = settings?.morningBriefing?.androidPublishToken?.trim();
    if (!token) { setStatusMessage('חסר Token בהגדרות > סנכרון, ענן ואבטחה.'); return; }
    const activeConfigs = configs.filter((c) => c.table.trim());
    if (!activeConfigs.length) { setStatusMessage('חסרים שמות טבלאות — מגדירים בהגדרות.'); return; }
    const endpoint = getTableStatsEndpoint(settings);
    if (endpoint.startsWith('/api/') && window.location.hostname === '127.0.0.1') {
      setStatusMessage('ב־npm run dev אין Cloudflare Functions. צריך deploy מלא.'); return;
    }
    setIsLoading(true);
    setStatusMessage('מושך נתונים מ־Supabase...');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token, todayISO, tables: activeConfigs.map((c) => ({ ...c, lastCheckedAt: lastSeen[c.id] || null })) }),
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error(`API החזיר ${response.status} אבל לא JSON.`);
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || `Supabase stats failed (${response.status})`);
      const checkedAt = payload.checkedAt || new Date().toISOString();
      const mergedResults: SupabaseLeadTableResult[] = configs.map((c) => {
        const r = (payload.results || []).find((item: SupabaseLeadTableResult) => item.id === c.id);
        return r ? { ...c, ...r } : { ...c, ok: false, error: 'לא הוחזר מידע' };
      });
      const nextSeen = { ...lastSeen };
      mergedResults.forEach((r) => { if (r.ok && r.checkedAt) nextSeen[r.id] = r.checkedAt; });
      setLastSeen(nextSeen);
      saveLeadTableLastSeen(nextSeen);
      setResults(mergedResults);
      setLastRefreshAt(checkedAt);
      setStatusMessage('העדכון הסתיים.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'שגיאה לא ידועה בעדכון Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  const displayRows: SupabaseLeadTableResult[] = results.length
    ? results
    : configs.map((c) => ({ ...c, ok: false, skipped: !c.table, error: c.table ? undefined : 'חסר שם טבלה' }));

  const totals = displayRows.reduce(
    (sum, r) => ({ total: sum.total + (r.total || 0), today: sum.today + (r.today || 0), sinceLast: sum.sinceLast + (r.sinceLast || 0) }),
    { total: 0, today: 0, sinceLast: 0 },
  );

  // ── Task slices ────────────────────────────────────────────────────────────
  const isLeadTask = (task: Task) => {
    const text = normalizeSearch(`${task.title} ${(task.tags ?? []).join(' ')} ${task.projectId ?? ''} ${task.domainId ?? ''}`);
    return /lead|leads|apollo|instantly|linkedin|instagram|social|clinic|לידים|סושיאל|פולואפ|follow.up/.test(text);
  };

  const isContentTask = (task: Task) => {
    const text = normalizeSearch(`${task.title} ${(task.tags ?? []).join(' ')} ${task.domainId ?? ''}`);
    return /content|post|פוסט|תוכן|newsletter|רשומה|article/.test(text);
  };

  const isTaskDone = (task: Task) => {
    if (task.completedAt) return true;
    const progress = getTaskProgress(task, getSubtasksForTask(task.id, subtasks));
    return progress.status === 'done';
  };

  const leadTasks = tasks.filter(isLeadTask);
  const openLeadTasks = leadTasks.filter((t) => !isTaskDone(t) && t.statusOverride !== 'cancelled');
  const todayLeadTasks = openLeadTasks.filter((t) => t.bucket === 'today' || isSameDatePrefix(t.date, todayISO));
  const doneLeadToday = leadTasks.filter((t) => t.bucket === 'today' || isSameDatePrefix(t.date, todayISO)).filter(isTaskDone).length;
  const followUpCount = openLeadTasks.filter((t) => /followup|follow.up|מעקב|פולואפ/i.test(`${t.title} ${t.tags.join(' ')}`)).length;
  const contentTasks = tasks.filter(isContentTask).filter((t) => !isTaskDone(t)).slice(0, 8);

  const focusNowTask = todayLeadTasks[0] ?? openLeadTasks[0] ?? null;
  const topLeadList = openLeadTasks.slice(0, 5);

  return (
    <section className="space-y-4" dir="rtl">

      {/* ── Zone 1: Pulse strip ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[1.75rem] bg-white/92 p-4 text-center shadow-soft ring-1 ring-sky-100">
          <p className="text-[11px] font-black text-sky-600">לידים היום</p>
          <p className="mt-2 text-4xl font-black leading-none text-slate-950">{results.length ? totals.today : '—'}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-400">Supabase</p>
        </div>
        <div className="rounded-[1.75rem] bg-white/92 p-4 text-center shadow-soft ring-1 ring-violet-100">
          <p className="text-[11px] font-black text-violet-600">פולואפים</p>
          <p className="mt-2 text-4xl font-black leading-none text-slate-950">{followUpCount}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-400">פתוחים</p>
        </div>
        <div className="rounded-[1.75rem] bg-white/92 p-4 text-center shadow-soft ring-1 ring-emerald-100">
          <p className="text-[11px] font-black text-emerald-600">הושלם</p>
          <p className="mt-2 text-4xl font-black leading-none text-slate-950">{doneLeadToday}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-400">מתוך {doneLeadToday + todayLeadTasks.length}</p>
        </div>
      </div>

      {/* ── Zone 2: Lead Sources ──────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <InstantlyCard settings={settings} />

        {/* Supabase snapshot */}
        <article className="rounded-[2rem] bg-white/92 p-5 shadow-soft ring-1 ring-sky-100">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-sky-600">Supabase</p>
              <h2 className="mt-0.5 text-lg font-black text-slate-950">סנאפשוט לידים</h2>
            </div>
            <button
              type="button"
              onClick={() => void refreshStats()}
              disabled={isLoading}
              className="rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {isLoading ? 'טוען...' : '↻ עדכן'}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <SupabaseMetricBubble label="סה״כ" value={results.length ? totals.total : '—'} tone="sky" />
            <SupabaseMetricBubble label="היום" value={results.length ? totals.today : '—'} tone="emerald" />
            <SupabaseMetricBubble label="חדש" value={results.length ? totals.sinceLast : '—'} tone="amber" />
          </div>
          {lastRefreshAt ? (
            <p className="mt-3 text-[11px] font-bold text-slate-400">עודכן: {formatLeadSyncTime(lastRefreshAt)}</p>
          ) : null}
          <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-600 ring-1 ring-slate-100">
            {statusMessage}
          </p>
        </article>
      </div>

      {/* ── Zone 3: Social Accounts ───────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MetaConnectCard settings={settings} onSaveSettings={onSaveSettings} />

        {/* LinkedIn placeholder */}
        <article className="flex flex-col gap-3 rounded-[2rem] bg-white/92 p-5 shadow-soft ring-1 ring-slate-100">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">LinkedIn</p>
            <h2 className="mt-0.5 text-lg font-black text-slate-950">פרופיל עסקי</h2>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
            <p className="text-xs font-black text-slate-500">בקרוב</p>
            <p className="mt-0.5 text-[11px] font-bold text-slate-400">
              אינטגרציית LinkedIn API תגיע בגרסה הבאה — ספירת חיבורים, פוסטים ואנליטיקס.
            </p>
          </div>
        </article>
      </div>

      {/* ── Zone 4: Focus Now / Tasks ─────────────────────────────────────── */}
      {focusNowTask ? (
        <article className="rounded-[2rem] bg-gradient-to-l from-sky-50 to-white p-5 shadow-soft ring-1 ring-sky-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-sky-600">⚡ Focus Now</p>
              <h2 className="mt-1.5 text-xl font-black leading-snug text-slate-950">{focusNowTask.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {focusNowTask.projectId ? (
                  <span className="rounded-xl bg-sky-50 px-2.5 py-1 text-[11px] font-black text-sky-700 ring-1 ring-sky-100">{focusNowTask.projectId}</span>
                ) : null}
                {focusNowTask.scheduledTimeLabel ? (
                  <span className="rounded-xl bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700 ring-1 ring-amber-100">{focusNowTask.scheduledTimeLabel}</span>
                ) : null}
                {focusNowTask.bucket === 'today' ? (
                  <span className="rounded-xl bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100">היום</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => onCompleteTask(focusNowTask.id)} className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-600 active:translate-y-0">✓ סיים</button>
            <button type="button" onClick={() => onJumpToTask(focusNowTask)} className="rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-sky-50 hover:text-sky-800">פתח</button>
          </div>
        </article>
      ) : (
        <article className="rounded-[2rem] bg-white/70 p-5 text-center shadow-soft ring-1 ring-slate-100">
          <p className="text-base font-black text-slate-400">אין משימות לידים פתוחות להיום</p>
          <p className="mt-1 text-xs font-bold text-slate-400">תוסיף משימות עם תגית lead / linkedin / instagram</p>
        </article>
      )}

      {/* Lead tasks list */}
      <article className="rounded-[2rem] bg-white/92 p-5 shadow-soft ring-1 ring-violet-100">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-violet-600">משימות לידים</p>
            <h2 className="mt-0.5 text-lg font-black text-slate-950">פתוחות</h2>
          </div>
          <span className="rounded-2xl bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700 ring-1 ring-violet-100">{openLeadTasks.length} משימות</span>
        </div>
        <ul className="mt-4 space-y-2">
          {topLeadList.length === 0 ? (
            <li className="py-4 text-center text-sm font-bold text-slate-400">אין משימות לידים פתוחות</li>
          ) : (
            topLeadList.map((task) => (
              <li key={task.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3 ring-1 ring-slate-100">
                <button
                  type="button"
                  aria-label="סמן כסיום"
                  onClick={() => onCompleteTask(task.id)}
                  className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-2 ring-slate-300 transition hover:bg-emerald-50 hover:ring-emerald-400 active:bg-emerald-100"
                >
                  <span className="absolute -inset-2" />
                </button>
                <button type="button" onClick={() => onJumpToTask(task)} className="min-w-0 flex-1 text-right">
                  <p className="truncate text-sm font-black text-slate-900">{task.title}</p>
                  {task.projectId ? <p className="truncate text-[11px] font-bold text-slate-400">{task.projectId}</p> : null}
                </button>
                {task.bucket === 'today' ? <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">היום</span> : null}
              </li>
            ))
          )}
        </ul>
      </article>

      {/* ── Content this week strip ────────────────────────────────────────── */}
      {contentTasks.length > 0 ? (
        <div>
          <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-500">תוכן השבוע</p>
          <div className="mission-chip-strip flex gap-3 overflow-x-auto pb-2">
            {contentTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onJumpToTask(task)}
                className="shrink-0 rounded-2xl bg-white px-4 py-3 text-right shadow-soft ring-1 ring-slate-100 transition hover:ring-sky-200"
                style={{ minWidth: '200px', maxWidth: '240px' }}
              >
                <p className="truncate text-sm font-black text-slate-900">{task.title}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  {task.projectId || 'ללא פרויקט'} · {task.bucket === 'today' ? 'היום' : task.bucket === 'weekly' ? 'השבוע' : 'בקלוג'}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

    </section>
  );
}
