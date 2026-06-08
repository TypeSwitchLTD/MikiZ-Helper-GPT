import Dexie, { type Table } from 'dexie';
import type { DailyPlan } from '../domain/dailyPlans/dailyPlanTypes';
import type { FocusItem } from '../domain/focus/focusTypes';
import type { LogEvent } from '../domain/logs/logTypes';
import type { RecurringTaskDefinition } from '../domain/recurring/recurringTypes';
import type { DailyReport } from '../domain/reports/reportTypes';
import type { Reminder } from '../domain/reminders/reminderTypes';
import type { AppSettings } from '../domain/settings/settingsTypes';
import type { Subtask, Task } from '../domain/tasks/taskTypes';
import type { DailyHabit, DailyHabitLog } from '../domain/habits/habitTypes';
import type { Allocation, Customer, OrderItem, Product, ProductionBatch, SalesOrder, Supplier } from '../domain/sales/salesTypes';
import { createDefaultSettings } from '../domain/settings/defaultSettings';
import { createSeedData } from './seed';
import { APP_VERSION, DATABASE_NAME, type BackupSnapshot } from './schema';
import { createId } from '../utils/ids';
import { nowISO, getTodayISO } from '../utils/dates';
import { prepareSubtaskForImport, prepareTaskForImport, type ImportMergeOptions } from './importMerge';
import { mergeImportedSettingsPreservingLocalSecrets } from './settingsMerge';

export class MissionControlDatabase extends Dexie {
  tasks!: Table<Task, string>;
  subtasks!: Table<Subtask, string>;
  dailyPlans!: Table<DailyPlan, string>;
  recurringDefinitions!: Table<RecurringTaskDefinition, string>;
  reports!: Table<DailyReport, string>;
  logs!: Table<LogEvent, string>;
  reminders!: Table<Reminder, string>;
  settings!: Table<AppSettings, 'default'>;
  snapshots!: Table<BackupSnapshot, string>;
  habits!: Table<DailyHabit, string>;
  habitLogs!: Table<DailyHabitLog, string>;
  focusItems!: Table<FocusItem, string>;
  customers!: Table<Customer, string>;
  products!: Table<Product, string>;
  suppliers!: Table<Supplier, string>;
  orders!: Table<SalesOrder, string>;
  orderItems!: Table<OrderItem, string>;
  productionBatches!: Table<ProductionBatch, string>;
  allocations!: Table<Allocation, string>;

