import { useMemo, useState } from 'react';

interface DeliveryPlannerProps {
  /** Day the clock starts — usually the order date */
  startDate: string;
  deliveryDays: number | null;
  dueDate: string | null;
  todayISO: string;
  disabled?: boolean;
  onChange: (patch: { deliveryDays: number | null; dueDate: string | null; deliveryStartDate: string }) => void;
}

const DAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const MONTH_LABELS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(iso: string, days: number): string {
  const date = fromISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms = fromISO(toIso).getTime() - fromISO(fromIso).getTime();
  return Math.round(ms / 86_400_000);
}

/** Weeks of the month containing `anchor`, padded to full Sun–Sat rows */
function monthGrid(anchor: string): Array<Array<string | null>> {
  const base = fromISO(anchor);
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<string | null> = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(toISO(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function DeliveryPlanner({
  startDate,
  deliveryDays,
  dueDate,
  todayISO,
  disabled,
  onChange,
}: DeliveryPlannerProps) {
  const [open, setOpen] = useState(false);
  const [monthAnchor, setMonthAnchor] = useState(() => dueDate || startDate || todayISO);

  const effectiveStart = startDate || todayISO;
  const effectiveDue = dueDate || (deliveryDays != null ? addDays(effectiveStart, deliveryDays) : null);
  const effectiveDays = deliveryDays ?? (dueDate ? daysBetween(effectiveStart, dueDate) : null);

  const weeks = useMemo(() => monthGrid(monthAnchor), [monthAnchor]);
  const daysLeft = effectiveDue ? daysBetween(todayISO, effectiveDue) : null;

  function applyDays(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === '') {
      onChange({ deliveryDays: null, dueDate: null, deliveryStartDate: effectiveStart });
      return;
    }
    const days = Math.max(0, Math.round(Number(trimmed) || 0));
    onChange({ deliveryDays: days, dueDate: addDays(effectiveStart, days), deliveryStartDate: effectiveStart });
  }

  function pickDate(iso: string) {
    onChange({
      deliveryDays: daysBetween(effectiveStart, iso),
      dueDate: iso,
      deliveryStartDate: effectiveStart,
    });
  }

  function shiftMonth(delta: number) {
    const base = fromISO(monthAnchor);
    setMonthAnchor(toISO(new Date(base.getFullYear(), base.getMonth() + delta, 1)));
  }

  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">
          <span className="text-[11px] font-black text-slate-500">ימי אספקה</span>
          <input
            className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-black tabular-nums outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            dir="ltr"
            inputMode="numeric"
            disabled={disabled}
            value={effectiveDays ?? ''}
            placeholder="7"
            onChange={(e) => applyDays(e.target.value)}
          />
        </label>

        <div className="grid gap-1">
          <span className="text-[11px] font-black text-slate-500">תאריך אספקה</span>
          <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-900 ring-1 ring-slate-200">
            {effectiveDue ?? 'לא נקבע'}
          </div>
        </div>

        {daysLeft !== null ? (
          <span
            className={`rounded-xl px-3 py-2 text-xs font-black ${
              daysLeft < 0
                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                : daysLeft <= 2
                  ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                  : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
            }`}
          >
            {daysLeft < 0 ? `באיחור ${Math.abs(daysLeft)} ימים` : daysLeft === 0 ? 'היום' : `עוד ${daysLeft} ימים`}
          </span>
        ) : null}

        <button
          type="button"
          className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'סגור לוח' : 'לוח שנה'}
        </button>
      </div>

      {open ? (
        <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="rounded-lg px-2 py-1 text-sm font-black text-slate-500 hover:bg-slate-100" onClick={() => shiftMonth(1)}>›</button>
            <span className="text-sm font-black text-slate-800">
              {MONTH_LABELS[fromISO(monthAnchor).getMonth()]} {fromISO(monthAnchor).getFullYear()}
            </span>
            <button type="button" className="rounded-lg px-2 py-1 text-sm font-black text-slate-500 hover:bg-slate-100" onClick={() => shiftMonth(-1)}>‹</button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {DAY_LABELS.map((label) => (
              <span key={label} className="py-1 text-[10px] font-black text-slate-400">{label}</span>
            ))}

            {weeks.flat().map((iso, index) => {
              if (!iso) return <span key={`pad-${index}`} />;

              const isStart = iso === effectiveStart;
              const isDue = effectiveDue === iso;
              const inRange = Boolean(effectiveDue && iso > effectiveStart && iso < effectiveDue);
              const isToday = iso === todayISO;
              const dayNumber = Number(iso.slice(8, 10));
              const offset = daysBetween(effectiveStart, iso);

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDate(iso)}
                  title={offset >= 0 ? `יום ${offset} מתחילת הספירה` : ''}
                  className={`relative rounded-lg py-1.5 text-xs font-black transition ${
                    isDue
                      ? 'bg-slate-950 text-white'
                      : isStart
                        ? 'bg-sky-600 text-white'
                        : inRange
                          ? 'bg-sky-100 text-sky-800'
                          : 'text-slate-600 hover:bg-slate-100'
                  } ${isToday && !isDue && !isStart ? 'ring-1 ring-amber-300' : ''}`}
                >
                  {dayNumber}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-slate-400">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-sky-600" /> התחלה
              <span className="inline-block h-2 w-2 rounded-full bg-slate-950" /> אספקה
              <span className="inline-block h-2 w-2 rounded-full ring-1 ring-amber-300" /> היום
            </span>
            {effectiveDays !== null ? <span className="font-black text-slate-600">{effectiveDays} ימים נבחרו</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
