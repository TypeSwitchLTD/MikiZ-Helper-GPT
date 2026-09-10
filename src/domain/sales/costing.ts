import { createId } from '../../utils/ids';
import type {
  CostComponent,
  CostProfile,
  CostingBreakdown,
  FeeRule,
  OrderCosting,
  ShippingEstimate,
} from './salesTypes';

/** Default kit for TimerAligner — real supplier prices, USD per unit */
export const DEFAULT_COMPONENTS: Array<Omit<CostComponent, 'id'>> = [
  { label: 'מוצר (מפעל)', unitCost: 6.8, active: true },
  { label: 'קופסה רגילה', unitCost: 0.45, active: true },
  { label: 'מדבקת TimerAligner', unitCost: 0.046, active: true },
  { label: 'ספר הוראות', unitCost: 0.14, active: true },
  { label: 'כבל USB', unitCost: 0.07, active: true },
  { label: 'Handling ליחידה', unitCost: 1.0, active: true },
];

export const DEFAULT_FEES: Array<Omit<FeeRule, 'id'>> = [
  { label: 'סליקה', basis: 'percent', value: 0, active: true },
  { label: 'Shopify', basis: 'percent', value: 0, active: false },
  { label: 'עמלת סוכן', basis: 'percent', value: 0, active: false },
];

export const DEFAULT_SHIPPING: Array<Omit<ShippingEstimate, 'id'>> = [
  { destination: 'ישראל', cost: 0 },
  { destination: 'אירופה', cost: 0 },
  { destination: 'ארה״ב', cost: 0 },
  { destination: 'שאר העולם', cost: 0 },
];

export function createDefaultCostProfile(productId: string, currency = 'USD'): Omit<CostProfile, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  return {
    productId,
    currency,
    components: DEFAULT_COMPONENTS.map((component) => ({ ...component, id: createId('cost') })),
    fees: DEFAULT_FEES.map((fee) => ({ ...fee, id: createId('fee') })),
    shippingEstimates: DEFAULT_SHIPPING.map((estimate) => ({ ...estimate, id: createId('ship') })),
    active: true,
  };
}

/** Sum of every active component — the "kit" cost for one unit */
export function getKitUnitCost(components: CostComponent[]): number {
  return components
    .filter((component) => component.active)
    .reduce((sum, component) => sum + (Number(component.unitCost) || 0), 0);
}

export function calculateBreakdown(costing: OrderCosting): CostingBreakdown {
  const quantity = Math.max(0, Number(costing.quantity) || 0);
  const unitPrice = Number(costing.unitPrice) || 0;

  const revenue = quantity * unitPrice;
  const discountTotal = Number(costing.discountTotal) || 0;
  const netRevenue = revenue - discountTotal;

  const kitUnitCost = getKitUnitCost(costing.components);
  const kitTotal = kitUnitCost * quantity;
  const customStickerTotal = (Number(costing.customStickerUnitCost) || 0) * quantity;
  const shippingTotal = Number(costing.shippingTotal) || 0;
  const customsTotal = Number(costing.customsTotal) || 0;
  const personalizationTotal = Number(costing.personalizationTotal) || 0;

  // Percent fees apply to net revenue (after discount), fixed fees are flat
  const feesTotal = costing.fees
    .filter((fee) => fee.active)
    .reduce((sum, fee) => {
      const value = Number(fee.value) || 0;
      return sum + (fee.basis === 'percent' ? (netRevenue * value) / 100 : value);
    }, 0);

  const totalCost = kitTotal + customStickerTotal + shippingTotal + customsTotal + personalizationTotal + feesTotal;
  const profit = netRevenue - totalCost;

  return {
    revenue,
    kitUnitCost,
    kitTotal,
    customStickerTotal,
    shippingTotal,
    customsTotal,
    personalizationTotal,
    discountTotal,
    feesTotal,
    totalCost,
    netRevenue,
    profit,
    marginPercent: netRevenue > 0 ? (profit / netRevenue) * 100 : 0,
    profitPerUnit: quantity > 0 ? profit / quantity : 0,
  };
}

/** Build a fresh costing from the current price book */
export function buildCostingFromProfile(
  profile: CostProfile,
  input: { orderId: string; productId: string; phase: OrderCosting['phase']; quantity: number; unitPrice: number; destination?: string },
): Omit<OrderCosting, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  const shipping = profile.shippingEstimates.find((estimate) => estimate.destination === input.destination);
  return {
    orderId: input.orderId,
    productId: input.productId,
    phase: input.phase,
    currency: profile.currency,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    components: profile.components.map((component) => ({ ...component })),
    fees: profile.fees.map((fee) => ({ ...fee })),
    shippingTotal: shipping?.cost ?? 0,
    customsTotal: 0,
    customStickerUnitCost: 0,
    personalizationTotal: 0,
    discountTotal: 0,
    destination: input.destination,
  };
}

/** Copy a planned costing into an actual one, keeping every number as the starting point */
export function cloneCostingForActual(planned: OrderCosting): Omit<OrderCosting, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  return {
    orderId: planned.orderId,
    productId: planned.productId,
    phase: 'actual',
    currency: planned.currency,
    quantity: planned.quantity,
    unitPrice: planned.unitPrice,
    components: planned.components.map((component) => ({ ...component })),
    fees: planned.fees.map((fee) => ({ ...fee })),
    shippingTotal: planned.shippingTotal,
    customsTotal: planned.customsTotal,
    customStickerUnitCost: planned.customStickerUnitCost,
    personalizationTotal: planned.personalizationTotal,
    discountTotal: planned.discountTotal,
    destination: planned.destination,
  };
}
