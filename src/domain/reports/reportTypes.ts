export interface DailyReportPayloadTaskSummary {
  taskId: string;
  title: string;
  projectId: string;
  domainId: string;
  progressPercent: number;
  recurring: boolean;
  subtaskTitles: string[];
}

export interface DailyReportPayload {
  date: string;
  completed: DailyReportPayloadTaskSummary[];
  inProgress: DailyReportPayloadTaskSummary[];
  notStarted: DailyReportPayloadTaskSummary[];
  moved: DailyReportPayloadTaskSummary[];
  cancelled: DailyReportPayloadTaskSummary[];
  backlog: Record<string, DailyReportPayloadTaskSummary[]>;
  recurring: {
    dueToday: string[];
    completedRecurring: string[];
    missedRecurring: string[];
  };
  metrics: {
    totalTasks: number;
    completedTasks: number;
    startedTasks: number;
    quickWinsCompleted: number;
    recurringCompleted: number;
    recurringMissed: number;
  };
}

export interface DailyReport {
  id: string;
  date: string;
  locationLabel?: string | null;
  timezone?: string | null;
  generatedAt: string;
  editedAt?: string | null;
  markdownContent: string;
  editedMarkdownContent?: string | null;
  payload: DailyReportPayload;
  createdAt: string;
  updatedAt: string;
}
