export type CustomerStatus = 'meeting_done' | 'quote_sent' | 'waiting_reply' | 'hot' | 'customer' | 'not_relevant';
export type OrderStatus = 'potential' | 'quote' | 'approved' | 'paid' | 'production' | 'shipped' | 'completed' | 'cancelled';
export type OrderSource = 'direct' | 'shopify' | 'manual' | 'other';
export type PriceTier = 'retail' | 'wholesale' | 'distributor' | 'custom';
export type SupplierType = 'production' | 'stickers' | 'packaging' | 'shipping' | 'other';
export type BatchStatus = 'planned' | 'production' | 'ready' | 'in_transit' | 'received' | 'cancelled';

export type ProductColor =
  | 'white'
  | 'black'
  | 'yellow'
  | 'red'
  | 'green'
  | 'sky_blue'
  | 'royal_blue'
  | 'pink';

export interface Customer {
  id: string;
  name: string;
  company?: string;
  country: string;
  city?: string;
  whatsapp?: string;
  email?: string;
  source?: string;
  status: CustomerStatus;
  meetingDate?: string | null;
  notes?: string;
  links?: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  type: SupplierType;
  country?: string;
  contactName?: string;
  whatsapp?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface SalesOrder {
  id: string;
  customerId: string;
  title: string;
  source: OrderSource;
  status: OrderStatus;
  currency: string;
  amount?: number | null;
  expectedCloseDate?: string | null;
  dueDate?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  color: ProductColor;
  quantity: number;
  unitPrice?: number | null;
  priceTier?: PriceTier;
  needsSticker?: boolean;
  stickerSupplierId?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ProductionBatch {
  id: string;
  productId: string;
  color: ProductColor;
  supplierId?: string | null;
  label: string;
  status: BatchStatus;
  quantityPlanned: number;
  quantityReceived?: number | null;
  expectedReadyDate?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Allocation {
  id: string;
  orderItemId: string;
  productionBatchId: string;
  quantity: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// ─── Profitability / costing ──────────────────────────────────────────────────

/** One fixed per-unit cost line inside the kit (product, box, sticker, ...) */
export interface CostComponent {
  id: string;
  label: string;
  unitCost: number;
  active: boolean;
}

export type FeeBasis = 'percent' | 'fixed';

/** A commission or fee. Percent applies to revenue, fixed is a flat amount. */
export interface FeeRule {
  id: string;
  label: string;
  basis: FeeBasis;
  value: number;
  active: boolean;
}

/** Estimated shipping cost for one destination, per order */
export interface ShippingEstimate {
  id: string;
  destination: string;
  cost: number;
}

/**
 * The living price book for a product. Editing it affects NEW costings only —
 * existing costings keep their own snapshot so history stays honest.
 */
export interface CostProfile {
  id: string;
  productId: string;
  currency: string;
  components: CostComponent[];
  fees: FeeRule[];
  shippingEstimates: ShippingEstimate[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type CostingPhase = 'planned' | 'actual';

/**
 * A profitability snapshot for one order. Two rows per order at most:
 * phase='planned' (the quote) and phase='actual' (the closing).
 */
export interface OrderCosting {
  id: string;
  orderId: string;
  productId: string;
  phase: CostingPhase;
  currency: string;
  quantity: number;
  unitPrice: number;
  /** Snapshot of the price book at the time this costing was created */
  components: CostComponent[];
  fees: FeeRule[];
  shippingTotal: number;
  customsTotal: number;
  customStickerUnitCost: number;
  personalizationTotal: number;
  discountTotal: number;
  destination?: string;
  notes?: string;
  /** USD→ILS rate captured when this costing was saved, so past numbers stay put */
  exchangeRateILS?: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/** Derived numbers — never stored, always computed from an OrderCosting */
export interface CostingBreakdown {
  revenue: number;
  kitUnitCost: number;
  kitTotal: number;
  customStickerTotal: number;
  shippingTotal: number;
  customsTotal: number;
  personalizationTotal: number;
  discountTotal: number;
  feesTotal: number;
  totalCost: number;
  netRevenue: number;
  profit: number;
  marginPercent: number;
  profitPerUnit: number;
}
