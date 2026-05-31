import type { BacklogGroup, Task, TaskBucket, TaskEffort, TaskPriority } from '../../domain/tasks/taskTypes';
import type { CreateTaskInput } from '../../domain/tasks/taskMutations';

export type CreatePanel = 'task' | 'schedule' | null;
export type TaskSourceOption = 'manual' | 'interruption';

export interface TaskDraftState {
  title: string;
  projectId: string;
  domainId: string;
  bucket: TaskBucket;
  backlogGroup: BacklogGroup;
  date: string;
  scheduledTimeLabel: string;
  estimatedDurationMinutes: string;
  priority: TaskPriority;
  effort: TaskEffort;
  source: TaskSourceOption;
  whyNow: string;
  notes: string;
  aiConversationUrl: string;
  tags: string[];
  subtasks: string[];
  rawIntake: string;
}

export interface ScheduleDraftState {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  projectId: string;
  domainId: string;
  alsoCreateTask: boolean;
}

export interface ChoiceOption<Value extends string> {
  value: Value;
  label: string;
  className: string;
}

export interface ParsedReviewRow {
  id: string;
  text: string;
  targetMode: 'new_task' | 'existing_task';
  targetTaskId: string | null;
  targetTitle: string;
  date: string;
  label: string;
  search: string;
  confidence: 'auto' | 'manual' | 'new';
  projectId?: string;
  domainId?: string;
  bucket?: TaskBucket;
  backlogGroup?: BacklogGroup | null;
  priority?: TaskPriority;
  effort?: TaskEffort;
  tags?: string[];
}

export interface ParsedIntakeDraft {
  title: string;
  subtasks: string[];
  date: string;
  label: string;
  sourceNote: string;
  reviewRows?: ParsedReviewRow[];
}

export interface DuplicateCandidate {
  task: Task;
  reason: 'exact' | 'strong';
  input: CreateTaskInput;
  keepOpen: boolean;
}

export type SpeechInputLanguage = 'he-IL' | 'en-US';
