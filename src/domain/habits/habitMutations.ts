import { db } from '../../db/db';
import { nowISO } from '../../utils/dates';
import { createId } from '../../utils/ids';
import type { DailyHabit, DailyHabitLog } from './habitTypes';

export interface CreateHabitInput {
  title: string;
  unit: string;
  targetCount: number;
}

export async function createHabit(input: CreateHabitInput): Promise<DailyHabit> {
  const timestamp = nowISO();
  const maxOrder = (await db.habits.orderBy('order').last())?.order ?? 0;
  const habit: DailyHabit = {
    id: createId('habit'),
    title: input.title.trim(),
    unit: input.unit.trim(),
    targetCount: Math.max(1, input.targetCount),
    order: maxOrder + 1,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.habits.add(habit);
  return habit;
}

export async function updateHabit(
  habitId: string,
  patch: Partial<Pick<DailyHabit, 'title' | 'unit' | 'targetCount' | 'active' | 'order'>>,
): Promise<void> {
  await db.habits.update(habitId, { ...patch, updatedAt: nowISO() });
}

export async function deleteHabit(habitId: string): Promise<void> {
  await db.transaction('rw', db.habits, db.habitLogs, async () => {
    await db.habits.delete(habitId);
    await db.habitLogs.where('habitId').equals(habitId).delete();
  });
}

export async function reorderHabits(orderedIds: string[]): Promise<void> {
  const timestamp = nowISO();
  await db.transaction('rw', db.habits, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.habits.update(orderedIds[i], { order: i + 1, updatedAt: timestamp });
    }
  });
}

/** Upsert log for a habit on a given date, adjusting count by delta (clamped to 0). */
export async function incrementHabitCount(habitId: string, date: string, delta: number): Promise<void> {
  await db.transaction('rw', db.habitLogs, async () => {
    const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).first()
      ?? await db.habitLogs.filter(l => l.habitId === habitId && l.date === date).first();
    if (existing) {
      const next = Math.max(0, existing.count + delta);
      await db.habitLogs.update(existing.id, { count: next });
    } else if (delta > 0) {
      const log: DailyHabitLog = {
        id: createId('hlog'),
        habitId,
        date,
        count: delta,
        createdAt: nowISO(),
      };
      await db.habitLogs.add(log);
    }
  });
}

/** Set exact count for a habit on a given date. */
export async function setHabitCount(habitId: string, date: string, count: number): Promise<void> {
  await db.transaction('rw', db.habitLogs, async () => {
    const existing = await db.habitLogs.filter(l => l.habitId === habitId && l.date === date).first();
    const safeCount = Math.max(0, count);
    if (existing) {
      await db.habitLogs.update(existing.id, { count: safeCount });
    } else {
      const log: DailyHabitLog = {
        id: createId('hlog'),
        habitId,
        date,
        count: safeCount,
        createdAt: nowISO(),
      };
      await db.habitLogs.add(log);
    }
  });
}
