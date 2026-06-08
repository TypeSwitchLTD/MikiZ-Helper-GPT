import { db } from '../../db/db';
import { createId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { createLogEvent } from '../logs/logService';
import type {
  Allocation,
  Customer,
  OrderItem,
  Product,
  ProductionBatch,
  SalesOrder,
  Supplier,
} from './salesTypes';

type Timestamped<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

async function logSalesChange(message: string, metadata?: Record<string, unknown>) {
  await createLogEvent({
    type: 'note_added',
    entityType: 'system',
    entityId: null,
    message,
    metadata: { source: 'sales_ops', ...metadata },
  });
}

export async function createCustomer(input: Timestamped<Customer>): Promise<Customer> {
  const timestamp = nowISO();
  const customer: Customer = { ...input, id: createId('customer'), createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
  await db.transaction('rw', db.customers, db.logs, async () => {
    await db.customers.add(customer);
    await logSalesChange(`Customer created: ${customer.name}`, { customerId: customer.id });
  });
  return customer;
}

export async function updateCustomer(customerId: string, patch: Partial<Customer>): Promise<void> {
  await db.transaction('rw', db.customers, db.logs, async () => {
    await db.customers.update(customerId, { ...patch, updatedAt: nowISO() });
    await logSalesChange('Customer updated', { customerId, patch });
  });
}

export async function createProduct(input: Timestamped<Product>): Promise<Product> {
  const timestamp = nowISO();
  const product: Product = { ...input, id: createId('product'), createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
  await db.transaction('rw', db.products, db.logs, async () => {
    await db.products.add(product);
    await logSalesChange(`Product created: ${product.name}`, { productId: product.id });
  });
  return product;
}

export async function createSupplier(input: Timestamped<Supplier>): Promise<Supplier> {
  const timestamp = nowISO();
  const supplier: Supplier = { ...input, id: createId('supplier'), createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
  await db.transaction('rw', db.suppliers, db.logs, async () => {
    await db.suppliers.add(supplier);
    await logSalesChange(`Supplier created: ${supplier.name}`, { supplierId: supplier.id });
  });
  return supplier;
}

export async function createSalesOrder(input: Timestamped<SalesOrder>): Promise<SalesOrder> {
  const timestamp = nowISO();
  const order: SalesOrder = { ...input, id: createId('order'), createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
  await db.transaction('rw', db.orders, db.logs, async () => {
    await db.orders.add(order);
    await logSalesChange(`Order created: ${order.title}`, { orderId: order.id, customerId: order.customerId });
  });
  return order;
}

export async function updateSalesOrder(orderId: string, patch: Partial<SalesOrder>): Promise<void> {
  await db.transaction('rw', db.orders, db.logs, async () => {
    await db.orders.update(orderId, { ...patch, updatedAt: nowISO() });
    await logSalesChange('Order updated', { orderId, patch });
  });
}

export async function createOrderItem(input: Timestamped<OrderItem>): Promise<OrderItem> {
  const timestamp = nowISO();
  const item: OrderItem = { ...input, id: createId('order-item'), createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
  await db.transaction('rw', db.orderItems, db.logs, async () => {
    await db.orderItems.add(item);
    await logSalesChange('Order item created', { orderItemId: item.id, orderId: item.orderId, productId: item.productId });
  });
  return item;
}

export async function createProductionBatch(input: Timestamped<ProductionBatch>): Promise<ProductionBatch> {
  const timestamp = nowISO();
  const batch: ProductionBatch = { ...input, id: createId('batch'), createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
  await db.transaction('rw', db.productionBatches, db.logs, async () => {
    await db.productionBatches.add(batch);
    await logSalesChange(`Production batch created: ${batch.label}`, { productionBatchId: batch.id, productId: batch.productId });
  });
  return batch;
}

export async function createAllocation(input: Timestamped<Allocation>): Promise<Allocation> {
  const timestamp = nowISO();
  const allocation: Allocation = { ...input, id: createId('allocation'), createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
  await db.transaction('rw', db.allocations, db.logs, async () => {
    await db.allocations.add(allocation);
    await logSalesChange('Allocation created', { allocationId: allocation.id, orderItemId: allocation.orderItemId, productionBatchId: allocation.productionBatchId });
  });
  return allocation;
}
