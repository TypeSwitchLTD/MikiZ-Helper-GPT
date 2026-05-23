export type ReminderStatus = 'pending' | 'sent' | 'cancelled';

export interface Reminder {
  id: string;
  title: string;
  taskId?: string | null;
  subtaskId?: string | null;
  remindAt: string;
  status: ReminderStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string | null;
}
