import { useEffect, useState } from 'react';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import type { SettingsPatch } from '../../domain/settings/settingsService';

interface InstagramProfile {
  username: string;
  followersCount: number;
  mediaCount: number;
  profilePictureUrl: string | null;
}

interface RecentPost {
  id: string;
  type: string;
  caption: string;
  imageUrl: string | null;
  timestamp: string;
  likes: number;
  comments: number;
}

interface InstagramStats {
  profile: InstagramProfile;
  recentMedia: RecentPost[];
  insights: { reach30: number | null; impressions30: number | null };
  checkedAt: string;
}

function getMetaEndpoint(settings: AppSettings | null): string {
  const base = settings?.morningBriefing?.androidPublishEndpoint?.trim() || '/api/morning-briefing';
  if (base.includes('/api/morning-briefing')) return base.replace('/api/morning-briefing', '/api/meta-proxy');
  if (base.includes('/api/sync-state')) return base.replace('/api/sync-state', '/api/meta-proxy');
  if (base.includes('/api/meta-proxy')) return base;
  return '/api/meta-proxy';
}

function buildFbOAuthUrl(appId: string): string {
  const redirectUri = `${window.location.origin}/`;
  const scope = 'instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement';
  return (
    `https://www.facebook.com/v19.0/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code` +
    `&state=meta_connect`
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return 'לפני פחות משעה';
  if (h < 24) return `לפני ${h} שעות`;
  return `לפני ${Math.floor(h / 24)} ימים`;
}

interface MetaConnectCardProps {
  settings: AppSettings | null;
  onSaveSettings: (patch: SettingsPatch) => Promise<void>;
}

export function MetaConnectCard({ settings, onSaveSettings }: MetaConnectCardProps) {
  const [stats, setStats] = useState<InstagramStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExchanging, setIsExchanging] = useState(false);
  const [error, setError] = useState('');

  const token = settings?.morningBriefing?.androidPublishToken?.trim();
  const appId = settings?.meta?.appId?.trim();
  const accessToken = settings?.meta?.accessToken?.trim();
  const instagramUserId = settings?.meta?.instagramUserId?.trim();
  const isConnected = Boolean(accessToken && instagramUserId);
  const isDev = typeof window !== 'undefined' && window.location.hostname === '127.0.0.1';

  // Detect OAuth callback: ?code=...&state=meta_connect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state === 'meta_connect') {
      // Strip params from URL immediately
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
      void exchangeCode(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function exchangeCode(code: string) {
    if (!token) { setError('חסר Token בהגדרות'); return; }
    setIsExchanging(true);
    setError('');
    try {
      const endpoint = getMetaEndpoint(settings);
      const redirectUri = `${window.location.origin}/`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'exchange_code', code, redirectUri }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      await onSaveSettings({
        meta: {
          appId: settings?.meta?.appId,
          accessToken: data.accessToken,
          instagramUserId: data.instagramUserId ?? null,
          facebookPageId: data.facebookPageId ?? null,
          connectedAt: new Date().toISOString(),
          tokenExpiresAt: data.expiresAt ?? null,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בחיבור Meta');
    } finally {
      setIsExchanging(false);
    }
  }

  async function refreshStats() {
    if (!token) { setError('חסר Token'); return; }
    if (!accessToken || !instagramUserId) { setError('לא מחובר — לחץ חבר חשבון'); return; }
    const endpoint = getMetaEndpoint(settings);
    if (endpoint.startsWith('/api/') && isDev) {
      setError('ב-dev אין Cloudflare Functions. צריך deploy.'); return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'instagram_stats', accessToken, instagramUserId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setStats(data as InstagramStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת נתוני Instagram');
    } finally {
      setIsLoading(false);
    }
  }

  function handleConnect() {
    if (!appId) { setError('הוסף Facebook App ID בהגדרות > סנכרון, ענן ואבטחה'); return; }
    if (isDev) { setError('ב-dev OAuth לא עובד (redirect_uri חייב להיות דומיין ציבורי).'); return; }
    window.location.href = buildFbOAuthUrl(appId);
  }

  async function handleDisconnect() {
    await onSaveSettings({ meta: { appId: settings?.meta?.appId, accessToken: undefined, instagramUserId: undefined, facebookPageId: undefined, connectedAt: null, tokenExpiresAt: null } });
    setStats(null);
    setError('');
  }

  if (isExchanging) {
    return (
      <article className="flex flex-col gap-3 rounded-[2rem] bg-white/92 p-5 shadow-soft ring-1 ring-pink-100">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-pink-600">Instagram</p>
          <h2 className="mt-0.5 text-lg font-black text-slate-950">מחבר חשבון...</h2>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-pink-50 px-4 py-3 ring-1 ring-pink-100">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-pink-300 border-t-pink-600" />
          <p className="text-xs font-black text-pink-700">מחליף קוד אוטומטי...</p>
        </div>
      </article>
    );
  }

  if (!appId) {
    return (
      <article className="flex flex-col gap-3 rounded-[2rem] bg-white/92 p-5 shadow-soft ring-1 ring-slate-100">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Instagram / Facebook</p>
          <h2 className="mt-0.5 text-lg font-black text-slate-950">חשבון סושיאל</h2>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
          <p className="text-xs font-black text-slate-600">הוסף Facebook App ID</p>
          <p className="mt-0.5 text-[11px] font-bold text-slate-400">הגדרות → סנכרון, ענן ואבטחה → Meta / Facebook App ID</p>
        </div>
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-3 rounded-[2rem] bg-white/92 p-5 shadow-soft ring-1 ring-pink-100">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-pink-600">Instagram</p>
          <h2 className="mt-0.5 text-lg font-black text-slate-950">
            {isConnected ? (stats?.profile.username ? `@${stats.profile.username}` : 'מחובר') : 'חשבון סושיאל'}
          </h2>
        </div>
        <div className="flex gap-2">
          {isConnected ? (
            <>
              <button
                type="button"
                onClick={() => void refreshStats()}
                disabled={isLoading}
                className="rounded-2xl bg-pink-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-pink-700 disabled:opacity-60"
              >
                {isLoading ? 'טוען...' : '↻ עדכן'}
              </button>
              <button
                type="button"
                onClick={() => void handleDisconnect()}
                className="rounded-2xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-500 transition hover:bg-slate-200"
              >
                נתק
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              className="rounded-2xl bg-gradient-to-l from-pink-600 to-violet-600 px-4 py-2 text-xs font-black text-white transition hover:opacity-90"
            >
              חבר חשבון
            </button>
          )}
        </div>
      </div>

      {stats ? (
        <>
          {/* Profile metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-pink-50 px-2 py-2.5 text-center ring-1 ring-pink-100">
              <p className="text-xl font-black leading-none text-pink-700">
                {stats.profile.followersCount >= 1000
                  ? `${(stats.profile.followersCount / 1000).toFixed(1)}K`
                  : stats.profile.followersCount}
              </p>
              <p className="mt-1 text-[10px] font-bold text-slate-400 leading-tight">עוקבים</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-2 py-2.5 text-center ring-1 ring-slate-100">
              <p className="text-xl font-black leading-none text-slate-700">{stats.profile.mediaCount}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-400 leading-tight">פוסטים</p>
            </div>
            <div className="rounded-2xl bg-violet-50 px-2 py-2.5 text-center ring-1 ring-violet-100">
              <p className="text-xl font-black leading-none text-violet-700">
                {stats.insights.reach30 != null
                  ? stats.insights.reach30 >= 1000
                    ? `${(stats.insights.reach30 / 1000).toFixed(1)}K`
                    : stats.insights.reach30
                  : '—'}
              </p>
              <p className="mt-1 text-[10px] font-bold text-slate-400 leading-tight">reach 30 יום</p>
            </div>
          </div>

          {/* Recent posts */}
          {stats.recentMedia.length > 0 && (
            <div className="space-y-1">
              {stats.recentMedia.slice(0, 3).map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100"
                >
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-100 text-lg">
                      {post.type === 'VIDEO' ? '▶' : '📷'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-700">
                      {post.caption || '(ללא כיתוב)'}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400">
                      {post.likes} ♥ · {post.comments} 💬 · {formatRelativeTime(post.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : isConnected ? (
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500 ring-1 ring-slate-100">
          {error || 'לחץ עדכן לטעינת הנתונים'}
        </div>
      ) : (
        <div className="rounded-2xl bg-pink-50 px-4 py-3 ring-1 ring-pink-100">
          <p className="text-xs font-black text-pink-700">לא מחובר</p>
          <p className="mt-0.5 text-[11px] font-bold text-pink-500">
            לחץ "חבר חשבון" לחיבור Instagram Business דרך Facebook Login
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 ring-1 ring-red-100">
          {error}
        </p>
      )}
    </article>
  );
}
