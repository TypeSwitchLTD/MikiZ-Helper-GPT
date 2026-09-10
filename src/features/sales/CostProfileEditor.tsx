import { useMemo, useState } from 'react';
import { SectionCard } from '../../components/layout/SectionCard';
import { createDefaultCostProfile, getKitUnitCost } from '../../domain/sales/costing';
import type { CostProfile, Product } from '../../domain/sales/salesTypes';

interface CostProfileEditorProps {
  products: Product[];
  costProfiles: CostProfile[];
  isSaving?: boolean;
  onAddCostProfile: (input: Omit<CostProfile, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>) => Promise<CostProfile>;
  onEditCostProfile: (profileId: string, patch: Partial<CostProfile>) => Promise<void>;
}

function num(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number, currency = 'USD') {
  const symbol = currency === 'USD' ? '$' : currency === 'ILS' ? '₪' : `${currency} `;
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
}

export function CostProfileEditor({
  products,
  costProfiles,
  isSaving,
  onAddCostProfile,
  onEditCostProfile,
}: CostProfileEditorProps) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [open, setOpen] = useState(false);

  const profile = useMemo(
    () => costProfiles.find((entry) => entry.productId === productId && entry.active && !entry.deletedAt) ?? null,
    [costProfiles, productId],
  );

  const kitUnitCost = profile ? getKitUnitCost(profile.components) : 0;
  const currency = profile?.currency ?? 'USD';

  async function updateComponent(index: number, patch: Partial<CostProfile['components'][number]>) {
    if (!profile) return;
    const components = profile.components.map((component, i) => (i === index ? { ...component, ...patch } : component));
    await onEditCostProfile(profile.id, { components });
  }

  async function updateFee(index: number, patch: Partial<CostProfile['fees'][number]>) {
    if (!profile) return;
    const fees = profile.fees.map((fee, i) => (i === index ? { ...fee, ...patch } : fee));
    await onEditCostProfile(profile.id, { fees });
  }

  async function updateShipping(index: number, cost: number) {
    if (!profile) return;
    const shippingEstimates = profile.shippingEstimates.map((estimate, i) => (i === index ? { ...estimate, cost } : estimate));
    await onEditCostProfile(profile.id, { shippingEstimates });
  }

  return (
    <SectionCard title="מחירון" description="עלויות קבועות ליחידה, עמלות והערכות שילוח. שינוי משפיע על הזמנות חדשות בלבד.">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="">בחר מוצר</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>

        {profile ? (
          <>
            <div className="rounded-2xl bg-slate-950 px-4 py-2 text-white">
              <span className="text-xs font-bold opacity-70">ערכה ליחידה</span>
              <span className="mr-2 text-lg font-black tabular-nums" dir="ltr">{money(kitUnitCost, currency)}</span>
            </div>
            <button
              type="button"
              className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'סגור' : 'ערוך'}
            </button>
          </>
        ) : productId ? (
          <button
            type="button"
            className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
            disabled={isSaving}
            onClick={() => void onAddCostProfile(createDefaultCostProfile(productId))}
          >
            צור מחירון למוצר
          </button>
        ) : null}
      </div>

      {open && profile ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-black text-slate-500">רכיבי הערכה</p>
            <div className="grid gap-2">
              {profile.components.map((component, index) => (
                <div key={component.id} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-200">
                  <input type="checkbox" checked={component.active} onChange={(e) => void updateComponent(index, { active: e.target.checked })} />
                  <span className="flex-1 text-sm font-bold text-slate-700">{component.label}</span>
                  <input
                    className="w-20 rounded-xl border border-slate-200 px-2 py-1 text-left text-sm font-black tabular-nums"
                    dir="ltr"
                    value={component.unitCost}
                    onChange={(e) => void updateComponent(index, { unitCost: num(e.target.value) })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-black text-slate-500">עמלות</p>
            <div className="grid gap-2">
              {profile.fees.map((fee, index) => (
                <div key={fee.id} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-200">
                  <input type="checkbox" checked={fee.active} onChange={(e) => void updateFee(index, { active: e.target.checked })} />
                  <span className="flex-1 text-sm font-bold text-slate-700">{fee.label}</span>
                  <select
                    className="rounded-xl border border-slate-200 px-1 py-1 text-xs font-black"
                    value={fee.basis}
                    onChange={(e) => void updateFee(index, { basis: e.target.value as 'percent' | 'fixed' })}
                  >
                    <option value="percent">%</option>
                    <option value="fixed">קבוע</option>
                  </select>
                  <input
                    className="w-16 rounded-xl border border-slate-200 px-2 py-1 text-left text-sm font-black tabular-nums"
                    dir="ltr"
                    value={fee.value}
                    onChange={(e) => void updateFee(index, { value: num(e.target.value) })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-black text-slate-500">הערכת שילוח (להזמנה)</p>
            <div className="grid gap-2">
              {profile.shippingEstimates.map((estimate, index) => (
                <div key={estimate.id} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-200">
                  <span className="flex-1 text-sm font-bold text-slate-700">{estimate.destination}</span>
                  <input
                    className="w-20 rounded-xl border border-slate-200 px-2 py-1 text-left text-sm font-black tabular-nums"
                    dir="ltr"
                    value={estimate.cost}
                    onChange={(e) => void updateShipping(index, num(e.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
