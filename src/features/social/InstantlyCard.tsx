import { useState } from 'react';
import type { AppSettings } from '../../domain/settings/settingsTypes';

interface InstantlyStats {
  campaigns: { total: number; active: number; list: { id: string; name: string }[] };
  analytics: { sent: number; opened: number; replied: number; openRate: number; replyRate: number };
  today: { sent: number; opened: number; replied: number; newLeads: number };
  checkedAt: string;
}

function getInstantlyEndpoint(settings: AppSettings | null): string {
  const base = settings?.morningBriefing?.androidPublishEndpoint?.trim() || '/api/morning-briefing';
  if (base.includes('/api/morning-briefing')) return base.replace('/api/morning-briefing', '/api/instantly-stats');
  if (base.includes('/api/sync-state')) return base.replace('/api/sync-state', '/api/instantly-stats');
  if (base.includes('/api/instantly-stats')) return base;
  return '/api/instantly-stats';
}

function formatPct(value: number): string {
  if (!value) return '0%';
  return `${(value * 100).toFixed(1)}%`;
}

interface InstantlyCardProps {
  settings: AppSettings | null;
}

export function InstantlyCard({ settings }: InstantlyCardProps) {
  const [stats, setStats] = useState<InstantlyStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const apiKey = settings?.instantly?.apiKey?.trim();
  const token = settings?.morningBriefing?.androidPublishToken?.trim();

  const refresh = async () => {
    if (!apiKey) { setError('הכנס Instantly.AI API Key בהגדרות > סנכרון, ענן ואבטחה'); return; }
    if (!token) { setError('חסר Token בהגדרות'); return; }
    const endpoint = getInstantlyEndpoint(settings);
    if (endpoint.startsWith('/api/') && typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
      setError('ב-dev אין Cloudflare Functions. צריך deploy.'); return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ instantlyApiKey: apiKey }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setStats(data as InstantlyStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setIsLoading(false);
    }
  };

  if (!apiKey) {
    return (
      <article className="flex flex-col gap-3 rounded-[2rem] bg-white/92 p-5 shadow-soft ring-1 ring-slate-100">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Instantly.AI</p>
          <h2 className="mt-0.5 text-lg font-black text-slate-950">קמפיינים ולידים</h2>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
          <p className="text-xs font-black text-slate-600">הוסף API Key</p>
          <p className="mt-0.5 text-[11px] font-bold text-slate-400">הגדרות → סנכרון, ענן ואבטחה → Instantly.AI API Key</p>
        </div>
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-3 rounded-[2rem] bg-white/92 p-5 shadow-soft ring-1 ring-violet-100">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-violet-600">Instantly.AI</p>
          <h2 className="mt-0.5 text-lg font-black text-slate-950">קמפיינים ולידים</h2>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          className="rounded-2xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-violet-700 disabled:opacity-60"
        >
          {isLoading ? 'טוען...' : '↻ עדכן'}
        </button>
      </div>

      {stats ? (
        <>
          {/* Today row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'נשלחו היום', value: stats.today.sent, color: 'text-violet-700' },
              { label: 'לידים חדשים', value: stats.today.newLeads, color: 'text-emerald-700' },
              { label: 'פתחו', value: stats.today.opened, color: 'text-sky-700' },
              { label: 'ענו', value: stats.today.replied, color: 'text-amber-700' },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl bg-slate-50 px-2 py-2.5 text-center ring-1 ring-slate-100">
                <p className={`text-xl font-black leading-none ${m.color}`}>{m.value}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-400 leading-tight">{m.label}</p>
              </div>
            ))}
          </div>

          {/* 7-day rates */}
          <div className="flex items-center justify-between rounded-2xl bg-violet-50 px-4 py-2.5 ring-1 ring-violet-100">
            <span className="text-xs font-black text-violet-700">7 ימים אחרונים</span>
            <div className="flex gap-4 text-xs font-black">
              <span className="text-slate-700">פתיחות <span className="text-sky-600">{formatPct(stats.analytics.openRate)}</span></span>
              <span className="text-slate-700">תגובות <span className="text-emerald-600">{formatPct(stats.analytics.replyRate)}</span></span>
              <span className="text-slate-700">נשלחו <span className="text-violet-700">{stats.analytics.sent}</span></span>
            </div>
          </div>

          {/* Campaign list */}
          {stats.campaigns.list.length > 0 && (
            <div className="space-y-1">
              {stats.campaigns.list.slice(0, 3).map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                  <span className="truncate text-xs font-bold text-slate-700">{c.name}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500 ring-1 ring-slate-100">
          {error || 'לחץ עדכן לטעינת נתוני הקמפיינים'}
        </div>
      )}

      {error && stats && (
        <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-100">{error}</p>
      )}
    </article>
  );
}
