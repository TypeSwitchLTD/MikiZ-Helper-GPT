import { useMemo, useState } from 'react';
import { SectionCard } from '../../components/layout/SectionCard';
import { calculateBreakdown } from '../../domain/sales/costing';
import type {
  Allocation,
  Customer,
  OrderCosting,
  OrderItem,
  OrderStatus,
  SalesOrder,
} from '../../domain/sales/salesTypes';

interface OrdersOverviewProps {
  orders: SalesOrder[];
  customers: Customer[];
  orderItems: OrderItem[];
  allocations: Allocation[];
  orderCostings: OrderCosting[];
  todayISO: string;
  isSaving?: boolean;
  onEditSalesOrder: (orderId: string, patch: Partial<SalesOrder>) => Promise<void>;
  onSelectOrder?: (orderId: string) => void;
}

const statusLabels: Record<OrderStatus, string> = {
  potential: 'פוטנציאלי',
  quote: 'הצעת מחיר',
  approved: 'אושר',
  paid: 'שולם',
  production: 'בייצור',
  shipped: 'נשלח',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

const statusTone: Record<OrderStatus, string> = {
  potential: 'bg-slate-100 text-slate-600',
  quote: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  approved: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  paid: 'bg-emerald-600 text-white',
  production: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  shipped: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
};

const liveStatuses: OrderStatus[] = ['potential', 'quote', 'approved', 'paid', 'production', 'shipped'];

function money(value: number, currency = 'USD') {
  const symbol = currency === 'USD' ? '$' : currency === 'ILS' ? '₪' : `${currency} `;
  return `${value < 0 ? '-' : ''}${symbol}${Math.abs(Math.round(value)).toLocaleString('en-US')}`;
}

export function OrdersOverview({
  orders,
  customers,
  orderItems,
  allocations,
  orderCostings,
  todayISO,
  isSaving,
  onEditSalesOrder,
  onSelectOrder,
}: OrdersOverviewProps) {
  const [showClosed, setShowClosed] = useState(false);
  const [paidDraft, setPaidDraft] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    return orders
      .filter((order) => !order.deletedAt)
      .filter((order) => (showClosed ? true : liveStatuses.includes(order.status)))
      .map((order) => {
        const customer = customers.find((entry) => entry.id === order.customerId);

        const actual = orderCostings.find((c) => c.orderId === order.id && c.phase === 'actual' && !c.deletedAt);
        const planned = orderCostings.find((c) => c.orderId === order.id && c.phase === 'planned' && !c.deletedAt);
        const costing = actual ?? planned ?? null;
        const breakdown = costing ? calculateBreakdown(costing) : null;

        // Revenue falls back to the loose order.amount when no costing exists yet
        const revenue = breakdown?.revenue ?? Number(order.amount ?? 0);
        const cost = breakdown?.totalCost ?? 0;
        const profit = breakdown ? breakdown.profit : revenue - cost;
        const margin = breakdown ? breakdown.marginPercent : 0;

        const paid = Number(order.paidAmount ?? 0);
        const balance = revenue - paid;

        const items = orderItems.filter((item) => item.orderId === order.id && !item.deletedAt);
        const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const allocatedUnits = items.reduce((sum, item) => {
          const covered = allocations
            .filter((a) => a.orderItemId === item.id && !a.deletedAt)
            .reduce((s, a) => s + Number(a.quantity || 0), 0);
          return sum + Math.min(covered, Number(item.quantity || 0));
        }, 0);

        const isLate = Boolean(order.dueDate && order.dueDate < todayISO && order.status !== 'completed');

        return {
          order,
          customerName: customer?.name ?? '—',
          revenue,
          cost,
          profit,
          margin,
          paid,
          balance,
          totalUnits,
          allocatedUnits,
          isLate,
          costSource: actual ? 'בפועל' : planned ? 'צפי' : null,
        };
      })
      .sort((a, b) => (a.order.dueDate ?? '9999').localeCompare(b.order.dueDate ?? '9999'));
  }, [allocations, customers, orderCostings, orderItems, orders, showClosed, todayISO]);

  const currency = rows[0]?.order.currency ?? 'USD';
  const totals = rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      cost: acc.cost + row.cost,
      profit: acc.profit + row.profit,
      paid: acc.paid + row.paid,
      balance: acc.balance + row.balance,
    }),
    { revenue: 0, cost: 0, profit: 0, paid: 0, balance: 0 },
  );
  const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  async function commitPaid(orderId: string) {
    const raw = paidDraft[orderId];
    if (raw === undefined) return;
    const parsed = Number(raw);
    await onEditSalesOrder(orderId, { paidAmount: Number.isFinite(parsed) ? parsed : 0 });
    setPaidDraft((current) => {
      const next = { ...current };
      delete next[orderId];
      return next;
    });
  }

  return (
    <SectionCard
      title="מצב הזמנות"
      description="כמה נכנס, כמה נשאר, מה הרווח ומתי צריך לספק."
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Pill label="הכנסה" value={money(totals.revenue, currency)} tone="slate" />
          <Pill label="נכנס" value={money(totals.paid, currency)} tone="emerald" />
          <Pill label="יתרה" value={money(totals.balance, currency)} tone={totals.balance > 0 ? 'amber' : 'slate'} />
          <Pill label="עלות" value={money(totals.cost, currency)} tone="slate" />
          <Pill label="רווח" value={`${money(totals.profit, currency)} · ${totalMargin.toFixed(0)}%`} tone={totals.profit >= 0 ? 'emerald' : 'rose'} />
        </div>
        <button
          type="button"
          className="rounded-2xl bg-white px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          onClick={() => setShowClosed((v) => !v)}
        >
          {showClosed ? 'רק פעילות' : 'הצג גם סגורות'}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm font-bold text-slate-500">אין הזמנות להצגה.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="text-[11px] font-black text-slate-500">
                <th className="py-2 text-right">הזמנה</th>
                <th className="py-2 text-right">שלב</th>
                <th className="py-2 text-left">הכנסה</th>
                <th className="py-2 text-left">נכנס / יתרה</th>
                <th className="py-2 text-left">עלות</th>
                <th className="py-2 text-left">רווח</th>
                <th className="py-2 text-center">הקצאה</th>
                <th className="py-2 text-center">אספקה</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = paidDraft[row.order.id];
                const coverage = row.totalUnits > 0 ? Math.round((row.allocatedUnits / row.totalUnits) * 100) : null;
                return (
                  <tr key={row.order.id} className="border-t border-slate-100 align-middle">
                    <td className="py-2 pl-2">
                      <button
                        type="button"
                        className="text-right font-black text-slate-950 hover:text-sky-700"
                        onClick={() => onSelectOrder?.(row.order.id)}
                      >
                        {row.order.title}
                      </button>
                      <p className="text-[11px] font-bold text-slate-400">{row.customerName}</p>
                    </td>

                    <td className="py-2">
                      <span className={`inline-block rounded-full px-2 py-1 text-[11px] font-black ${statusTone[row.order.status]}`}>
                        {statusLabels[row.order.status]}
                      </span>
                    </td>

                    <td className="py-2 text-left font-bold tabular-nums text-slate-700" dir="ltr">
                      {money(row.revenue, row.order.currency)}
                    </td>

                    <td className="py-2 text-left" dir="ltr">
                      <input
                        className="w-20 rounded-xl border border-slate-200 px-2 py-1 text-left text-sm font-black tabular-nums outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                        dir="ltr"
                        disabled={isSaving}
                        value={draft ?? String(row.paid || '')}
                        placeholder="0"
                        onChange={(e) => setPaidDraft((c) => ({ ...c, [row.order.id]: e.target.value }))}
                        onBlur={() => void commitPaid(row.order.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void commitPaid(row.order.id); }}
                      />
                      <p className={`mt-0.5 text-[11px] font-black tabular-nums ${row.balance > 0.5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {row.balance > 0.5 ? `חסר ${money(row.balance, row.order.currency)}` : 'שולם מלא'}
                      </p>
                    </td>

                    <td className="py-2 text-left font-bold tabular-nums text-slate-500" dir="ltr">
                      {row.costSource ? (
                        <>
                          {money(row.cost, row.order.currency)}
                          <span className="mr-1 text-[10px] font-black text-slate-400">{row.costSource}</span>
                        </>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-300">אין חישוב</span>
                      )}
                    </td>

                    <td className="py-2 text-left" dir="ltr">
                      {row.costSource ? (
                        <>
                          <span className={`font-black tabular-nums ${row.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {money(row.profit, row.order.currency)}
                          </span>
                          <p className={`text-[11px] font-black tabular-nums ${row.margin >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {row.margin.toFixed(1)}%
                          </p>
                        </>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-300">—</span>
                      )}
                    </td>

                    <td className="py-2 text-center">
                      {coverage === null ? (
                        <span className="text-[11px] font-bold text-slate-300">—</span>
                      ) : (
                        <span className={`inline-block rounded-full px-2 py-1 text-[11px] font-black ${
                          coverage >= 100 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : coverage > 0 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                            : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                        }`}>
                          {coverage}%
                        </span>
                      )}
                    </td>

                    <td className="py-2 text-center">
                      <span className={`text-[11px] font-black ${row.isLate ? 'text-rose-600' : 'text-slate-500'}`}>
                        {row.order.dueDate || '—'}
                      </span>
                      {row.isLate ? <p className="text-[10px] font-black text-rose-500">באיחור</p> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function Pill({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'emerald' | 'amber' | 'rose' }) {
  const toneClass = {
    slate: 'bg-white text-slate-800 ring-slate-200',
    emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    rose: 'bg-rose-50 text-rose-800 ring-rose-200',
  }[tone];
  return (
    <div className={`rounded-2xl px-3 py-1.5 ring-1 ${toneClass}`}>
      <span className="text-[10px] font-black opacity-60">{label}</span>
      <span className="mr-2 text-sm font-black tabular-nums" dir="ltr">{value}</span>
    </div>
  );
}
