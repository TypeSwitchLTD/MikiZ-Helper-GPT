import { useEffect, useMemo, useState } from 'react';
import { SectionCard } from '../../components/layout/SectionCard';
import {
  buildCostingFromProfile,
  calculateBreakdown,
  cloneCostingForActual,
  getKitUnitCost,
} from '../../domain/sales/costing';
import { getUsdToIlsRate, type ExchangeRate } from '../../domain/sales/exchangeRate';
import type {
  CostProfile,
  CostingPhase,
  OrderCosting,
  Product,
  SalesOrder,
} from '../../domain/sales/salesTypes';

interface ProfitabilityPanelProps {
  orders: SalesOrder[];
  products: Product[];
  costProfiles: CostProfile[];
  orderCostings: OrderCosting[];
  isSaving?: boolean;
  onAddOrderCosting: (input: Omit<OrderCosting, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => Promise<OrderCosting>;
  onEditOrderCosting: (costingId: string, patch: Partial<OrderCosting>) => Promise<void>;
}

interface Draft {
  quantity: string;
  unitPrice: string;
  destination: string;
  shippingTotal: string;
  customStickerUnitCost: string;
  customsTotal: string;
  personalizationTotal: string;
  discountTotal: string;
  notes: string;
}

const emptyDraft: Draft = {
  quantity: '1',
  unitPrice: '',
  destination: '',
  shippingTotal: '0',
  customStickerUnitCost: '0',
  customsTotal: '0',
  personalizationTotal: '0',
  discountTotal: '0',
  notes: '',
};

function inputClass(extra = '') {
  return `rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100 ${extra}`;
}

function money(value: number, currency = 'USD') {
  const symbol = currency === 'USD' ? '$' : currency === 'ILS' ? '₪' : `${currency} `;
  const rounded = Math.abs(value) < 0.01 ? 0 : value;
  return `${rounded < 0 ? '-' : ''}${symbol}${Math.abs(rounded).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Keeps the minus sign in front of the symbol: -₪181, not ₪-181 */
function formatIls(value: number) {
  const rounded = Math.round(value);
  return `${rounded < 0 ? '-' : ''}₪${Math.abs(rounded).toLocaleString('en-US')}`;
}

function draftFromCosting(costing: OrderCosting): Draft {
  return {
    quantity: String(costing.quantity),
    unitPrice: String(costing.unitPrice),
    destination: costing.destination ?? '',
    shippingTotal: String(costing.shippingTotal),
    customStickerUnitCost: String(costing.customStickerUnitCost),
    customsTotal: String(costing.customsTotal),
    personalizationTotal: String(costing.personalizationTotal),
    discountTotal: String(costing.discountTotal),
    notes: costing.notes ?? '',
  };
}

function num(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ProfitabilityPanel({
  orders,
  products,
  costProfiles,
  orderCostings,
  isSaving,
  onAddOrderCosting,
  onEditOrderCosting,
}: ProfitabilityPanelProps) {
  const visibleOrders = orders.filter((order) => !order.deletedAt && order.status !== 'cancelled');
  const [selectedOrderId, setSelectedOrderId] = useState(visibleOrders[0]?.id ?? '');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '');
  const [phase, setPhase] = useState<CostingPhase>('planned');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState('');
  const [fx, setFx] = useState<ExchangeRate | null>(null);

  // USD→ILS, refreshed at most once a week (cached in localStorage)
  useEffect(() => {
    let cancelled = false;
    void getUsdToIlsRate().then((rate) => {
      if (!cancelled) setFx(rate);
    });
    return () => { cancelled = true; };
  }, []);

  const activeProfile = useMemo(
    () => costProfiles.find((profile) => profile.productId === selectedProductId && profile.active && !profile.deletedAt) ?? null,
    [costProfiles, selectedProductId],
  );

  const plannedCosting = useMemo(
    () => orderCostings.find((costing) => costing.orderId === selectedOrderId && costing.phase === 'planned' && !costing.deletedAt) ?? null,
    [orderCostings, selectedOrderId],
  );

  const actualCosting = useMemo(
    () => orderCostings.find((costing) => costing.orderId === selectedOrderId && costing.phase === 'actual' && !costing.deletedAt) ?? null,
    [orderCostings, selectedOrderId],
  );

  const currentCosting = phase === 'planned' ? plannedCosting : actualCosting;

  // Load the stored costing into the draft whenever the order or phase changes
  useEffect(() => {
    if (currentCosting) {
      setDraft(draftFromCosting(currentCosting));
      setSelectedProductId(currentCosting.productId);
    } else {
      setDraft(emptyDraft);
    }
  }, [currentCosting]);

  // Live preview object — the stored costing with the draft values applied
  const preview = useMemo<OrderCosting | null>(() => {
    const base = currentCosting ?? (activeProfile
      ? { ...buildCostingFromProfile(activeProfile, { orderId: selectedOrderId, productId: selectedProductId, phase, quantity: 1, unitPrice: 0 }), id: 'preview', createdAt: '', updatedAt: '' }
      : null);
    if (!base) return null;
    return {
      ...base,
      quantity: num(draft.quantity),
      unitPrice: num(draft.unitPrice),
      shippingTotal: num(draft.shippingTotal),
      customStickerUnitCost: num(draft.customStickerUnitCost),
      customsTotal: num(draft.customsTotal),
      personalizationTotal: num(draft.personalizationTotal),
      discountTotal: num(draft.discountTotal),
      destination: draft.destination || undefined,
      notes: draft.notes || undefined,
    } as OrderCosting;
  }, [activeProfile, currentCosting, draft, phase, selectedOrderId, selectedProductId]);

  const breakdown = preview ? calculateBreakdown(preview) : null;
  const currency = activeProfile?.currency ?? 'USD';
  const kitUnitCost = activeProfile ? getKitUnitCost(activeProfile.components) : 0;

  // A saved costing keeps the rate it was closed at; a fresh one uses today's
  const effectiveRate = currentCosting?.exchangeRateILS ?? fx?.rate ?? null;
  const showIls = currency === 'USD' && Boolean(effectiveRate);
  const ils = (usd: number) => (effectiveRate ? formatIls(usd * effectiveRate) : '');

  async function saveCosting() {
    if (!activeProfile) return setMessage('אין מחירון למוצר הזה.');
    if (!selectedOrderId) return setMessage('בחר הזמנה.');

    const payload = {
      quantity: num(draft.quantity),
      unitPrice: num(draft.unitPrice),
      shippingTotal: num(draft.shippingTotal),
      customStickerUnitCost: num(draft.customStickerUnitCost),
      customsTotal: num(draft.customsTotal),
      personalizationTotal: num(draft.personalizationTotal),
      discountTotal: num(draft.discountTotal),
      destination: draft.destination || undefined,
      notes: draft.notes || undefined,
      exchangeRateILS: fx?.rate ?? null,
    };

    if (currentCosting) {
      await onEditOrderCosting(currentCosting.id, payload);
      setMessage(phase === 'planned' ? 'הצעה עודכנה.' : 'סגירה עודכנה.');
      return;
    }

    await onAddOrderCosting({
      ...buildCostingFromProfile(activeProfile, {
        orderId: selectedOrderId,
        productId: selectedProductId,
        phase,
        quantity: payload.quantity,
        unitPrice: payload.unitPrice,
        destination: payload.destination,
      }),
      ...payload,
    });
    setMessage(phase === 'planned' ? 'הצעה נשמרה.' : 'סגירה נשמרה.');
  }

  /** Re-snapshot the price book onto an existing planned costing */
  async function refreshPriceBook() {
    if (!currentCosting || !activeProfile) return;
    await onEditOrderCosting(currentCosting.id, {
      components: activeProfile.components.map((component) => ({ ...component })),
      fees: activeProfile.fees.map((fee) => ({ ...fee })),
      currency: activeProfile.currency,
    });
    setMessage('המחירון עודכן למחירים הנוכחיים.');
  }

  async function closeSale() {
    if (!plannedCosting) return setMessage('צור הצעה קודם.');
    if (actualCosting) {
      setPhase('actual');
      return;
    }
    await onAddOrderCosting(cloneCostingForActual(plannedCosting));
    setPhase('actual');
    setMessage('נפתחה סגירת מכירה עם הנתונים המתוכננים. עדכן מה שהשתנה בפועל.');
  }

  function pickDestination(destination: string) {
    const estimate = activeProfile?.shippingEstimates.find((entry) => entry.destination === destination);
    setDraft((current) => ({ ...current, destination, shippingTotal: estimate ? String(estimate.cost) : current.shippingTotal }));
  }

  const plannedBreakdown = plannedCosting ? calculateBreakdown(plannedCosting) : null;
  const actualBreakdown = actualCosting ? calculateBreakdown(actualCosting) : null;
  // The closing rate is what the sale actually settled at
  const comparisonRate = currency === 'USD' ? (actualCosting?.exchangeRateILS ?? fx?.rate ?? null) : null;

  return (
    <div className="space-y-5">
      {/* ── Costing form ────────────────────────────────────────────────────── */}
      <SectionCard
        title={phase === 'planned' ? 'רווחיות — הצעה' : 'רווחיות — סגירת מכירה'}
        description={phase === 'planned' ? 'תכנון לפני המכירה. אפשר לעדכן לאורך זמן.' : 'העלויות שיצאו בפועל.'}
      >
        <div className="flex flex-wrap items-center gap-2">
          <select className={inputClass('min-w-52')} value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)}>
            <option value="">בחר הזמנה</option>
            {visibleOrders.map((order) => <option key={order.id} value={order.id}>{order.title}</option>)}
          </select>

          <select className={inputClass()} value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
            <option value="">בחר מוצר</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>

          {activeProfile ? (
            <span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
              ערכה <span className="tabular-nums text-slate-900" dir="ltr">{money(kitUnitCost, currency)}</span> ליחידה
            </span>
          ) : null}

          <div className="flex rounded-2xl bg-slate-100 p-1">
            <button type="button" onClick={() => setPhase('planned')} className={`rounded-xl px-4 py-1.5 text-sm font-black transition ${phase === 'planned' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>
              הצעה {plannedCosting ? '✓' : ''}
            </button>
            <button type="button" onClick={() => setPhase('actual')} className={`rounded-xl px-4 py-1.5 text-sm font-black transition ${phase === 'actual' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>
              סגירה {actualCosting ? '✓' : ''}
            </button>
          </div>
        </div>

        {!activeProfile ? (
          <p className="mt-4 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 ring-1 ring-amber-100">
            אין מחירון למוצר הזה. גלול למטה ל<strong>מחירון</strong> כדי ליצור אותו.
          </p>
        ) : !selectedOrderId ? (
          <p className="mt-4 text-sm font-bold text-slate-500">בחר הזמנה כדי להתחיל.</p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            {/* Inputs */}
            <div className="grid gap-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-black text-slate-500">כמות</span>
                  <input className={inputClass('text-left tabular-nums')} dir="ltr" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-black text-slate-500">מחיר מכירה ליחידה</span>
                  <input className={inputClass('text-left tabular-nums')} dir="ltr" value={draft.unitPrice} onChange={(e) => setDraft({ ...draft, unitPrice: e.target.value })} />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-black text-slate-500">יעד</span>
                  <select className={inputClass()} value={draft.destination} onChange={(e) => pickDestination(e.target.value)}>
                    <option value="">ללא</option>
                    {activeProfile.shippingEstimates.map((estimate) => <option key={estimate.id} value={estimate.destination}>{estimate.destination}</option>)}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-black text-slate-500">שילוח להזמנה</span>
                  <input className={inputClass('text-left tabular-nums')} dir="ltr" value={draft.shippingTotal} onChange={(e) => setDraft({ ...draft, shippingTotal: e.target.value })} />
                </label>
              </div>

              <p className="mt-1 text-xs font-black text-slate-500">עלויות נוספות (השאר 0 אם לא רלוונטי)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-slate-500">מדבקה מותאמת ליחידה</span>
                  <input className={inputClass('text-left tabular-nums')} dir="ltr" value={draft.customStickerUnitCost} onChange={(e) => setDraft({ ...draft, customStickerUnitCost: e.target.value })} />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-slate-500">מכס</span>
                  <input className={inputClass('text-left tabular-nums')} dir="ltr" value={draft.customsTotal} onChange={(e) => setDraft({ ...draft, customsTotal: e.target.value })} />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-slate-500">התאמה אישית</span>
                  <input className={inputClass('text-left tabular-nums')} dir="ltr" value={draft.personalizationTotal} onChange={(e) => setDraft({ ...draft, personalizationTotal: e.target.value })} />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-slate-500">הנחה</span>
                  <input className={inputClass('text-left tabular-nums')} dir="ltr" value={draft.discountTotal} onChange={(e) => setDraft({ ...draft, discountTotal: e.target.value })} />
                </label>
              </div>

              <textarea className={inputClass('min-h-16')} placeholder="הערות" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />

              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50" disabled={isSaving} onClick={() => void saveCosting()}>
                  {currentCosting ? 'עדכן' : 'שמור'}
                </button>
                {currentCosting && phase === 'planned' ? (
                  <button type="button" className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50" disabled={isSaving} onClick={() => void refreshPriceBook()}>
                    רענן מחירון
                  </button>
                ) : null}
                {plannedCosting ? (
                  <button type="button" className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50" disabled={isSaving} onClick={() => void closeSale()}>
                    {actualCosting ? 'עבור לסגירה' : 'סגור מכירה'}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Live result */}
            {breakdown ? (
              <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <table className="w-full text-sm">
                  <tbody className="font-bold text-slate-700">
                    <tr><td className="py-1">הכנסה</td><td className="py-1 text-left tabular-nums" dir="ltr">{money(breakdown.revenue, currency)}</td></tr>
                    {breakdown.discountTotal ? <tr className="text-rose-700"><td className="py-1">הנחה</td><td className="py-1 text-left tabular-nums" dir="ltr">-{money(breakdown.discountTotal, currency)}</td></tr> : null}
                    <tr className="border-t border-slate-200 text-slate-500"><td className="py-1">ערכה × {num(draft.quantity)}</td><td className="py-1 text-left tabular-nums" dir="ltr">-{money(breakdown.kitTotal, currency)}</td></tr>
                    {breakdown.customStickerTotal ? <tr className="text-slate-500"><td className="py-1">מדבקה מותאמת</td><td className="py-1 text-left tabular-nums" dir="ltr">-{money(breakdown.customStickerTotal, currency)}</td></tr> : null}
                    {breakdown.shippingTotal ? <tr className="text-slate-500"><td className="py-1">שילוח</td><td className="py-1 text-left tabular-nums" dir="ltr">-{money(breakdown.shippingTotal, currency)}</td></tr> : null}
                    {breakdown.customsTotal ? <tr className="text-slate-500"><td className="py-1">מכס</td><td className="py-1 text-left tabular-nums" dir="ltr">-{money(breakdown.customsTotal, currency)}</td></tr> : null}
                    {breakdown.personalizationTotal ? <tr className="text-slate-500"><td className="py-1">התאמה אישית</td><td className="py-1 text-left tabular-nums" dir="ltr">-{money(breakdown.personalizationTotal, currency)}</td></tr> : null}
                    {breakdown.feesTotal ? <tr className="text-slate-500"><td className="py-1">עמלות</td><td className="py-1 text-left tabular-nums" dir="ltr">-{money(breakdown.feesTotal, currency)}</td></tr> : null}
                  </tbody>
                </table>

                <div className={`mt-3 rounded-2xl px-4 py-3 ${breakdown.profit >= 0 ? 'bg-emerald-600' : 'bg-rose-600'} text-white`}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-black opacity-80">רווח</span>
                    <div className="flex items-baseline gap-2">
                      <span className="rounded-lg bg-white/20 px-2 py-0.5 text-lg font-black tabular-nums">
                        {breakdown.marginPercent.toFixed(1)}%
                      </span>
                      <span className="text-2xl font-black tabular-nums" dir="ltr">{money(breakdown.profit, currency)}</span>
                    </div>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-xs font-bold opacity-80">
                    <span>מרווח</span>
                    <span dir="ltr">{money(breakdown.profitPerUnit, currency)} ליחידה</span>
                  </div>
                  {showIls ? (
                    <div className="mt-2 flex items-baseline justify-between border-t border-white/25 pt-2 text-xs font-black">
                      <span className="opacity-70">בשקלים</span>
                      <span className="tabular-nums" dir="ltr">{ils(breakdown.profit)}</span>
                    </div>
                  ) : null}
                </div>

                {showIls ? (
                  <p className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>הכנסה {ils(breakdown.revenue)} · עלות {ils(breakdown.totalCost)}</span>
                    <button
                      type="button"
                      className="underline decoration-dotted hover:text-slate-600"
                      onClick={() => void getUsdToIlsRate(true).then(setFx)}
                      title={fx ? `עודכן ${new Date(fx.fetchedAt).toLocaleDateString('he-IL')}` : ''}
                    >
                      ${'‎'}1 = ₪{effectiveRate?.toFixed(2)}
                    </button>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {message ? <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">{message}</p> : null}
      </SectionCard>

      {/* ── Planned vs actual ───────────────────────────────────────────────── */}
      {plannedBreakdown && actualBreakdown ? (
        <SectionCard title="מתוכנן מול בפועל" description="הפער בין ההצעה לסגירה.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-96 text-sm">
              <thead>
                <tr className="text-xs font-black text-slate-500">
                  <th className="py-2 text-right"> </th>
                  <th className="py-2 text-left">מתוכנן</th>
                  <th className="py-2 text-left">בפועל</th>
                  <th className="py-2 text-left">פער</th>
                </tr>
              </thead>
              <tbody className="font-bold text-slate-700">
                {([
                  ['הכנסה', plannedBreakdown.revenue, actualBreakdown.revenue],
                  ['ערכה', plannedBreakdown.kitTotal, actualBreakdown.kitTotal],
                  ['שילוח', plannedBreakdown.shippingTotal, actualBreakdown.shippingTotal],
                  ['מכס', plannedBreakdown.customsTotal, actualBreakdown.customsTotal],
                  ['עמלות', plannedBreakdown.feesTotal, actualBreakdown.feesTotal],
                  ['סה״כ עלות', plannedBreakdown.totalCost, actualBreakdown.totalCost],
                ] as Array<[string, number, number]>).map(([label, planned, actual]) => {
                  const delta = actual - planned;
                  return (
                    <tr key={label} className="border-t border-slate-100">
                      <td className="py-2">{label}</td>
                      <td className="py-2 text-left tabular-nums" dir="ltr">{money(planned, currency)}</td>
                      <td className="py-2 text-left tabular-nums" dir="ltr">{money(actual, currency)}</td>
                      <td className={`py-2 text-left tabular-nums ${delta === 0 ? 'text-slate-400' : delta > 0 ? 'text-rose-600' : 'text-emerald-600'}`} dir="ltr">
                        {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${money(delta, currency)}`}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-slate-300 text-base font-black text-slate-950">
                  <td className="py-2">רווח</td>
                  <td className="py-2 text-left tabular-nums" dir="ltr">{money(plannedBreakdown.profit, currency)}</td>
                  <td className="py-2 text-left tabular-nums" dir="ltr">{money(actualBreakdown.profit, currency)}</td>
                  <td className={`py-2 text-left tabular-nums ${actualBreakdown.profit >= plannedBreakdown.profit ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">
                    {`${actualBreakdown.profit - plannedBreakdown.profit > 0 ? '+' : ''}${money(actualBreakdown.profit - plannedBreakdown.profit, currency)}`}
                  </td>
                </tr>
                <tr className="text-xs font-black text-slate-500">
                  <td className="py-1">מרווח</td>
                  <td className="py-1 text-left tabular-nums" dir="ltr">{plannedBreakdown.marginPercent.toFixed(1)}%</td>
                  <td className="py-1 text-left tabular-nums" dir="ltr">{actualBreakdown.marginPercent.toFixed(1)}%</td>
                  <td className={`py-1 text-left tabular-nums ${actualBreakdown.marginPercent >= plannedBreakdown.marginPercent ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">
                    {`${actualBreakdown.marginPercent - plannedBreakdown.marginPercent > 0 ? '+' : ''}${(actualBreakdown.marginPercent - plannedBreakdown.marginPercent).toFixed(1)}%`}
                  </td>
                </tr>
                {comparisonRate ? (
                  <tr className="text-xs font-bold text-slate-400">
                    <td className="py-1">בשקלים</td>
                    <td className="py-1 text-left tabular-nums" dir="ltr">{formatIls(plannedBreakdown.profit * comparisonRate)}</td>
                    <td className="py-1 text-left tabular-nums" dir="ltr">{formatIls(actualBreakdown.profit * comparisonRate)}</td>
                    <td className="py-1 text-left tabular-nums" dir="ltr">{formatIls((actualBreakdown.profit - plannedBreakdown.profit) * comparisonRate)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
