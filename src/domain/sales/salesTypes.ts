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
