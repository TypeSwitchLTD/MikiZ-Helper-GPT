import { useMemo, useState } from 'react';
import { SectionCard } from '../../components/layout/SectionCard';
import type { CreateTaskInput } from '../../domain/tasks/taskMutations';
import type { Task } from '../../domain/tasks/taskTypes';
import type {
  Allocation,
  Customer,
  CustomerStatus,
  OrderItem,
  OrderSource,
  OrderStatus,
  PriceTier,
  Product,
  ProductColor,
  ProductionBatch,
  SalesOrder,
  Supplier,
  SupplierType,
} from '../../domain/sales/salesTypes';

interface SalesOpsTabProps {
  customers: Customer[];
  products: Product[];
  suppliers: Supplier[];
  orders: SalesOrder[];
  orderItems: OrderItem[];
  productionBatches: ProductionBatch[];
  allocations: Allocation[];
  tasks: Task[];
  todayISO: string;
  isSaving?: boolean;
  onAddCustomer: (input: Parameters<typeof import('../../domain/sales/salesMutations').createCustomer>[0]) => Promise<Customer>;
  onEditCustomer: (customerId: string, patch: Partial<Customer>) => Promise<void>;
  onAddProduct: (input: Parameters<typeof import('../../domain/sales/salesMutations').createProduct>[0]) => Promise<Product>;
  onAddSupplier: (input: Parameters<typeof import('../../domain/sales/salesMutations').createSupplier>[0]) => Promise<Supplier>;
  onAddSalesOrder: (input: Parameters<typeof import('../../domain/sales/salesMutations').createSalesOrder>[0]) => Promise<SalesOrder>;
  onEditSalesOrder: (orderId: string, patch: Partial<SalesOrder>) => Promise<void>;
  onAddOrderItem: (input: Parameters<typeof import('../../domain/sales/salesMutations').createOrderItem>[0]) => Promise<OrderItem>;
  onAddProductionBatch: (input: Parameters<typeof import('../../domain/sales/salesMutations').createProductionBatch>[0]) => Promise<ProductionBatch>;
  onAddAllocation: (input: Parameters<typeof import('../../domain/sales/salesMutations').createAllocation>[0]) => Promise<Allocation>;
  onCreateTask: (input: CreateTaskInput) => Promise<void>;
}

const customerStatusLabels: Record<CustomerStatus, string> = {
  meeting_done: 'אחרי פגישה',
  quote_sent: 'הצעה נשלחה',
  waiting_reply: 'מחכה לתשובה',
  hot: 'חם',
  customer: 'לקוח',
  not_relevant: 'לא רלוונטי',
};