  constructor() {
    super(DATABASE_NAME);

    this.version(1).stores({
      tasks: 'id, bucket, date, projectId, domainId, originalDate, movedToDate, createdAt, updatedAt',
      subtasks: 'id, taskId, status, sortOrder, createdAt, updatedAt',
      dailyPlans: 'id, date, createdAt, updatedAt',
      recurringDefinitions: 'id, isActive, frequency, projectId, domainId, createdAt, updatedAt',
      reports: 'id, date, generatedAt, createdAt, updatedAt',
      logs: 'id, timestamp, type, entityType, entityId',
      settings: 'id',
      snapshots: 'id, createdAt, reason',
    });

    this.version(2).stores({
      tasks: 'id, bucket, date, projectId, domainId, originalDate, movedToDate, createdAt, updatedAt',
      subtasks: 'id, taskId, status, sortOrder, createdAt, updatedAt',
      dailyPlans: 'id, date, createdAt, updatedAt',
      recurringDefinitions: 'id, isActive, frequency, projectId, domainId, createdAt, updatedAt',
      reports: 'id, date, generatedAt, createdAt, updatedAt',
      logs: 'id, timestamp, type, entityType, entityId',
      reminders: 'id, remindAt, taskId, subtaskId, status, createdAt, updatedAt',
      settings: 'id',
      snapshots: 'id, createdAt, reason',
    });

    this.version(3).stores({
      tasks: 'id, bucket, date, projectId, domainId, originalDate, movedToDate, focusOrder, createdAt, updatedAt',
      subtasks: 'id, taskId, status, sortOrder, createdAt, updatedAt',
      dailyPlans: 'id, date, createdAt, updatedAt',
      recurringDefinitions: 'id, isActive, frequency, projectId, domainId, createdAt, updatedAt',
      reports: 'id, date, generatedAt, createdAt, updatedAt',
      logs: 'id, timestamp, type, entityType, entityId',
      reminders: 'id, remindAt, taskId, subtaskId, status, createdAt, updatedAt',
      settings: 'id',
      snapshots: 'id, createdAt, reason',
    }).upgrade(async (tx) => {
      // Defensive migration for users who already opened a partially-upgraded DB.
      // Dexie creates missing stores from the schema above; this block only records
      // that the migration happened and avoids touching user data.
      try {
        const logs = tx.table('logs');
        await logs.add({
          id: createId('log'),
          timestamp: nowISO(),
          type: 'note_added',
          entityType: 'system',
          entityId: null,
          message: 'Database migrated to 0.5.8 schema with reminders/snapshots safety',
          metadata: { appVersion: APP_VERSION, migration: 'v3' },
        });
      } catch {
        // Logging must never block opening the local database.
      }
    });

    this.version(4).stores({
      tasks: 'id, bucket, date, projectId, domainId, originalDate, movedToDate, focusOrder, createdAt, updatedAt',
      subtasks: 'id, taskId, status, sortOrder, createdAt, updatedAt',
      dailyPlans: 'id, date, createdAt, updatedAt',
      recurringDefinitions: 'id, isActive, frequency, projectId, domainId, createdAt, updatedAt',
      reports: 'id, date, generatedAt, createdAt, updatedAt',
      logs: 'id, timestamp, type, entityType, entityId',
      reminders: 'id, remindAt, taskId, subtaskId, status, createdAt, updatedAt',
      settings: 'id',
      snapshots: 'id, createdAt, reason',
    }).upgrade(async (tx) => {
      try {
        await tx.table('logs').add({
          id: createId('log'), timestamp: nowISO(), type: 'note_added',
          entityType: 'system', entityId: null,
          message: 'Database repaired to 0.5.9 schema',
          metadata: { appVersion: APP_VERSION, migration: 'v4-repair' },
        });
      } catch { /* never block db open */ }
    });

    this.version(5).stores({
      tasks: 'id, bucket, date, projectId, domainId, originalDate, movedToDate, focusOrder, createdAt, updatedAt',
      subtasks: 'id, taskId, status, sortOrder, createdAt, updatedAt',
      dailyPlans: 'id, date, createdAt, updatedAt',
      recurringDefinitions: 'id, isActive, frequency, projectId, domainId, createdAt, updatedAt',
      reports: 'id, date, generatedAt, createdAt, updatedAt',
      logs: 'id, timestamp, type, entityType, entityId',
      reminders: 'id, remindAt, taskId, subtaskId, status, createdAt, updatedAt',
      settings: 'id',
      snapshots: 'id, createdAt, reason',
      habits: 'id, active, order, createdAt, updatedAt',
      habitLogs: 'id, habitId, date, createdAt',
    }).upgrade(async (tx) => {
      try {
        await tx.table('logs').add({
          id: createId('log'), timestamp: nowISO(), type: 'note_added',
          entityType: 'system', entityId: null,
          message: 'Database migrated to 0.7.2 — added habits + habitLogs tables',
          metadata: { appVersion: APP_VERSION, migration: 'v5-habits' },
        });
      } catch { /* never block db open */ }
    });

    this.version(6).stores({
      tasks: 'id, bucket, date, projectId, domainId, originalDate, movedToDate, focusOrder, createdAt, updatedAt',
      subtasks: 'id, taskId, status, sortOrder, createdAt, updatedAt',
      dailyPlans: 'id, date, createdAt, updatedAt',
      recurringDefinitions: 'id, isActive, frequency, projectId, domainId, createdAt, updatedAt',
      reports: 'id, date, generatedAt, createdAt, updatedAt',
      logs: 'id, timestamp, type, entityType, entityId',
      reminders: 'id, remindAt, taskId, subtaskId, status, createdAt, updatedAt',
      settings: 'id',
      snapshots: 'id, createdAt, reason',
      habits: 'id, active, order, createdAt, updatedAt',
      habitLogs: 'id, habitId, date, [habitId+date], createdAt',
    });

    this.version(7).stores({
      tasks: 'id, bucket, date, projectId, domainId, originalDate, movedToDate, focusOrder, createdAt, updatedAt',
      subtasks: 'id, taskId, status, sortOrder, createdAt, updatedAt',
      dailyPlans: 'id, date, createdAt, updatedAt',
      recurringDefinitions: 'id, isActive, frequency, projectId, domainId, createdAt, updatedAt',
      reports: 'id, date, generatedAt, createdAt, updatedAt',
      logs: 'id, timestamp, type, entityType, entityId',
      reminders: 'id, remindAt, taskId, subtaskId, status, createdAt, updatedAt',
      settings: 'id',
      snapshots: 'id, createdAt, reason',
      habits: 'id, active, order, createdAt, updatedAt',
      habitLogs: 'id, habitId, date, [habitId+date], createdAt',
      focusItems: 'id, targetType, taskId, subtaskId, sortOrder, addedAt, updatedAt, deletedAt, completedAt',
    }).upgrade(async (tx) => {
      try {
        await tx.table('logs').add({
          id: createId('log'), timestamp: nowISO(), type: 'note_added',
          entityType: 'system', entityId: null,
          message: 'Database migrated to 0.8.14 - added focus deck',
          metadata: { appVersion: APP_VERSION, migration: 'v7-focus-items' },
        });
      } catch { /* never block db open */ }
    });

    this.version(8).stores({
      tasks: 'id, bucket, date, projectId, domainId, originalDate, movedToDate, focusOrder, customerId, orderId, createdAt, updatedAt',
      subtasks: 'id, taskId, status, sortOrder, createdAt, updatedAt',
      dailyPlans: 'id, date, createdAt, updatedAt',
      recurringDefinitions: 'id, isActive, frequency, projectId, domainId, createdAt, updatedAt',
      reports: 'id, date, generatedAt, createdAt, updatedAt',
      logs: 'id, timestamp, type, entityType, entityId',
      reminders: 'id, remindAt, taskId, subtaskId, status, createdAt, updatedAt',
      settings: 'id',
      snapshots: 'id, createdAt, reason',
      habits: 'id, active, order, createdAt, updatedAt',
      habitLogs: 'id, habitId, date, [habitId+date], createdAt',
      focusItems: 'id, targetType, taskId, subtaskId, sortOrder, addedAt, updatedAt, deletedAt, completedAt',
      customers: 'id, status, country, createdAt, updatedAt, deletedAt',
      products: 'id, active, createdAt, updatedAt, deletedAt',
      suppliers: 'id, type, country, createdAt, updatedAt, deletedAt',
      orders: 'id, customerId, status, source, expectedCloseDate, dueDate, createdAt, updatedAt, deletedAt',
      orderItems: 'id, orderId, productId, color, createdAt, updatedAt, deletedAt',
      productionBatches: 'id, productId, color, supplierId, status, expectedReadyDate, createdAt, updatedAt, deletedAt',
      allocations: 'id, orderItemId, productionBatchId, createdAt, updatedAt, deletedAt',
    }).upgrade(async (tx) => {
      try {
        await tx.table('logs').add({
          id: createId('log'), timestamp: nowISO(), type: 'note_added',
          entityType: 'system', entityId: null,
          message: 'Database migrated to 0.8.22 - added customers, orders, inventory and allocations',
          metadata: { appVersion: APP_VERSION, migration: 'v8-sales-ops' },
        });
      } catch { /* never block db open */ }
    });
  }
}

