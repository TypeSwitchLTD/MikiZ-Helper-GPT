import { db } from '../../db/db';
import { nowISO, localISOSeconds } from '../../utils/dates';
import { createId } from '../../utils/ids';
import { createLogEvent } from '../logs/logService';
import type { Reminder } from './reminderTypes';

export interface CreateReminderInput {
  title: string;
  taskId?: string | null;
  subtaskId?: string | null;
  date: string;
  time: string;
  note?: string;
}

function toRemindAt(date: string, time: string): string {
  const safeDate = date || new Date().toISOString().slice(0, 10);
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
  return `${safeDate}T${safeTime}:00`;
}

export async function createReminder(input: CreateReminderInput): Promise<Reminder> {
  const timestamp = nowISO();
  const title = input.title.trim();
  if (!title) throw new Error('Reminder title is required');

  const reminder: Reminder = {
    id: createId('reminder'),
    title,
    taskId: input.taskId ?? null,
    subtaskId: input.subtaskId ?? null,
    remindAt: toRemindAt(input.date, input.time),
    status: 'pending',
    note: input.note?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    sentAt: null,
  };

  await db.transaction('rw', db.reminders, db.logs, async () => {
    await db.reminders.add(reminder);
    await createLogEvent({
      type: 'note_added',
      entityType: 'reminder',
      entityId: reminder.id,
      message: `Reminder created: ${reminder.title}`,
      metadata: { taskId: reminder.taskId, subtaskId: reminder.subtaskId, remindAt: reminder.remindAt },
    });
  });

  return reminder;
}

export async function markReminderSent(reminderId: string): Promise<void> {
  const timestamp = nowISO();
  await db.transaction('rw', db.reminders, db.logs, async () => {
    await db.reminders.update(reminderId, { status: 'sent', sentAt: timestamp, updatedAt: timestamp });
    await createLogEvent({
      type: 'note_added',
      entityType: 'reminder',
      entityId: reminderId,
      message: 'Reminder notification sent',
    });
  });
}

export async function cancelReminder(reminderId: string): Promise<void> {
  const timestamp = nowISO();
  await db.transaction('rw', db.reminders, db.logs, async () => {
    await db.reminders.update(reminderId, { status: 'cancelled', updatedAt: timestamp });
    await createLogEvent({
      type: 'note_added',
      entityType: 'reminder',
      entityId: reminderId,
      message: 'Reminder cancelled',
    });
  });
}

export async function snoozeReminder(reminderId: string, snoozeMinutes: number): Promise<void> {
  const timestamp = nowISO();
  const newRemindAt = localISOSeconds(snoozeMinutes * 60 * 1000);
  await db.transaction('rw', db.reminders, db.logs, async () => {
    await db.reminders.update(reminderId, { remindAt: newRemindAt, updatedAt: timestamp });
    await createLogEvent({
      type: 'note_added',
      entityType: 'reminder',
      entityId: reminderId,
      message: `Reminder snoozed ${snoozeMinutes} minutes`,
    });
  });
}
