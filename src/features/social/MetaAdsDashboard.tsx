import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppSettings } from '../../domain/settings/settingsTypes';

interface MetaAdsDashboardProps {
  settings: AppSettings | null;
}

interface InsightRow {
  campaignId: string | null;
  campaignName: string;
  adsetName: string | null;
  adName: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number;
  ctr: number;
  cpc: number;
  cpm: number;
  purchases: number;
  leads: number;
  revenue: number;
  roas: number | null;
  costPerPurchase: number | null;
  costPerLead: number | null;
}

const DATE_PRESETS: Array<{ id: string; label: string }> = [
  { id: 'today', label: 'היום' },
  { id: 'yesterday', label: 'אתמול' },
  { id: 'last_7d', label: '7 ימים' },
  { id: 'last_30d', label: '30 ימים' },
  { id: 'this_month', label: 'החודש' },
  { id: 'last_month', label: 'חודש שעבר' },
];

const LEVELS: Array<{ id: string; label: string }> = [
  { id: 'campaign', label: 'קמפיין' },
  { id: 'adset', label: 'קבוצת מודעות' },
  { id: 'ad', label: 'מודעה' },
];

function money(value: number, currency = 'USD') {
  const symbol = currency === 'ILS' ? '₪' : '$';
  return `${symbol}${value.toLocaleString('en-US', { maximumFractionDigits: value < 100 ? 2 : 0 })}`;
}

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