export const db = new MissionControlDatabase();

let initializationPromise: Promise<void> | null = null;

export async function initializeLocalDatabase(): Promise<void> {
  initializationPromise ??= seedDatabaseIfNeeded().catch((err) => {
    initializationPromise = null; // allow retry on next load
    console.warn('[DB] Seed step failed (non-fatal):', err instanceof Error ? err.message : err);
  });
  return initializationPromise;
}

async function seedDatabaseIfNeeded(): Promise<void> {
  const existingSettings = await db.settings.get('default');
  const settings = existingSettings ?? createDefaultSettings();
  const seed = createSeedData(settings);
  const timestamp = nowISO();

  await db.transaction(
    'rw',
    [db.settings, db.tasks, db.subtasks, db.dailyPlans, db.recurringDefinitions, db.reports, db.logs, db.snapshots, db.reminders, db.focusItems, db.customers, db.products, db.suppliers, db.orders, db.orderItems, db.productionBatches, db.allocations],
    async () => {
      await db.settings.put(settings);

      const [taskCount, subtaskCount, dailyPlanCount, recurringCount] = await Promise.all([
        db.tasks.count(),
        db.subtasks.count(),
        db.dailyPlans.count(),
        db.recurringDefinitions.count(),
      ]);

      let importedSeed = false;

      if (taskCount === 0) {
        await db.tasks.bulkPut(seed.tasks);
        importedSeed = true;
      }

      if (subtaskCount === 0) {
        await db.subtasks.bulkPut(seed.subtasks);
        importedSeed = true;
      }

      if (dailyPlanCount === 0) {
        await db.dailyPlans.bulkPut(seed.dailyPlans);
        importedSeed = true;
      }

      if (recurringCount === 0) {
        await db.recurringDefinitions.bulkPut(seed.recurringDefinitions);
        importedSeed = true;
      }

      if (taskCount > 0) {
        const snapshots = await db.snapshots.toArray();
        const hasCurrentVersionSnapshot = snapshots.some((snapshot) => snapshot.reason === 'app_update' && snapshot.appVersion === APP_VERSION);
        if (!hasCurrentVersionSnapshot) {
          const [tasks, subtasks, dailyPlans, recurringDefinitions, reports, logs, reminders, habits, habitLogs, focusItems, customers, products, suppliers, orders, orderItems, productionBatches, allocations] = await Promise.all([
            db.tasks.toArray(),
            db.subtasks.toArray(),
            db.dailyPlans.toArray(),
            db.recurringDefinitions.toArray(),
            db.reports.toArray(),
            db.logs.toArray(),
            db.reminders.toArray(),
            db.habits.toArray(),
            db.habitLogs.toArray(),
            db.focusItems.toArray(),
            db.customers.toArray(),
            db.products.toArray(),
            db.suppliers.toArray(),
            db.orders.toArray(),
            db.orderItems.toArray(),
            db.productionBatches.toArray(),
            db.allocations.toArray(),
          ]);
          await db.snapshots.add({
            id: createId('snapshot'),
            createdAt: timestamp,
            reason: 'app_update',
            appVersion: APP_VERSION,
            data: { tasks, subtasks, dailyPlans, recurringDefinitions, reports, logs, reminders, habits, habitLogs, focusItems, customers, products, suppliers, orders, orderItems, productionBatches, allocations, settings },
          });
        }
      }

      if (importedSeed) {
        await db.logs.add({
          id: createId('log'),
          timestamp,
          type: 'note_added',
          entityType: 'system',
          entityId: null,
          message: 'Initial seed data imported or repaired',
          metadata: { appVersion: APP_VERSION },
        });
        await db.snapshots.add({
          id: createId('snapshot'),
          createdAt: timestamp,
          reason: 'seed',
          appVersion: APP_VERSION,
          data: {
            tasks: seed.tasks,
            subtasks: seed.subtasks,
            dailyPlans: seed.dailyPlans,
            recurringDefinitions: seed.recurringDefinitions,
            reports: [],
            logs: [],
            reminders: [],
            habits: [],
            habitLogs: [],
            focusItems: [],
            customers: [],
            products: [],
            suppliers: [],
            orders: [],
            orderItems: [],
            productionBatches: [],
            allocations: [],
            settings,
          },
        });
      }
    },
  );
}

