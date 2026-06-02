export type FocusItemTargetType = "task" | "subtask";

export interface FocusItem {
  id: string;
  targetType: FocusItemTargetType;
  taskId: string;
  subtaskId?: string | null;
  titleSnapshot: string;
  parentTitleSnapshot?: string | null;
  sortOrder: number;
  addedAt: string;
  updatedAt: string;
  completedAt?: string | null;
  deletedAt?: string | null;
}
