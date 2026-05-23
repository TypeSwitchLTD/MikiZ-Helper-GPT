export interface DailyPlanItem {
  taskId: string;
  order: number;
  note?: string;
}

export interface DailyPlanBlock {
  time: string;
  title: string;
  description: string;
  tone?: string;
}

export interface DailyPlan {
  id: string;
  date: string;
  focusNote?: string;
  plannedTaskIds: DailyPlanItem[];
  blocks?: DailyPlanBlock[];
  createdAt: string;
  updatedAt: string;
}