interface GetAllLocalDataOptions {
  includeDeleted?: boolean;
}

export async function getAllLocalData(options: GetAllLocalDataOptions = {}) {
  const [rawTasks, subtasks, dailyPlans, recurringDefinitions, reports, logs, reminders, settings, habits, habitLogs, focusItems, customers, products, suppliers, orders, orderItems, productionBatches, allocations] = await Promise.all([
    db.tasks.orderBy('createdAt').toArray(),
    db.subtasks.orderBy('sortOrder').toArray(),
    db.dailyPlans.orderBy('date').toArray(),
    db.recurringDefinitions.orderBy('createdAt').toArray(),
    db.reports.orderBy('createdAt').reverse().toArray(),
    db.logs.orderBy('timestamp').reverse().limit(50).toArray(),
    db.reminders.orderBy('remindAt').toArray(),
    db.settings.get('default'),
    db.habits.orderBy('order').toArray(),
    db.habitLogs.orderBy('date').toArray(),
    db.focusItems.orderBy('sortOrder').toArray(),
    db.customers.orderBy('createdAt').toArray(),
    db.products.orderBy('createdAt').toArray(),
    db.suppliers.orderBy('createdAt').toArray(),
    db.orders.orderBy('createdAt').toArray(),
    db.orderItems.orderBy('createdAt').toArray(),
    db.productionBatches.orderBy('createdAt').toArray(),
    db.allocations.orderBy('createdAt').toArray(),
  ]);

  const allTasks = rawTasks.map(normalizeTask);
  const tasks = options.includeDeleted ? allTasks : allTasks.filter((task) => !task.deletedAt);
  const visibleTaskIds = new Set(tasks.map((task) => task.id));
  const visibleSubtasks = options.includeDeleted
    ? subtasks
    : subtasks.filter((subtask) => !subtask.deletedAt && visibleTaskIds.has(subtask.taskId));

  return {
    tasks,
    subtasks: visibleSubtasks,
    dailyPlans,
    recurringDefinitions,
    reports,
    logs,
    reminders,
    focusItems: options.includeDeleted ? focusItems : focusItems.filter((item) => !item.deletedAt),
    customers: options.includeDeleted ? customers : customers.filter((item) => !item.deletedAt),
    products: options.includeDeleted ? products : products.filter((item) => !item.deletedAt),
    suppliers: options.includeDeleted ? suppliers : suppliers.filter((item) => !item.deletedAt),
    orders: options.includeDeleted ? orders : orders.filter((item) => !item.deletedAt),
    orderItems: options.includeDeleted ? orderItems : orderItems.filter((item) => !item.deletedAt),
    productionBatches: options.includeDeleted ? productionBatches : productionBatches.filter((item) => !item.deletedAt),
    allocations: options.includeDeleted ? allocations : allocations.filter((item) => !item.deletedAt),
    settings: settings ?? createDefaultSettings(),
    habits,
    habitLogs,
  };
}


