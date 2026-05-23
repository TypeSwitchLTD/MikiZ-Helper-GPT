export interface DailyHabit {
  id: string;
  title: string;
  unit: string;         // e.g. "כוסות", "שכיבות", "ק״מ"
  targetCount: number;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyHabitLog {
  id: string;
  habitId: string;
  date: string;         // YYYY-MM-DD
  count: number;
  createdAt: string;
}
