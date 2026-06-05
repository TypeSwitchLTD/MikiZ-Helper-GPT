import { db } from "../../db/db";
import { nowISO } from "../../utils/dates";
import { createId } from "../../utils/ids";
import type { FocusItem } from "./focusTypes";

export const MAX_FOCUS_ITEMS = 6;

async function getActiveFocusItems(): Promise<FocusItem[]> {
  return db.focusItems
    .filter((item) => !item.deletedAt && !item.completedAt)
    .toArray();
}

async function assertFocusRoom(existing?: FocusItem[]) {
  const active = existing ?? await getActiveFocusItems();
  if (active.length >= MAX_FOCUS_ITEMS) {
    throw new Error("לשונית פוקוס מוגבלת ל־6 פריטים. הוצא משהו ואז הוסף חדש.");
  }
}

function getNextSortOrder(items: FocusItem[]): number {
  const maxOrder = items.reduce((max, item) => Math.max(max, item.sortOrder || 0), 0);
  return maxOrder + 1000;
}

export async function addTaskToFocus(taskId: string): Promise<FocusItem | null> {
  const task = await db.tasks.get(taskId);
  if (!task || task.deletedAt) throw new Error("המשימה לא נמצאה.");

  const active = await getActiveFocusItems();
  const existing = active.find((item) => item.targetType === "task" && item.taskId === taskId);
  if (existing) return existing;
  await assertFocusRoom(active);

  const timestamp = nowISO();
  const item: FocusItem = {
    id: createId("focus"),
    targetType: "task",
    taskId,
    subtaskId: null,
    titleSnapshot: task.title,
    parentTitleSnapshot: null,
    sortOrder: getNextSortOrder(active),
    manualProgressPercent: 0,
    focusTimeSpentSeconds: 0,
    activeStartedAt: null,
    addedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    deletedAt: null,
  };
  await db.focusItems.add(item);
  return item;
}

export async function addSubtaskToFocus(taskId: string, subtaskId: string): Promise<FocusItem | null> {
  const [task, subtask] = await Promise.all([db.tasks.get(taskId), db.subtasks.get(subtaskId)]);
  if (!task || task.deletedAt || !subtask || subtask.deletedAt) throw new Error("תת־המשימה לא נמצאה.");

  const active = await getActiveFocusItems();
  const existing = active.find((item) => item.targetType === "subtask" && item.subtaskId === subtaskId);
  if (existing) return existing;
  await assertFocusRoom(active);

  const timestamp = nowISO();
  const item: FocusItem = {
    id: createId("focus"),
    targetType: "subtask",
    taskId,
    subtaskId,
    titleSnapshot: subtask.title,
    parentTitleSnapshot: task.title,
    sortOrder: getNextSortOrder(active),
    manualProgressPercent: 0,
    focusTimeSpentSeconds: 0,
    activeStartedAt: null,
    addedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    deletedAt: null,
  };
  await db.focusItems.add(item);
  return item;
}

export async function removeFocusItem(focusItemId: string): Promise<void> {
  const timestamp = nowISO();
  await db.focusItems.update(focusItemId, { deletedAt: timestamp, updatedAt: timestamp });
}

export async function clearFocusItems(): Promise<number> {
  const timestamp = nowISO();
  const active = await getActiveFocusItems();
  if (!active.length) return 0;
  await db.focusItems.bulkPut(active.map((item) => ({ ...item, deletedAt: timestamp, updatedAt: timestamp })));
  return active.length;
}

export async function completeFocusItem(focusItemId: string): Promise<void> {
  const item = await db.focusItems.get(focusItemId);
  if (!item || item.deletedAt) throw new Error("פריט הפוקוס לא נמצא.");

  const timestamp = nowISO();
  await db.transaction("rw", db.focusItems, db.tasks, db.subtasks, async () => {
    await db.focusItems.update(focusItemId, { completedAt: timestamp, updatedAt: timestamp });
    if (item.targetType === "subtask" && item.subtaskId) {
      await db.subtasks.update(item.subtaskId, { status: "done", updatedAt: timestamp });
      return;
    }
    await db.tasks.update(item.taskId, { completedAt: timestamp, updatedAt: timestamp });
  });
}

export async function updateFocusItemProgress(
  focusItemId: string,
  progressPercent: number,
): Promise<void> {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progressPercent)));
  await db.focusItems.update(focusItemId, {
    manualProgressPercent: safeProgress,
    updatedAt: nowISO(),
  });
}

export async function addFocusItemTime(
  focusItemId: string,
  seconds: number,
): Promise<void> {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const item = await db.focusItems.get(focusItemId);
  if (!item || item.deletedAt) return;
  await db.focusItems.update(focusItemId, {
    focusTimeSpentSeconds: Math.max(0, Math.round(item.focusTimeSpentSeconds ?? 0) + Math.round(seconds)),
    updatedAt: nowISO(),
  });
}