interface DailyStateImportPayload {
  schemaVersion?: string;
  exportedAt?: string;
  appVersion?: string;
  date?: string;
  tasks?: Task[];
  subtasks?: Subtask[];
  dailyPlans?: DailyPlan[];
  recurringDefinitions?: RecurringTaskDefinition[];
  reports?: DailyReport[];
  logs?: LogEvent[];
  reminders?: Reminder[];
  focusItems?: FocusItem[];
  habits?: DailyHabit[];
  habitLogs?: DailyHabitLog[];
  customers?: Customer[];
  products?: Product[];
  suppliers?: Supplier[];
  orders?: SalesOrder[];
  orderItems?: OrderItem[];
  productionBatches?: ProductionBatch[];
  allocations?: Allocation[];
  settings?: AppSettings | null;
}

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function mergeByUpdatedAt<T extends { id: string; updatedAt?: string; deletedAt?: string | null }>(incoming: T, existing: T | undefined): T {
  if (!existing) return incoming;
  if (existing.deletedAt && !incoming.deletedAt) return existing;
  if (incoming.deletedAt && !existing.deletedAt) return incoming;
  const existingTime = Date.parse(existing.updatedAt ?? '') || 0;
  const incomingTime = Date.parse(incoming.updatedAt ?? '') || 0;
  return existingTime > incomingTime ? existing : incoming;
}

/** Ensure required array/string fields exist on every task coming from cloud/import */
function normalizeTask(task: Task): Task {
  return {
    ...task,
    tags: Array.isArray(task.tags) ? task.tags : [],
    projectId: task.projectId ?? '',
    domainId: task.domainId ?? '',
    notes: task.notes ?? '',
    whyNow: task.whyNow ?? '',
  };
}