const orderStatusLabels: Record<OrderStatus, string> = {
  potential: 'פוטנציאלי',
  quote: 'הצעת מחיר',
  approved: 'אושר',
  paid: 'שולם',
  production: 'בייצור',
  shipped: 'נשלח',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

const sourceLabels: Record<OrderSource, string> = {
  direct: 'ישיר',
  shopify: 'Shopify',
  manual: 'ידני',
  other: 'אחר',
};

const colorLabels: Record<ProductColor, string> = {
  white: 'לבן',
  black: 'שחור',
  yellow: 'צהוב',
  red: 'אדום',
  green: 'ירוק',
  sky_blue: 'כחול שמיים',
  royal_blue: 'כחול רויאל',
  pink: 'ורוד',
};

const supplierTypeLabels: Record<SupplierType, string> = {
  production: 'ייצור',
  stickers: 'מדבקות',
  packaging: 'אריזה',
  shipping: 'שילוח',
  other: 'אחר',
};

const priceTiers: PriceTier[] = ['retail', 'wholesale', 'distributor', 'custom'];
const colors = Object.keys(colorLabels) as ProductColor[];
const openOrderStatuses: OrderStatus[] = ['potential', 'quote', 'approved', 'paid', 'production', 'shipped'];
const confirmedOrderStatuses: OrderStatus[] = ['approved', 'paid', 'production', 'shipped', 'completed'];

function inputClass(extra = '') {
  return `rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100 ${extra}`;
}

function buttonClass(tone: 'dark' | 'green' | 'light' = 'dark') {
  if (tone === 'green') return 'rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50';
  if (tone === 'light') return 'rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50';
  return 'rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-50';
}

function getAllocatedQuantity(orderItemId: string, allocations: Allocation[]): number {
  return allocations
    .filter((allocation) => allocation.orderItemId === orderItemId && !allocation.deletedAt)
    .reduce((sum, allocation) => sum + Number(allocation.quantity || 0), 0);
}

function getBatchAllocatedQuantity(batchId: string, allocations: Allocation[]): number {
  return allocations
    .filter((allocation) => allocation.productionBatchId === batchId && !allocation.deletedAt)
    .reduce((sum, allocation) => sum + Number(allocation.quantity || 0), 0);
}

function allocationTone(quantity: number, allocated: number): string {
  if (allocated >= quantity) return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
  if (allocated > 0) return 'bg-amber-50 text-amber-800 ring-amber-100';
  return 'bg-rose-50 text-rose-800 ring-rose-100';
}

function formatMoney(value: number | null | undefined, currency: string) {
  if (!value) return '-';
  return `${value.toLocaleString()} ${currency}`;
}

export function SalesOpsTab({
  customers,
  products,
  suppliers,
  orders,
  orderItems,
  productionBatches,
  allocations,
  tasks,
  todayISO,
  isSaving,
  onAddCustomer,
  onEditCustomer,
  onAddProduct,
  onAddSupplier,
  onAddSalesOrder,
  onEditSalesOrder,
  onAddOrderItem,
  onAddProductionBatch,
  onAddAllocation,
  onCreateTask,
}: SalesOpsTabProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [customerDraft, setCustomerDraft] = useState({ name: '', company: '', country: '', city: '', email: '', whatsapp: '', notes: '' });
  const [productDraft, setProductDraft] = useState({ name: '', sku: '' });
  const [supplierDraft, setSupplierDraft] = useState({ name: '', type: 'production' as SupplierType, country: '', email: '', whatsapp: '' });
  const [orderDraft, setOrderDraft] = useState({ title: '', source: 'direct' as OrderSource, status: 'potential' as OrderStatus, amount: '', currency: 'USD', dueDate: '', notes: '' });
  const [itemDraft, setItemDraft] = useState({ orderId: '', productId: '', color: 'white' as ProductColor, quantity: '100', unitPrice: '', priceTier: 'custom' as PriceTier, needsSticker: false, stickerSupplierId: '' });
  const [batchDraft, setBatchDraft] = useState({ productId: '', color: 'white' as ProductColor, supplierId: '', label: '', quantityPlanned: '1000', quantityReceived: '', expectedReadyDate: '' });
  const [allocationDraft, setAllocationDraft] = useState({ orderItemId: '', productionBatchId: '', quantity: '' });
  const [taskDraft, setTaskDraft] = useState({ orderId: '', title: '', dueDate: todayISO });

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? customers[0] ?? null;
  const visibleOrders = orders.filter((order) => !order.deletedAt);
  const selectedOrders = selectedCustomer ? visibleOrders.filter((order) => order.customerId === selectedCustomer.id) : [];

  const enrichedItems = useMemo(() => {
    return orderItems
      .filter((item) => !item.deletedAt)
      .map((item) => {
        const order = orders.find((entry) => entry.id === item.orderId);
        const customer = customers.find((entry) => entry.id === order?.customerId);
        const product = products.find((entry) => entry.id === item.productId);
        const allocated = getAllocatedQuantity(item.id, allocations);
        return { item, order, customer, product, allocated, missing: Math.max(0, item.quantity - allocated) };
      });
  }, [allocations, customers, orderItems, orders, products]);

  const openItems = enrichedItems.filter(({ order }) => order && openOrderStatuses.includes(order.status));
  const missingItems = openItems.filter(({ missing }) => missing > 0);
  const forecastDemand = openItems.reduce((sum, { item }) => sum + item.quantity, 0);
  const confirmedDemand = openItems
    .filter(({ order }) => order && confirmedOrderStatuses.includes(order.status))
    .reduce((sum, { item }) => sum + item.quantity, 0);
  const allocatedDemand = openItems.reduce((sum, { allocated }) => sum + allocated, 0);
  const openOrderCount = visibleOrders.filter((order) => openOrderStatuses.includes(order.status)).length;

  const selectedOrderOptions = selectedOrders.filter((order) => order.status !== 'cancelled' && order.status !== 'completed');
  const stickerSuppliers = suppliers.filter((supplier) => supplier.type === 'stickers');
  const productionSuppliers = suppliers.filter((supplier) => supplier.type === 'production');

  async function submitCustomer() {
    const name = customerDraft.name.trim();
    if (!name) return setMessage('חסר שם לקוח.');
    const customer = await onAddCustomer({
      name,
      company: customerDraft.company.trim() || undefined,
      country: customerDraft.country.trim() || 'לא הוגדר',
      city: customerDraft.city.trim() || undefined,
      email: customerDraft.email.trim() || undefined,
      whatsapp: customerDraft.whatsapp.trim() || undefined,
      status: 'meeting_done',
      notes: customerDraft.notes.trim() || undefined,
      links: [],
    });
    setSelectedCustomerId(customer.id);
    setCustomerDraft({ name: '', company: '', country: '', city: '', email: '', whatsapp: '', notes: '' });
    setMessage('לקוח נוסף.');
  }

  async function submitProduct() {
    const name = productDraft.name.trim();
    if (!name) return setMessage('חסר שם מוצר.');
    await onAddProduct({ name, sku: productDraft.sku.trim() || undefined, active: true });
    setProductDraft({ name: '', sku: '' });
    setMessage('מוצר נוסף.');
  }

  async function submitSupplier() {
    const name = supplierDraft.name.trim();
    if (!name) return setMessage('חסר שם ספק.');
    await onAddSupplier({
      name,
      type: supplierDraft.type,
      country: supplierDraft.country.trim() || undefined,
      email: supplierDraft.email.trim() || undefined,
      whatsapp: supplierDraft.whatsapp.trim() || undefined,
    });
    setSupplierDraft({ name: '', type: 'production', country: '', email: '', whatsapp: '' });
    setMessage('ספק נוסף.');
  }

  async function submitOrder() {
    if (!selectedCustomer) return setMessage('בחר לקוח קודם.');
    const title = orderDraft.title.trim() || `הזמנה - ${selectedCustomer.name}`;
    await onAddSalesOrder({
      customerId: selectedCustomer.id,
      title,
      source: orderDraft.source,
      status: orderDraft.status,
      currency: orderDraft.currency.trim() || 'USD',
      amount: orderDraft.amount ? Number(orderDraft.amount) : null,
      dueDate: orderDraft.dueDate || null,
      expectedCloseDate: orderDraft.status === 'potential' ? orderDraft.dueDate || null : null,
      notes: orderDraft.notes.trim() || undefined,
    });
    setOrderDraft({ title: '', source: 'direct', status: 'potential', amount: '', currency: 'USD', dueDate: '', notes: '' });
    setMessage('הזמנה נוספה.');
  }

  async function submitItem() {
    const orderId = itemDraft.orderId || selectedOrderOptions[0]?.id || '';
    const productId = itemDraft.productId || products[0]?.id || '';
    if (!orderId || !productId) return setMessage('חסר הזמנה או מוצר.');
    await onAddOrderItem({
      orderId,
      productId,
      color: itemDraft.color,
      quantity: Math.max(1, Number(itemDraft.quantity) || 1),
      unitPrice: itemDraft.unitPrice ? Number(itemDraft.unitPrice) : null,
      priceTier: itemDraft.priceTier,
      needsSticker: itemDraft.needsSticker,
      stickerSupplierId: itemDraft.needsSticker ? itemDraft.stickerSupplierId || null : null,
    });
    setItemDraft((current) => ({ ...current, quantity: '100', unitPrice: '', needsSticker: false, stickerSupplierId: '' }));
    setMessage('פריט הזמנה נוסף.');
  }

  async function submitBatch() {
    const productId = batchDraft.productId || products[0]?.id || '';
    if (!productId) return setMessage('חסר מוצר לסבב ייצור.');
    await onAddProductionBatch({
      productId,
      color: batchDraft.color,
      supplierId: batchDraft.supplierId || productionSuppliers[0]?.id || null,
      label: batchDraft.label.trim() || `סבב ${new Date().toLocaleDateString('he-IL')}`,
      status: 'planned',
      quantityPlanned: Math.max(1, Number(batchDraft.quantityPlanned) || 1),
      quantityReceived: batchDraft.quantityReceived ? Number(batchDraft.quantityReceived) : null,
      expectedReadyDate: batchDraft.expectedReadyDate || null,
    });
    setBatchDraft((current) => ({ ...current, label: '', quantityPlanned: '1000', quantityReceived: '', expectedReadyDate: '' }));
    setMessage('סבב ייצור נוסף.');
  }

  async function submitAllocation() {
    const orderItemId = allocationDraft.orderItemId || missingItems[0]?.item.id || '';
    const productionBatchId = allocationDraft.productionBatchId || productionBatches[0]?.id || '';
    if (!orderItemId || !productionBatchId) return setMessage('חסר פריט הזמנה או סבב ייצור.');
    await onAddAllocation({
      orderItemId,
      productionBatchId,
      quantity: Math.max(1, Number(allocationDraft.quantity) || 1),
    });
    setAllocationDraft({ orderItemId: '', productionBatchId: '', quantity: '' });
    setMessage('הקצאה נוספה.');
  }

  async function submitTask() {
    const orderId = taskDraft.orderId || selectedOrderOptions[0]?.id || '';
    const order = orders.find((entry) => entry.id === orderId);
    if (!order || !taskDraft.title.trim()) return setMessage('חסר הזמנה או כותרת משימה.');
    await onCreateTask({
      title: taskDraft.title.trim(),
      projectId: 'sales',
      domainId: 'sales',
      bucket: taskDraft.dueDate === todayISO ? 'today' : 'backlog',
      date: taskDraft.dueDate,
      originalDate: taskDraft.dueDate,
      scheduledTimeLabel: taskDraft.dueDate === todayISO ? 'היום' : taskDraft.dueDate,
      estimatedDurationMinutes: 15,
      durationLabel: '15 דק׳',
      priority: 'medium',
      effort: 'medium',
      isQuickWin: false,
      isRecurring: false,
      recurrenceDefinitionId: null,
      backlogGroup: taskDraft.dueDate === todayISO ? null : 'this_week',
      tags: ['sales', 'order'],
      whyNow: `משימה להזמנה: ${order.title}`,
      notes: undefined,
      aiConversationUrl: null,
      statusOverride: null,
      movedToDate: null,
      completedAt: null,
      cancelledAt: null,
      customerId: order.customerId,
      orderId: order.id,
      subtasks: [{ title: taskDraft.title.trim(), domainId: 'sales' }],
    });
    setTaskDraft({ orderId, title: '', dueDate: todayISO });
    setMessage('משימה להזמנה נוצרה.');
  }

  return (
    <div className="space-y-5">
      <SectionCard title="לקוחות והזמנות" description="ניהול ידני של לקוחות אחרי פגישה, הזמנות, ביקוש, ייצור והקצאות.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="לקוחות" value={customers.length} tone="sky" />
          <Metric label="הזמנות פתוחות" value={openOrderCount} tone="violet" />
          <Metric label="תחזית יחידות" value={forecastDemand} tone="amber" />
          <Metric label="חסר הקצאה" value={missingItems.reduce((sum, row) => sum + row.missing, 0)} tone="rose" />
        </div>
        {message ? <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">{message}</p> : null}
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
        <SectionCard title="לקוח חדש" description="רק מי שכבר הגיע לפגישה נכנס לכאן.">
          <div className="grid gap-2">
            <input className={inputClass()} placeholder="שם לקוח / מרפאה" value={customerDraft.name} onChange={(e) => setCustomerDraft({ ...customerDraft, name: e.target.value })} />
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inputClass()} placeholder="חברה" value={customerDraft.company} onChange={(e) => setCustomerDraft({ ...customerDraft, company: e.target.value })} />
              <input className={inputClass()} placeholder="מדינה" value={customerDraft.country} onChange={(e) => setCustomerDraft({ ...customerDraft, country: e.target.value })} />
              <input className={inputClass()} placeholder="עיר" value={customerDraft.city} onChange={(e) => setCustomerDraft({ ...customerDraft, city: e.target.value })} />
              <input className={inputClass()} placeholder="WhatsApp" value={customerDraft.whatsapp} onChange={(e) => setCustomerDraft({ ...customerDraft, whatsapp: e.target.value })} />
            </div>
            <input className={inputClass()} placeholder="Email" value={customerDraft.email} onChange={(e) => setCustomerDraft({ ...customerDraft, email: e.target.value })} />
            <textarea className={inputClass('min-h-20')} placeholder="הערות פגישה" value={customerDraft.notes} onChange={(e) => setCustomerDraft({ ...customerDraft, notes: e.target.value })} />
            <button className={buttonClass('dark')} disabled={isSaving} onClick={() => void submitCustomer()}>הוסף לקוח</button>
          </div>
        </SectionCard>

        <SectionCard title="לקוחות" description="בחר לקוח כדי לפתוח הזמנות ופעולות.">
          <div className="grid gap-2">
            {customers.length === 0 ? <p className="text-sm font-bold text-slate-500">אין לקוחות עדיין.</p> : customers.map((customer) => {
              const customerOrders = visibleOrders.filter((order) => order.customerId === customer.id);
              return (
                <button key={customer.id} type="button" onClick={() => setSelectedCustomerId(customer.id)} className={`rounded-2xl px-3 py-2 text-right ring-1 transition ${selectedCustomer?.id === customer.id ? 'bg-sky-50 ring-sky-200' : 'bg-white ring-slate-200 hover:bg-slate-50'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-base font-black text-slate-950">{customer.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{customerStatusLabels[customer.status]}</span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-500">{customer.country || 'ללא מדינה'} · {customerOrders.length} הזמנות</p>
                </button>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <SectionCard title={selectedCustomer ? `הזמנות - ${selectedCustomer.name}` : 'הזמנות'} description="הזמנה יכולה להיות פוטנציאלית או מאושרת.">
          {selectedCustomer ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={inputClass()} placeholder="שם הזמנה" value={orderDraft.title} onChange={(e) => setOrderDraft({ ...orderDraft, title: e.target.value })} />
                <select className={inputClass()} value={orderDraft.status} onChange={(e) => setOrderDraft({ ...orderDraft, status: e.target.value as OrderStatus })}>
                  {Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select className={inputClass()} value={orderDraft.source} onChange={(e) => setOrderDraft({ ...orderDraft, source: e.target.value as OrderSource })}>
                  {Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input className={inputClass()} type="date" value={orderDraft.dueDate} onChange={(e) => setOrderDraft({ ...orderDraft, dueDate: e.target.value })} />
                <input className={inputClass()} placeholder="סכום" value={orderDraft.amount} onChange={(e) => setOrderDraft({ ...orderDraft, amount: e.target.value })} />
                <input className={inputClass()} placeholder="מטבע" value={orderDraft.currency} onChange={(e) => setOrderDraft({ ...orderDraft, currency: e.target.value })} />
              </div>
              <textarea className={inputClass('min-h-16')} placeholder="הערות הזמנה" value={orderDraft.notes} onChange={(e) => setOrderDraft({ ...orderDraft, notes: e.target.value })} />
              <button className={buttonClass('green')} disabled={isSaving} onClick={() => void submitOrder()}>הוסף הזמנה</button>

              <div className="space-y-2">
                {selectedOrders.length === 0 ? <p className="text-sm font-bold text-slate-500">אין הזמנות ללקוח הזה.</p> : selectedOrders.map((order) => (
                  <div key={order.id} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-slate-950">{order.title}</strong>
                      <select className={inputClass('py-1 text-xs')} value={order.status} onChange={(e) => void onEditSalesOrder(order.id, { status: e.target.value as OrderStatus })}>
                        {Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-500">{sourceLabels[order.source]} · {formatMoney(order.amount, order.currency)} · יעד {order.dueDate || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm font-bold text-slate-500">בחר לקוח קודם.</p>}
        </SectionCard>

        <SectionCard title="פריט הזמנה" description="מוצר, צבע, כמות, מחיר ומדבקה כאופציה.">
          <div className="grid gap-2">
            <select className={inputClass()} value={itemDraft.orderId} onChange={(e) => setItemDraft({ ...itemDraft, orderId: e.target.value })}>
              <option value="">בחר הזמנה</option>
              {selectedOrderOptions.map((order) => <option key={order.id} value={order.id}>{order.title}</option>)}
            </select>
            <div className="grid gap-2 sm:grid-cols-2">
              <select className={inputClass()} value={itemDraft.productId} onChange={(e) => setItemDraft({ ...itemDraft, productId: e.target.value })}>
                <option value="">בחר מוצר</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
              <select className={inputClass()} value={itemDraft.color} onChange={(e) => setItemDraft({ ...itemDraft, color: e.target.value as ProductColor })}>
                {colors.map((color) => <option key={color} value={color}>{colorLabels[color]}</option>)}
              </select>
              <input className={inputClass()} placeholder="כמות" value={itemDraft.quantity} onChange={(e) => setItemDraft({ ...itemDraft, quantity: e.target.value })} />
              <input className={inputClass()} placeholder="מחיר יחידה" value={itemDraft.unitPrice} onChange={(e) => setItemDraft({ ...itemDraft, unitPrice: e.target.value })} />
              <select className={inputClass()} value={itemDraft.priceTier} onChange={(e) => setItemDraft({ ...itemDraft, priceTier: e.target.value as PriceTier })}>
                {priceTiers.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
              </select>
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200">
                מדבקה
                <input type="checkbox" checked={itemDraft.needsSticker} onChange={(e) => setItemDraft({ ...itemDraft, needsSticker: e.target.checked })} />
              </label>
            </div>
            {itemDraft.needsSticker ? (
              <select className={inputClass()} value={itemDraft.stickerSupplierId} onChange={(e) => setItemDraft({ ...itemDraft, stickerSupplierId: e.target.value })}>
                <option value="">ספק מדבקות</option>
                {stickerSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            ) : null}
            <button className={buttonClass('dark')} disabled={isSaving} onClick={() => void submitItem()}>הוסף פריט להזמנה</button>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="מוצרים וספקים" description="קטלוג ידני בסיסי. Shopify יגיע אחר כך.">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="text-sm font-black text-slate-900">מוצר חדש</p>
              <input className={inputClass()} placeholder="שם מוצר" value={productDraft.name} onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })} />
              <input className={inputClass()} placeholder="SKU" value={productDraft.sku} onChange={(e) => setProductDraft({ ...productDraft, sku: e.target.value })} />
              <button className={buttonClass('light')} onClick={() => void submitProduct()}>הוסף מוצר</button>
            </div>
            <div className="space-y-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="text-sm font-black text-slate-900">ספק חדש</p>
              <input className={inputClass()} placeholder="שם ספק" value={supplierDraft.name} onChange={(e) => setSupplierDraft({ ...supplierDraft, name: e.target.value })} />
              <select className={inputClass()} value={supplierDraft.type} onChange={(e) => setSupplierDraft({ ...supplierDraft, type: e.target.value as SupplierType })}>
                {Object.entries(supplierTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button className={buttonClass('light')} onClick={() => void submitSupplier()}>הוסף ספק</button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="סבב ייצור" description="סבב אחד = מוצר אחד + צבע אחד.">
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={inputClass()} value={batchDraft.productId} onChange={(e) => setBatchDraft({ ...batchDraft, productId: e.target.value })}>
              <option value="">מוצר</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <select className={inputClass()} value={batchDraft.color} onChange={(e) => setBatchDraft({ ...batchDraft, color: e.target.value as ProductColor })}>
              {colors.map((color) => <option key={color} value={color}>{colorLabels[color]}</option>)}
            </select>
            <select className={inputClass()} value={batchDraft.supplierId} onChange={(e) => setBatchDraft({ ...batchDraft, supplierId: e.target.value })}>
              <option value="">ספק ייצור</option>
              {productionSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            <input className={inputClass()} placeholder="שם סבב" value={batchDraft.label} onChange={(e) => setBatchDraft({ ...batchDraft, label: e.target.value })} />
            <input className={inputClass()} placeholder="כמות מתוכננת" value={batchDraft.quantityPlanned} onChange={(e) => setBatchDraft({ ...batchDraft, quantityPlanned: e.target.value })} />
            <input className={inputClass()} type="date" value={batchDraft.expectedReadyDate} onChange={(e) => setBatchDraft({ ...batchDraft, expectedReadyDate: e.target.value })} />
          </div>
          <button className={`${buttonClass('green')} mt-2`} onClick={() => void submitBatch()}>הוסף סבב ייצור</button>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="ביקוש והקצאות" description="אדום = אין הקצאה, כתום = חלקי, ירוק = מכוסה.">
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <Metric label="מחייב" value={confirmedDemand} tone="emerald" />
            <Metric label="מוקצה" value={allocatedDemand} tone="sky" />
            <Metric label="שורות חסרות" value={missingItems.length} tone="rose" />
          </div>
          <div className="space-y-2">
            {openItems.length === 0 ? <p className="text-sm font-bold text-slate-500">אין פריטי הזמנה פתוחים.</p> : openItems.map(({ item, order, customer, product, allocated, missing }) => (
              <div key={item.id} className={`rounded-2xl p-3 ring-1 ${allocationTone(item.quantity, allocated)}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{customer?.name ?? 'לקוח'} · {product?.name ?? 'מוצר'} · {colorLabels[item.color]}</strong>
                  <span className="text-sm font-black">{allocated}/{item.quantity} מוקצה</span>
                </div>
                <p className="mt-1 text-xs font-bold opacity-80">{order?.title ?? 'הזמנה'} · חסר {missing} · {item.needsSticker ? 'כולל מדבקה' : 'בלי מדבקה'}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="הקצאה ידנית" description="בחר פריט הזמנה וסבב ייצור מתאים.">
          <div className="grid gap-2">
            <select className={inputClass()} value={allocationDraft.orderItemId} onChange={(e) => setAllocationDraft({ ...allocationDraft, orderItemId: e.target.value })}>
              <option value="">פריט הזמנה חסר</option>
              {missingItems.map(({ item, customer, product, missing }) => <option key={item.id} value={item.id}>{customer?.name} · {product?.name} · {colorLabels[item.color]} · חסר {missing}</option>)}
            </select>
            <select className={inputClass()} value={allocationDraft.productionBatchId} onChange={(e) => setAllocationDraft({ ...allocationDraft, productionBatchId: e.target.value })}>
              <option value="">סבב ייצור</option>
              {productionBatches.map((batch) => {
                const product = products.find((entry) => entry.id === batch.productId);
                const allocated = getBatchAllocatedQuantity(batch.id, allocations);
                const capacity = batch.quantityReceived ?? batch.quantityPlanned;
                return <option key={batch.id} value={batch.id}>{batch.label} · {product?.name} · {colorLabels[batch.color]} · פנוי {Math.max(0, capacity - allocated)}</option>;
              })}
            </select>
            <input className={inputClass()} placeholder="כמות להקצאה" value={allocationDraft.quantity} onChange={(e) => setAllocationDraft({ ...allocationDraft, quantity: e.target.value })} />
            <button className={buttonClass('dark')} onClick={() => void submitAllocation()}>הקצה מלאי</button>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="משימות להזמנה" description="המשימה תופיע גם במסך המשימות הרגיל וגם תחת ההזמנה.">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <select className={inputClass()} value={taskDraft.orderId} onChange={(e) => setTaskDraft({ ...taskDraft, orderId: e.target.value })}>
            <option value="">בחר הזמנה</option>
            {selectedOrderOptions.map((order) => <option key={order.id} value={order.id}>{order.title}</option>)}
          </select>
          <input className={inputClass()} placeholder="מה צריך לעשות?" value={taskDraft.title} onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })} />
          <input className={inputClass()} type="date" value={taskDraft.dueDate} onChange={(e) => setTaskDraft({ ...taskDraft, dueDate: e.target.value })} />
        </div>
        <button className={`${buttonClass('green')} mt-2`} onClick={() => void submitTask()}>צור משימה להזמנה</button>
        <div className="mt-3 grid gap-2">
          {tasks.filter((task) => task.orderId && selectedOrderOptions.some((order) => order.id === task.orderId)).slice(0, 6).map((task) => (
            <div key={task.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200">{task.title}</div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'sky' | 'violet' | 'amber' | 'rose' | 'emerald' }) {
  const classes: Record<typeof tone, string> = {
    sky: 'bg-sky-50 text-sky-900 ring-sky-100',
    violet: 'bg-violet-50 text-violet-900 ring-violet-100',
    amber: 'bg-amber-50 text-amber-900 ring-amber-100',
    rose: 'bg-rose-50 text-rose-900 ring-rose-100',
    emerald: 'bg-emerald-50 text-emerald-900 ring-emerald-100',
  };
  return (
    <div className={`rounded-2xl px-4 py-3 ring-1 ${classes[tone]}`}>
      <p className="text-xs font-black opacity-70">{label}</p>
      <p className="text-2xl font-black tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
