import { useCallback, useEffect, useState } from 'react';
import type { AppSettings } from '../../domain/settings/settingsTypes';

interface PixelEventsPanelProps {
  settings: AppSettings | null;
}

interface PixelInfo {
  id: string;
  name: string;
  lastFiredTime: string | null;
  unavailable: boolean;
}

/** Events that matter for the ads dashboard to be able to show cost per result */
const KEY_EVENTS = ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Lead', 'Purchase'];

export function PixelEventsPanel({ settings }: PixelEventsPanelProps) {
  const [pixel, setPixel] = useState<PixelInfo | null>(null);
  const [events, setEvents] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState('');

  const cloudToken = settings?.morningBriefing?.androidPublishToken?.trim() ?? '';
  const accessToken = settings?.meta?.accessToken?.trim() ?? '';
  const pixelId = settings?.meta?.pixelId?.trim() ?? '';
  const ready = Boolean(cloudToken && accessToken && pixelId);

  const load = useCallback(async () => {
    if (!ready) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/meta-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cloudToken}` },
        body: JSON.stringify({ action: 'pixel_stats', accessToken, pixelId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? `שגיאה ${response.status}`);
        setPixel(null);
        return;
      }
      setPixel(data.pixel ?? null);
      setEvents(data.events ?? {});
      setCheckedAt(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, cloudToken, pixelId, ready]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) {
    return (
      <div className="rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200">
        <h3 className="text-base font-black text-amber-900">חסר חיבור לפיקסל</h3>
        <ul className="mt-2 space-y-1 text-sm font-bold text-amber-800">
          {!cloudToken ? <li>· חסר Cloud Token בהגדרות</li> : null}
          {!accessToken ? <li>· מטא לא מחוברת</li> : null}
          {!pixelId ? <li>· חסר Pixel ID — הגדרות → API / Cloud / Tokens</li> : null}
        </ul>
      </div>
    );
  }

  const seen = Object.keys(events);
  const extras = seen.filter((name) => !KEY_EVENTS.includes(name));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-50"
          disabled={isLoading}
          onClick={() => void load()}
        >
          {isLoading ? 'טוען...' : '↻ רענן'}
        </button>
        {checkedAt ? <span className="text-[11px] font-bold text-slate-400">עודכן {checkedAt}</span> : null}
      </div>

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 ring-1 ring-rose-200">{error}</p>
      ) : null}

      {pixel ? (
        <div className={`rounded-3xl p-4 ring-1 ${pixel.unavailable ? 'bg-rose-50 ring-rose-200' : 'bg-white ring-slate-200'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-base font-black text-slate-950">{pixel.name || 'פיקסל'}</p>
              <p className="text-[11px] font-bold text-slate-400" dir="ltr">{pixel.id}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${
              pixel.unavailable ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
            }`}>
              {pixel.unavailable ? 'לא זמין' : 'פעיל'}
            </span>
          </div>
          {pixel.lastFiredTime ? (
            <p className="mt-2 text-xs font-bold text-slate-500">
              אירוע אחרון התקבל: {new Date(pixel.lastFiredTime).toLocaleString('he-IL')}
            </p>
          ) : (
            <p className="mt-2 text-xs font-black text-amber-700">הפיקסל לא דיווח אף אירוע — בדוק שההטמעה באתר פעילה.</p>
          )}
        </div>
      ) : null}

      <div>
        <h4 className="mb-2 text-sm font-black text-slate-700">אירועים מרכזיים</h4>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {KEY_EVENTS.map((name) => {
            const count = events[name] ?? 0;
            const live = count > 0;
            return (
              <div
                key={name}
                className={`rounded-2xl px-3 py-2.5 ring-1 ${live ? 'bg-white text-slate-900 ring-slate-200' : 'bg-slate-50 text-slate-400 ring-slate-200'}`}
              >
                <p className="truncate text-[10px] font-black opacity-70" dir="ltr">{name}</p>
                <p className="mt-0.5 text-lg font-black tabular-nums" dir="ltr">{live ? count.toLocaleString() : '—'}</p>
              </div>
            );
          })}
        </div>
        {!events.Purchase ? (
          <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
            אין אירועי Purchase — בלעדיהם הדשבורד לא יוכל להציג ROAS.
          </p>
        ) : null}
      </div>

      {extras.length > 0 ? (
        <div>
          <h4 className="mb-2 text-sm font-black text-slate-700">אירועים נוספים</h4>
          <div className="flex flex-wrap gap-2">
            {extras.map((name) => (
              <span key={name} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600" dir="ltr">
                {name} · {events[name].toLocaleString()}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