export async function importDailyStatePayload(
  payload: DailyStateImportPayload,
  options: ImportMergeOptions = {},
): Promise<{ tasks: number; subtasks: number; importedAt: string }> {
  const importedAt = nowISO();
  const mergeOptions: ImportMergeOptions = options.allowDeletedRestore
    ? { ...options, restoreTimestamp: options.restoreTimestamp ?? importedAt }
    : options;
  const tasks = asArray(payload.tasks).map(normalizeTask);
  const subtasks = asArray(payload.subtasks);
  const dailyPlans = asArray(payload.dailyPlans);
  const recurringDefinitions = asArray(payload.recurringDefinitions);
  const reports = asArray(payload.reports);
  const logs = asArray(payload.logs);
  const reminders = asArray(payload.reminders);
  const hasHabitPayload = Array.isArray(payload.habits);
  const hasHabitLogPayload = Array.isArray(payload.habitLogs);
  const focusItems = asArray(payload.focusItems);
  const habits = asArray(payload.habits);
  const habitLogs = asArray(payload.habitLogs);
  const customers = asArray(payload.customers);
  const products = asArray(payload.products);
  const suppliers = asArray(payload.suppliers);
  const orders = asArray(payload.orders);
  const orderItems = asArray(payload.orderItems);
  const productionBatches = asArray(payload.productionBatches);
  const allocations = asArray(payload.allocations);
  const settings = payload.settings ?? undefined;
  const hasSalesPayload = customers.length > 0 || products.length > 0 || suppliers.length > 0 || orders.length > 0 || orderItems.length > 0 || productionBatches.length > 0 || allocations.length > 0;

  if (tasks.length === 0 && subtasks.length === 0 && dailyPlans.length === 0 && focusItems.length === 0 && habits.length === 0 && habitLogs.length === 0 && !hasSalesPayload && !settings) {
    throw new Error('Daily State JSON לא מכיל משימות / תתי־משימות / תוכניות יום לייבוא.');
  }

  await db.transaction(
    'rw',
    [db.settings, db.tasks, db.subtasks, db.dailyPlans, db.recurringDefinitions, db.reports, db.logs, db.snapshots, db.reminders, db.habits, db.habitLogs, db.focusItems, db.customers, db.products, db.suppliers, db.orders, db.orderItems, db.productionBatches, db.allocations],
    async () => {
      const beforeImport = await getAllLocalData();
      await db.snapshots.add({
        id: createId('snapshot'),
        createdAt: importedAt,
        reason: 'import',
        appVersion: APP_VERSION,
        data: beforeImport,
      });

      if (settings) {
        const localSettings = await db.settings.get('default');
        await db.settings.put(
          options.preserveLocalSettingsSecrets
            ? mergeImportedSettingsPreservingLocalSecrets(settings, localSettings)
            : settings,
        );
      }

      // ── Smart merge for tasks: local cancellations/completions always survive ──
      if (tasks.length) {
        const existingTasks = await db.tasks.bulkGet(tasks.map((t) => t.id));
        const toUpsert = tasks
          .map((task, index) => prepareTaskForImport(task, existingTasks[index], mergeOptions))
          .filter((decision) => decision.shouldUpsert)
          .map((decision) => decision.item);
        if (toUpsert.length) await db.tasks.bulkPut(toUpsert);

        const deletedTaskIds = tasks.filter((task) => task.deletedAt).map((task) => task.id);
        if (deletedTaskIds.length > 0) {
          const localSubtasks = await db.subtasks
            .filter((subtask) => deletedTaskIds.includes(subtask.taskId) && !subtask.deletedAt)
            .toArray();
          if (localSubtasks.length > 0) {
            await db.subtasks.bulkPut(localSubtasks.map((subtask) => ({
              ...subtask,
              deletedAt: importedAt,
              updatedAt: importedAt,
            })));
          }
        }
      }

      if (subtasks.length) {
        const existingSubtasks = await db.subtasks.bulkGet(subtasks.map((s) => s.id));
        const localParentTasks = await db.tasks.bulkGet(subtasks.map((s) => s.taskId));
        const toUpsert = subtasks
          .map((subtask, index) => prepareSubtaskForImport(subtask, existingSubtasks[index], localParentTasks[index], mergeOptions))
          .filter((decision) => decision.shouldUpsert)
          .map((decision) => decision.item);
        if (toUpsert.length) await db.subtasks.bulkPut(toUpsert);
      }
      if (dailyPlans.length) await db.dailyPlans.bulkPut(dailyPlans);
      if (recurringDefinitions.length) await db.recurringDefinitions.bulkPut(recurringDefinitions);
      if (reports.length) await db.reports.bulkPut(reports);
      if (logs.length) await db.logs.bulkPut(logs);
      if (reminders.length) await db.reminders.bulkPut(reminders);
      if (hasHabitPayload) {
        await db.habits.clear();
        if (habits.length) await db.habits.bulkPut(habits);
      }
      if (hasHabitLogPayload) {
        await db.habitLogs.clear();
        if (habitLogs.length) await db.habitLogs.bulkPut(habitLogs);
      }
      if (focusItems.length) {
        const existingFocusItems = await db.focusItems.bulkGet(focusItems.map((item) => item.id));
        const mergedFocusItems = focusItems.map((item, index) => {
          const existing = existingFocusItems[index];
          if (existing?.deletedAt && !item.deletedAt) return existing;
          if (existing?.completedAt && !item.completedAt) return existing;
          if (existing && (Date.parse(existing.updatedAt ?? '') || 0) > (Date.parse(item.updatedAt ?? '') || 0)) return existing;
          return item;
        });
        await db.focusItems.bulkPut(mergedFocusItems);
      }
      if (customers.length) {
        const existing = await db.customers.bulkGet(customers.map((item) => item.id));
        await db.customers.bulkPut(customers.map((item, index) => mergeByUpdatedAt(item, existing[index])));
      }
      if (products.length) {
        const existing = await db.products.bulkGet(products.map((item) => item.id));
        await db.products.bulkPut(products.map((item, index) => mergeByUpdatedAt(item, existing[index])));
      }
      if (suppliers.length) {
        const existing = await db.suppliers.bulkGet(suppliers.map((item) => item.id));
        await db.suppliers.bulkPut(suppliers.map((item, index) => mergeByUpdatedAt(item, existing[index])));
      }
      if (orders.length) {
        const existing = await db.orders.bulkGet(orders.map((item) => item.id));
        await db.orders.bulkPut(orders.map((item, index) => mergeByUpdatedAt(item, existing[index])));
      }
      if (orderItems.length) {
        const existing = await db.orderItems.bulkGet(orderItems.map((item) => item.id));
        await db.orderItems.bulkPut(orderItems.map((item, index) => mergeByUpdatedAt(item, existing[index])));
      }
      if (productionBatches.length) {
        const existing = await db.productionBatches.bulkGet(productionBatches.map((item) => item.id));
        await db.productionBatches.bulkPut(productionBatches.map((item, index) => mergeByUpdatedAt(item, existing[index])));
      }
      if (allocations.length) {
        const existing = await db.allocations.bulkGet(allocations.map((item) => item.id));
        await db.allocations.bulkPut(allocations.map((item, index) => mergeByUpdatedAt(item, existing[index])));
      }

      await db.logs.add({
        id: createId('log'),
        timestamp: importedAt,
        type: 'note_added',
        entityType: 'system',
        entityId: null,
        message: `Daily State imported: ${tasks.length} tasks, ${subtasks.length} subtasks`,
        metadata: { appVersion: APP_VERSION, sourceAppVersion: payload.appVersion ?? null, sourceDate: payload.date ?? null },
      });
    },
  );

  return { tasks: tasks.length, subtasks: subtasks.length, importedAt };
}