export function MetaAdsDashboard({ settings }: MetaAdsDashboardProps) {
  const [rows, setRows] = useState<InsightRow[]>([]);
  const [datePreset, setDatePreset] = useState('last_7d');
  const [level, setLevel] = useState('campaign');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState('');

  const cloudToken = settings?.morningBriefing?.androidPublishToken?.trim() ?? '';
  const accessToken = settings?.meta?.accessToken?.trim() ?? '';
  const adAccountId = settings?.meta?.adAccountId?.trim() ?? '';
  const ready = Boolean(cloudToken && accessToken && adAccountId);

  const load = useCallback(async () => {
    if (!ready) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/meta-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cloudToken}` },
        body: JSON.stringify({ action: 'ads_insights', accessToken, adAccountId, datePreset, level }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setError(data?.error ?? `שגיאה ${response.status}`);
        setRows([]);
        return;
      }
      setRows(data.rows ?? []);
      setCheckedAt(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה לא ידועה');
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, adAccountId, cloudToken, datePreset, level, ready]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const base = rows.reduce(
      (acc, row) => ({
        spend: acc.spend + row.spend,
        impressions: acc.impressions + row.impressions,
        clicks: acc.clicks + row.clicks,
        purchases: acc.purchases + row.purchases,
        leads: acc.leads + row.leads,
        revenue: acc.revenue + row.revenue,
      }),
      { spend: 0, impressions: 0, clicks: 0, purchases: 0, leads: 0, revenue: 0 },
    );
    const results = base.purchases || base.leads;
    return {
      ...base,
      ctr: base.impressions > 0 ? (base.clicks / base.impressions) * 100 : 0,
      cpc: base.clicks > 0 ? base.spend / base.clicks : 0,
      cpm: base.impressions > 0 ? (base.spend / base.impressions) * 1000 : 0,
      costPerResult: results > 0 ? base.spend / results : null,
      roas: base.spend > 0 && base.revenue > 0 ? base.revenue / base.spend : null,
      results,
    };
  }, [rows]);

  // Ranked by cost per result — the cheapest result is what is working
  const ranked = useMemo(() => {
    const withResults = rows.filter((r) => (r.purchases || r.leads) > 0);
    const noResults = rows.filter((r) => (r.purchases || r.leads) === 0 && r.spend > 0);
    const costOf = (r: InsightRow) => r.spend / (r.purchases || r.leads);
    return {
      best: [...withResults].sort((a, b) => costOf(a) - costOf(b)).slice(0, 3),
      wasting: [...noResults].sort((a, b) => b.spend - a.spend).slice(0, 3),
    };
  }, [rows]);

  const sorted = useMemo(() => [...rows].sort((a, b) => b.spend - a.spend), [rows]);

  if (!ready) {
    return (
      <div className="rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200">
        <h3 className="text-base font-black text-amber-900">חסר חיבור ל-Meta Ads</h3>
        <ul className="mt-2 space-y-1 text-sm font-bold text-amber-800">
          {!cloudToken ? <li>· חסר Cloud Token בהגדרות</li> : null}
          {!accessToken ? <li>· מטא לא מחוברת — חבר דרך כרטיס החיבור</li> : null}
          {!adAccountId ? <li>· חסר Ad Account ID — הגדרות → API / Cloud / Tokens</li> : null}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-2xl bg-slate-100 p-1">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setDatePreset(preset.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                datePreset === preset.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <select
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800 outline-none focus:border-sky-300"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          {LEVELS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>

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

      {/* Spend + efficiency */}
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="הוצאה" value={money(totals.spend)} tone="dark" />
        <Metric label="חשיפות" value={compact(totals.impressions)} />
        <Metric label="קליקים" value={compact(totals.clicks)} />
        <Metric label="CTR" value={`${totals.ctr.toFixed(2)}%`} />
        <Metric label="CPC" value={money(totals.cpc)} />
        <Metric label="CPM" value={money(totals.cpm)} />
      </div>

      {/* Conversions */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="לידים" value={compact(totals.leads)} tone="sky" />
        <Metric label="רכישות" value={compact(totals.purchases)} tone="sky" />
        <Metric
          label="עלות לתוצאה"
          value={totals.costPerResult !== null ? money(totals.costPerResult) : '—'}
          tone={totals.costPerResult !== null ? 'emerald' : 'muted'}
        />
        <Metric
          label="ROAS"
          value={totals.roas !== null ? `${totals.roas.toFixed(2)}x` : '—'}
          tone={totals.roas === null ? 'muted' : totals.roas >= 1 ? 'emerald' : 'rose'}
          hint={totals.roas === null ? 'הפיקסל לא מדווח ערך רכישה' : undefined}
        />
      </div>

      {/* What works / what does not */}
      {rows.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
            <h4 className="text-sm font-black text-emerald-900">מה עובד · הזול ביותר לתוצאה</h4>
            {ranked.best.length === 0 ? (
              <p className="mt-2 text-xs font-bold text-emerald-700">אין עדיין תוצאות בטווח הזה.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {ranked.best.map((row) => {
                  const results = row.purchases || row.leads;
                  return (
                    <li key={`${row.campaignId}-${row.adName}`} className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-900">
                      <span className="truncate">{row.campaignName}</span>
                      <span className="shrink-0 tabular-nums" dir="ltr">{money(row.spend / results)} × {results}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-3xl bg-rose-50 p-4 ring-1 ring-rose-200">
            <h4 className="text-sm font-black text-rose-900">מה לא עובד · הוצאה בלי תוצאה</h4>
            {ranked.wasting.length === 0 ? (
              <p className="mt-2 text-xs font-bold text-rose-700">כל מה שרץ מביא תוצאות.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {ranked.wasting.map((row) => (
                  <li key={`${row.campaignId}-${row.adName}`} className="flex items-center justify-between gap-2 text-xs font-bold text-rose-900">
                    <span className="truncate">{row.campaignName}</span>
                    <span className="shrink-0 tabular-nums" dir="ltr">{money(row.spend)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {/* Full table */}
      {sorted.length === 0 ? (
        !isLoading && !error ? <p className="text-sm font-bold text-slate-500">אין נתונים בטווח שנבחר.</p> : null
      ) : (
        <div className="overflow-x-auto rounded-3xl bg-white p-2 ring-1 ring-slate-200">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="text-[11px] font-black text-slate-500">
                <th className="py-2 text-right">{LEVELS.find((l) => l.id === level)?.label}</th>
                <th className="py-2 text-left">הוצאה</th>
                <th className="py-2 text-left">חשיפות</th>
                <th className="py-2 text-left">CTR</th>
                <th className="py-2 text-left">CPC</th>
                <th className="py-2 text-left">תוצאות</th>
                <th className="py-2 text-left">עלות לתוצאה</th>
                <th className="py-2 text-left">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, index) => {
                const results = row.purchases || row.leads;
                const costPerResult = results > 0 ? row.spend / results : null;
                return (
                  <tr key={`${row.campaignId}-${row.adName}-${index}`} className="border-t border-slate-100">
                    <td className="max-w-64 py-2 pl-2">
                      <p className="truncate font-black text-slate-900">{row.campaignName}</p>
                      {level !== 'campaign' && row.adsetName ? (
                        <p className="truncate text-[11px] font-bold text-slate-400">{row.adsetName}</p>
                      ) : null}
                    </td>
                    <td className="py-2 text-left font-black tabular-nums text-slate-900" dir="ltr">{money(row.spend)}</td>
                    <td className="py-2 text-left font-bold tabular-nums text-slate-500" dir="ltr">{compact(row.impressions)}</td>
                    <td className="py-2 text-left font-bold tabular-nums text-slate-500" dir="ltr">{row.ctr.toFixed(2)}%</td>
                    <td className="py-2 text-left font-bold tabular-nums text-slate-500" dir="ltr">{money(row.cpc)}</td>
                    <td className="py-2 text-left font-black tabular-nums text-slate-700" dir="ltr">{results || '—'}</td>
                    <td className={`py-2 text-left font-black tabular-nums ${costPerResult === null ? 'text-slate-300' : 'text-slate-900'}`} dir="ltr">
                      {costPerResult !== null ? money(costPerResult) : '—'}
                    </td>
                    <td className={`py-2 text-left font-black tabular-nums ${
                      row.roas === null ? 'text-slate-300' : row.roas >= 1 ? 'text-emerald-600' : 'text-rose-600'
                    }`} dir="ltr">
                      {row.roas !== null ? `${row.roas.toFixed(2)}x` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'plain',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'plain' | 'dark' | 'sky' | 'emerald' | 'rose' | 'muted';
  hint?: string;
}) {
  const toneClass = {
    plain: 'bg-white text-slate-900 ring-slate-200',
    dark: 'bg-slate-950 text-white ring-slate-950',
    sky: 'bg-sky-50 text-sky-900 ring-sky-200',
    emerald: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    rose: 'bg-rose-50 text-rose-900 ring-rose-200',
    muted: 'bg-slate-50 text-slate-400 ring-slate-200',
  }[tone];
  return (
    <div className={`rounded-2xl px-3 py-2.5 ring-1 ${toneClass}`} title={hint}>
      <p className="text-[10px] font-black opacity-60">{label}</p>
      <p className="mt-0.5 text-lg font-black tabular-nums" dir="ltr">{value}</p>
    </div>
  );
}
