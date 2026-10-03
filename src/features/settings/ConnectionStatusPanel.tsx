import { useCallback, useEffect, useState } from 'react';
import {
  ALL_CONNECTIONS,
  checkConnection,
  type ConnectionId,
  type ConnectionResult,
  type ConnectionState,
} from '../../domain/integrations/connectionChecks';
import type { AppSettings } from '../../domain/settings/settingsTypes';

interface ConnectionStatusPanelProps {
  settings: AppSettings | null;
}

const STATE_STYLE: Record<ConnectionState, { ring: string; chip: string; icon: string; label: string }> = {
  ok: { ring: 'ring-emerald-200 bg-emerald-50', chip: 'bg-emerald-600 text-white', icon: '✓', label: 'עובד' },
  error: { ring: 'ring-rose-200 bg-rose-50', chip: 'bg-rose-600 text-white', icon: '✕', label: 'תקלה' },
  empty: { ring: 'ring-amber-200 bg-amber-50', chip: 'bg-amber-400 text-amber-950', icon: '–', label: 'ריק' },
  checking: { ring: 'ring-slate-200 bg-white', chip: 'bg-slate-300 text-slate-700', icon: '⋯', label: 'בודק' },
};

export function ConnectionStatusPanel({ settings }: ConnectionStatusPanelProps) {
  const [results, setResults] = useState<Record<string, ConnectionResult>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [lastRun, setLastRun] = useState<string>('');

  const runAll = useCallback(async () => {
    if (!settings) return;
    setIsChecking(true);
    setResults((current) => {
      const next = { ...current };
      for (const id of ALL_CONNECTIONS) {
        next[id] = { id, label: next[id]?.label ?? id, state: 'checking' };
      }
      return next;
    });

    // Sequential on purpose — several checks share the same Worker and a
    // parallel burst just produces timeouts.
    for (const id of ALL_CONNECTIONS) {
      const result = await checkConnection(id as ConnectionId, settings);
      setResults((current) => ({ ...current, [result.id]: result }));
    }

    setIsChecking(false);
    setLastRun(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
  }, [settings]);

  useEffect(() => {
    void runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = ALL_CONNECTIONS.map((id) => results[id]).filter(Boolean);
  const okCount = list.filter((r) => r.state === 'ok').length;
  const errorCount = list.filter((r) => r.state === 'error').length;
  const emptyCount = list.filter((r) => r.state === 'empty').length;

  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-black text-slate-950">מצב חיבורים</h3>
          <p className="text-xs font-bold text-slate-500">
            כל בדיקה פונה לשירות עצמו — ירוק רק אם התשובה חזרה תקינה.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {list.length ? (
            <span className="flex gap-1 text-[11px] font-black">
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 ring-1 ring-emerald-200">{okCount} ✓</span>
              {errorCount ? <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-700 ring-1 ring-rose-200">{errorCount} ✕</span> : null}
              {emptyCount ? <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800 ring-1 ring-amber-200">{emptyCount} –</span> : null}
            </span>
          ) : null}
          <button
            type="button"
            className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:bg-slate-800 disabled:opacity-50"
            disabled={isChecking || !settings}
            onClick={() => void runAll()}
          >
            {isChecking ? 'בודק...' : 'בדוק הכל'}
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((result) => {
          const style = STATE_STYLE[result.state];
          return (
            <div key={result.id} className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-2 ring-1 ${style.ring}`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{result.label}</p>
                {result.detail ? <p className="truncate text-[11px] font-bold text-slate-500">{result.detail}</p> : null}
              </div>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black ${style.chip}`} title={style.label}>
                {style.icon}
              </span>
            </div>
          );
        })}
      </div>

      {lastRun ? <p className="mt-3 text-[11px] font-bold text-slate-400">נבדק לאחרונה {lastRun}</p> : null}
    </div>
  );
}