/**
 * Roll-over stale "today" tasks to the actual today.
 * Called once per session at startup.
 * Tasks that were in bucket=today on a previous day and are still open
 * get their date updated to today — so they appear in today's view.
 */
function shouldPromoteScheduledBacklogTask(task: Task, todayISO: string): boolean {
  if (
    task.bucket !== 'backlog' ||
    !task.date ||
    task.date > todayISO ||
    task.completedAt ||
    task.deletedAt ||
    task.statusOverride === 'cancelled'
  ) {
    return false;
  }

  // "Tomorrow" is a dated holding lane. Once its date arrives it should become
  // a Today task instead of staying hidden in backlog.
  if (task.backlogGroup === 'tomorrow') return true;

  // Custom future dates are usually stored as this_week. Promote only after the
  // date is stale, so a generic "this week" item created today does not jump in.
  return task.backlogGroup === 'this_week' && task.date < todayISO;
}

export async function rolloverStaleTodayTasks(): Promise<number> {
  const todayISO = getTodayISO();
  const staleTasks = await db.tasks
    .filter(
      (task) =>
        (
          task.bucket === 'today' &&
          (task.date ?? '') < todayISO &&
          !task.completedAt &&
          !task.deletedAt &&
          task.statusOverride !== 'cancelled'
        ) ||
        shouldPromoteScheduledBacklogTask(task, todayISO),
    )
    .toArray();

  if (staleTasks.length === 0) return 0;

  const timestamp = nowISO();
  await db.tasks.bulkPut(
    staleTasks.map((task) => ({
      ...task,
      bucket: 'today',
      backlogGroup: null,
      date: todayISO,
      movedToDate: todayISO,
      scheduledTimeLabel: task.scheduledTimeLabel || 'היום',
      movedCount: task.movedCount + 1,
      updatedAt: timestamp,
    })),
  );

  console.log(`[Rollover] Moved ${staleTasks.length} stale today-tasks → ${todayISO}`);
  return staleTasks.length;
}
