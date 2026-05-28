import type { AppSettings } from '../../domain/settings/settingsTypes';
import type { BacklogGroup, Subtask, Task, TaskBucket, TaskEffort, TaskPriority } from '../../domain/tasks/taskTypes';
import type { CreateTaskInput } from '../../domain/tasks/taskMutations';
import { getTomorrowISO, toISODate } from '../../utils/dates';
import { getTaskProgress } from '../../domain/tasks/taskProgress';
import { getSubtasksForTask } from '../../domain/tasks/taskSelectors';
import { backlogLabels, effortLabels, priorityLabels } from '../../utils/hebrewLabels';
import type {
  ChoiceOption,
  ParsedIntakeDraft,
  ParsedReviewRow,
  ScheduleDraftState,
  SpeechInputLanguage,
  TaskDraftState,
  TaskSourceOption,
} from './createTaskTypes';

// ─── Option arrays ────────────────────────────────────────────────────────────

export const bucketOptions: Array<ChoiceOption<TaskBucket>> = [
  { value: 'today', label: 'היום', className: 'bg-sky-50 text-sky-800 ring-sky-100' },
  { value: 'backlog', label: 'Backlog', className: 'bg-amber-50 text-amber-800 ring-amber-100' },
];

export const backlogOptions: Array<ChoiceOption<BacklogGroup>> = [
  { value: 'tomorrow', label: backlogLabels.tomorrow, className: 'bg-cyan-50 text-cyan-800 ring-cyan-100' },
  { value: 'this_week', label: backlogLabels.this_week, className: 'bg-emerald-50 text-emerald-800 ring-emerald-100' },
  { value: 'waiting', label: backlogLabels.waiting, className: 'bg-violet-50 text-violet-800 ring-violet-100' },
  { value: 'later', label: backlogLabels.later, className: 'bg-slate-50 text-slate-700 ring-slate-200' },
];

export const priorityOptions: Array<ChoiceOption<TaskPriority>> = [
  { value: 'high', label: priorityLabels.high, className: 'bg-rose-50 text-rose-800 ring-rose-100' },
  { value: 'medium', label: priorityLabels.medium, className: 'bg-amber-50 text-amber-800 ring-amber-100' },
  { value: 'low', label: priorityLabels.low, className: 'bg-emerald-50 text-emerald-800 ring-emerald-100' },
];

export const effortOptions: Array<ChoiceOption<TaskEffort>> = [
  { value: 'quick', label: effortLabels.quick, className: 'bg-lime-50 text-lime-800 ring-lime-100' },
  { value: 'medium', label: effortLabels.medium, className: 'bg-sky-50 text-sky-800 ring-sky-100' },
  { value: 'deep', label: effortLabels.deep, className: 'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-100' },
];

export const sourceOptions: Array<ChoiceOption<TaskSourceOption>> = [
  { value: 'manual', label: 'רגילה', className: 'bg-slate-50 text-slate-800 ring-slate-200' },
  { value: 'interruption', label: 'נכנסה באמצע', className: 'bg-orange-50 text-orange-800 ring-orange-100' },
];

export const defaultTagOptions = [
  'follow-up', 'urgent', 'birthday', 'phone', 'email', 'waiting',
  'qa', 'sales', 'marketing', 'production', 'website', 'shopify',
  'apollo', 'finance', 'personal', 'timeraligner', 'typeswitch',
];

// ─── Draft factories ──────────────────────────────────────────────────────────

export function getFirstActiveId(items: Array<{ id: string; isActive: boolean }>, fallback: string): string {
  return items.find((item) => item.isActive)?.id ?? items[0]?.id ?? fallback;
}

export function createEmptyTaskDraft(settings: AppSettings | null, todayISO: string): TaskDraftState {
  return {
    title: '',
    projectId: getFirstActiveId(settings?.projects ?? [], 'personal'),
    domainId: getFirstActiveId(settings?.domains ?? [], 'operations'),
    bucket: 'today',
    backlogGroup: 'this_week',
    date: todayISO,
    scheduledTimeLabel: 'היום',
    estimatedDurationMinutes: '15',
    priority: 'medium',
    effort: 'medium',
    source: 'manual',
    whyNow: '',
    notes: '',
    tags: [],
    subtasks: [''],
    rawIntake: '',
  };
}

export function createContinuationTaskDraft(current: TaskDraftState): TaskDraftState {
  return { ...current, title: '', whyNow: '', notes: '', subtasks: [''], rawIntake: '' };
}

export function createEmptyScheduleDraft(settings: AppSettings | null, todayISO: string): ScheduleDraftState {
  return {
    title: '',
    date: todayISO,
    startTime: '10:00',
    endTime: '10:30',
    location: '',
    notes: '',
    projectId: getFirstActiveId(settings?.projects ?? [], 'personal'),
    domainId: getFirstActiveId(settings?.domains ?? [], 'operations'),
    alsoCreateTask: true,
  };
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function addDaysISO(baseISO: string, days: number): string {
  const date = new Date(`${baseISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function getDateFromHebrewText(
  text: string,
  todayISO: string,
): { date: string; label: string; backlogGroup: BacklogGroup | null; bucket: TaskBucket } {
  const normalized = text.toLowerCase();
  if (/מחרתיים/.test(text)) {
    return { date: addDaysISO(todayISO, 2), label: 'מחרתיים', backlogGroup: 'this_week', bucket: 'backlog' };
  }
  if (/מחר/.test(text)) {
    return { date: getTomorrowISO(new Date(`${todayISO}T12:00:00`)), label: 'מחר', backlogGroup: 'tomorrow', bucket: 'backlog' };
  }
  if (/השבוע/.test(text)) {
    return { date: todayISO, label: 'השבוע', backlogGroup: 'this_week', bucket: 'backlog' };
  }
  if (/בהמשך|later/.test(normalized)) {
    return { date: todayISO, label: 'בהמשך', backlogGroup: 'later', bucket: 'backlog' };
  }
  if (/היום|today/.test(normalized) || text.includes('היום')) {
    return { date: todayISO, label: 'היום', backlogGroup: null, bucket: 'today' };
  }
  return { date: todayISO, label: 'היום', backlogGroup: null, bucket: 'today' };
}

// ─── Text utilities ───────────────────────────────────────────────────────────

export function cleanTaskText(value: string): string {
  return value
    .replace(/^[\s\-•*]+/, '')
    .replace(/^\d+[.)\-:]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripTemporalWords(value: string): string {
  return value
    .replace(/\b(?:today|tomorrow)\b/gi, '')
    .replace(/מחרתיים|מחר|היום|השבוע|בהמשך/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeIntakeText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/([^\n])\s+(\d+[.)]\s+)/g, '$1\n$2')
    .replace(/[""]/g, '"')
    .trim();
}

export function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳״`]/g, '')
    .replace(/[—–\-_/|:()[\],.!?;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createReviewRowId(index: number): string {
  return `review-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`;
}

// ─── Task scoring & matching ──────────────────────────────────────────────────

export function hasUsefulOverlap(a: string, b: string): boolean {
  const left = normalizeComparableText(a);
  const right = normalizeComparableText(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 10 && right.includes(left)) return true;
  if (right.length >= 10 && left.includes(right)) return true;

  const leftTerms = new Set(left.split(' ').filter((term) => term.length > 2));
  const rightTerms = new Set(right.split(' ').filter((term) => term.length > 2));
  if (leftTerms.size < 2 || rightTerms.size < 2) return false;
  const overlap = [...leftTerms].filter((term) => rightTerms.has(term)).length;
  return overlap >= Math.min(3, Math.min(leftTerms.size, rightTerms.size));
}

export function findDuplicateCandidate(
  input: CreateTaskInput,
  tasks: Task[],
  subtasks: Subtask[],
): { task: Task; reason: 'exact' | 'strong' } | null {
  const title = normalizeComparableText(input.title);
  if (!title) return null;

  const openTasks = tasks.filter((task) => {
    const progress = getTaskProgress(task, subtasks);
    return progress.status !== 'done' && progress.status !== 'cancelled' && task.statusOverride !== 'cancelled';
  });

  const exact = openTasks.find((task) => normalizeComparableText(task.title) === title);
  if (exact) return { task: exact, reason: 'exact' };

  const strong = openTasks.find((task) => hasUsefulOverlap(input.title, task.title));
  if (strong) return { task: strong, reason: 'strong' };

  return null;
}

export function extractAffinityTokens(value: string): Set<string> {
  const text = normalizeComparableText(value);
  const aliases: Array<{ token: string; terms: string[] }> = [
    { token: 'jack', terms: ['jack', 'גק', 'ג׳ק'] },
    { token: 'mom', terms: ['אמא'] },
    { token: 'grandma', terms: ['סבתא'] },
    { token: 'moshe', terms: ['משה'] },
    { token: 'apollo', terms: ['apollo', 'לידים', 'קליניקות', 'invisalign'] },
    { token: 'shopify', terms: ['shopify', 'checkout', 'חנות'] },
    { token: 'website', terms: ['website', 'אתר', 'עמוד', 'מובייל'] },
    { token: 'timeraligner', terms: ['timeraligner', 'aligner', 'aligners'] },
    { token: 'typeswitch', terms: ['typeswitch', 'פטנט', 'יעקב', 'סבטלנה'] },
    { token: 'finance', terms: ['כסף', 'תזרים', 'חשבון', 'בנק', 'finance'] },
    { token: 'birthday', terms: ['יום הולדת', 'פרחים', 'birthday'] },
  ];
  const tokens = new Set<string>();
  aliases.forEach((alias) => {
    if (alias.terms.some((term) => text.includes(normalizeComparableText(term)))) tokens.add(alias.token);
  });
  return tokens;
}

export function splitFreeTextIntoCandidates(text: string): string[] {
  const normalized = normalizeIntakeText(text)
    .replace(/\s+וגם\s+/g, '\n')
    .replace(/\s+בנוסף\s+/g, '\n')
    .replace(/\s+ואז\s+/g, '\n')
    .replace(/[;]+/g, '\n');

  return normalized
    .split('\n')
    .map((segment) => stripTemporalWords(cleanTaskText(segment)))
    .filter((segment) => segment.length > 1)
    .slice(0, 12);
}

export function splitSentenceSubtasks(text: string): string[] {
  return normalizeIntakeText(text)
    .replace(/\s+/g, ' ')
    .split(/\s*[.!?؟]\s+/)
    .map((segment) => stripTemporalWords(cleanTaskText(segment)))
    .filter((segment) => segment.length > 1)
    .slice(0, 10);
}

export function shouldUseSingleParent(candidates: string[], originalText: string): boolean {
  if (candidates.length <= 1) return true;
  if (/[:\-–—]\s*\n?\s*(?:1[.)]|[-•*])/.test(originalText)) return true;
  const tokenSets = candidates.map(extractAffinityTokens);
  const nonEmpty = tokenSets.filter((tokens) => tokens.size > 0);
  if (nonEmpty.length !== candidates.length) return false;
  const shared = [...nonEmpty[0]].filter((token) => nonEmpty.every((tokens) => tokens.has(token)));
  return shared.length > 0;
}

export function scoreTaskMatch(text: string, task: Task, subtasks: Subtask[]): number {
  const taskSubtasks = getSubtasksForTask(task.id, subtasks);
  const candidate = normalizeComparableText(text);
  const haystack = normalizeComparableText(
    [task.title, task.projectId, task.domainId, (task.tags ?? []).join(' '), task.whyNow, task.notes, ...taskSubtasks.map((s) => s.title)]
      .filter(Boolean)
      .join(' '),
  );
  if (!candidate || !haystack) return 0;
  let score = 0;
  if (haystack.includes(candidate) || candidate.includes(normalizeComparableText(task.title))) score += 8;
  const candidateTerms = candidate.split(' ').filter((term) => term.length > 2);
  score += candidateTerms.filter((term) => haystack.includes(term)).length;
  const candidateTokens = extractAffinityTokens(text);
  const taskTokens = extractAffinityTokens(`${task.title} ${(task.tags ?? []).join(' ')} ${task.projectId ?? ''} ${task.domainId ?? ''}`);
  score += [...candidateTokens].filter((token) => taskTokens.has(token)).length * 4;
  return score;
}

export function getOpenTasks(tasks: Task[], subtasks: Subtask[]): Task[] {
  return tasks.filter((task) => {
    const progress = getTaskProgress(task, subtasks);
    return progress.status !== 'done' && progress.status !== 'cancelled' && task.statusOverride !== 'cancelled';
  });
}

export function findBestParentTask(text: string, tasks: Task[], subtasks: Subtask[]): { task: Task; score: number } | null {
  const matches = getOpenTasks(tasks, subtasks)
    .map((task) => ({ task, score: scoreTaskMatch(text, task, subtasks) }))
    .filter((match) => match.score >= 4)
    .sort((a, b) => b.score - a.score);
  return matches[0] ?? null;
}

export function buildReviewRowsForSingleParent(
  title: string,
  subtasks: string[],
  date: string,
  label: string,
): ParsedReviewRow[] {
  const cleanTitle = title.trim() || 'משימה חדשה';
  const rows = subtasks.length > 0 ? subtasks : [cleanTitle];
  return rows
    .map((subtask, index) => ({
      id: createReviewRowId(index),
      text: subtask.trim(),
      targetMode: 'new_task' as const,
      targetTaskId: null,
      targetTitle: cleanTitle,
      date,
      label,
      search: '',
      confidence: 'new' as const,
    }))
    .filter((row) => row.text.length > 0);
}

export function groupKeyForNewTask(row: ParsedReviewRow): string {
  return `${normalizeComparableText(row.targetTitle || row.text)}::${row.date || ''}`;
}

export function getAutoPriorityFromText(value: string, fallback: TaskPriority): TaskPriority {
  const text = normalizeComparableText(value);
  if (/דחוף|חשוב|urgent|today|היום|חוסם|בעיה|fix|תקן/.test(text)) return 'high';
  if (/בהמשך|later|מתישהו|לא דחוף/.test(text)) return 'low';
  return fallback;
}

export function getAutoEffortFromText(value: string, fallback: TaskEffort): TaskEffort {
  const text = normalizeComparableText(value);
  if (/קליל|מהיר|5 דק|10 דק|טלפון|להתקשר|שלח|send|call/.test(text)) return 'quick';
  if (/מחקר|פיתוח|אסטרטג|לבנות|לפתח|deep|ארוך/.test(text)) return 'deep';
  return fallback;
}

export function pickKnownId(ids: Set<string>, preferred: string[], fallback: string): string {
  return preferred.find((id) => ids.has(id)) ?? fallback;
}

export function inferProjectDomainFromText(
  value: string,
  fallbackProjectId: string,
  fallbackDomainId: string,
  settings: AppSettings | null,
): { projectId: string; domainId: string } {
  const text = normalizeComparableText(value);
  const projectIds = new Set(settings?.projects.map((p) => p.id) ?? []);
  const domainIds = new Set(settings?.domains.map((d) => d.id) ?? []);
  let projectId = fallbackProjectId;
  let domainId = fallbackDomainId;

  if (/apollo|לידים|קליניקות|invisalign|instantly/.test(text)) {
    projectId = pickKnownId(projectIds, ['timeraligner'], projectId);
    domainId = pickKnownId(domainIds, ['apollo', 'sales'], domainId);
  }
  if (/shopify|checkout|cart|חנות/.test(text)) {
    projectId = pickKnownId(projectIds, ['alignersworld', 'timeraligner'], projectId);
    domainId = pickKnownId(domainIds, ['shopify'], domainId);
  }
  if (/website|אתר|עמוד|מובייל|mobile|qa/.test(text)) {
    projectId = pickKnownId(projectIds, ['timeraligner', 'alignersworld'], projectId);
    domainId = pickKnownId(domainIds, ['website-qa', 'development'], domainId);
  }
  if (/jack|גק|ג׳ק|ייצור|דגם|ספק|אריזה|מחסן|fulfillment/.test(text)) {
    projectId = pickKnownId(projectIds, ['timeraligner'], projectId);
    domainId = pickKnownId(domainIds, ['production', 'operations'], domainId);
  }
  if (/typeswitch|פטנט|יעקב|סבטלנה/.test(text)) {
    projectId = pickKnownId(projectIds, ['typeswitch'], projectId);
    domainId = pickKnownId(domainIds, ['development', 'operations'], domainId);
  }
  if (/כסף|תזרים|בנק|חשבון|payment|payme|upay|finance/.test(text)) {
    projectId = pickKnownId(projectIds, ['finance', 'personal'], projectId);
    domainId = pickKnownId(domainIds, ['finance'], domainId);
  }
  if (/אמא|סבתא|משה|יום הולדת|פרחים|netflix|אישי/.test(text)) {
    projectId = pickKnownId(projectIds, ['personal'], projectId);
    domainId = pickKnownId(domainIds, ['personal'], domainId);
  }
  if (/mission control|mission-control|משימות|לוג|supabase/.test(text)) {
    projectId = pickKnownId(projectIds, ['mission-control'], projectId);
    domainId = pickKnownId(domainIds, ['development', 'operations'], domainId);
  }

  return { projectId, domainId };
}

export function suggestTagsFromText(draft: TaskDraftState, settings: AppSettings | null): string[] {
  const text = normalizeComparableText(
    [draft.title, draft.rawIntake, draft.whyNow, draft.notes, draft.projectId, draft.domainId, ...draft.subtasks].join(' '),
  );

  const suggestions = new Set<string>();
  if (draft.effort === 'quick') suggestions.add('quick-win');
  if (draft.source === 'interruption') suggestions.add('interruption');
  if (draft.projectId) suggestions.add(draft.projectId);
  if (draft.domainId) suggestions.add(draft.domainId);

  const rules: Array<{ tags: string[]; terms: string[] }> = [
    { tags: ['apollo', 'leads', 'sales'], terms: ['apollo', 'לידים', 'lead', 'leads', 'clinic', 'clinics', 'קליניקות'] },
    { tags: ['instantly', 'email', 'sales'], terms: ['instantly', 'מייל', 'מיילים', 'email', 'emails', 'reply', 'replies'] },
    { tags: ['jack', 'production', 'follow-up'], terms: ['jack', 'גק', 'ג׳ק', 'ייצור', 'דגם', 'ספק'] },
    { tags: ['website', 'qa'], terms: ['website', 'אתר', 'מובייל', 'mobile', 'page', 'עמוד', 'qa'] },
    { tags: ['shopify'], terms: ['shopify', 'checkout', 'cart', 'variants', 'חנות'] },
    { tags: ['finance'], terms: ['כסף', 'תזרים', 'בנק', 'finance', 'payment', 'payme', 'upay'] },
    { tags: ['personal'], terms: ['אמא', 'סבתא', 'יום הולדת', 'netflix', 'אישי'] },
    { tags: ['birthday', 'personal'], terms: ['יום הולדת', 'פרחים', 'birthday'] },
    { tags: ['phone', 'follow-up'], terms: ['להתקשר', 'טלפון', 'call'] },
    { tags: ['typeswitch'], terms: ['typeswitch', 'פטנט', 'יעקב', 'סבטלנה'] },
    { tags: ['timeraligner'], terms: ['timeraligner', 'aligner', 'aligners'] },
  ];

  rules.forEach((rule) => {
    if (rule.terms.some((term) => text.includes(normalizeComparableText(term)))) {
      rule.tags.forEach((tag) => suggestions.add(tag));
    }
  });

  const validTags = new Set([
    ...defaultTagOptions,
    ...(settings?.projects.map((p) => p.id) ?? []),
    ...(settings?.domains.map((d) => d.id) ?? []),
    'quick-win', 'interruption', 'leads', 'jack', 'instantly',
  ]);
  return [...suggestions].filter((tag) => validTags.has(tag) && !draft.tags.includes(tag)).slice(0, 8);
}

export function parseIntakeText(
  text: string,
  todayISO: string,
  existingTasks: Task[],
  existingSubtasks: Subtask[],
): ParsedIntakeDraft {
  const normalized = normalizeIntakeText(text);
  const parsedDate = getDateFromHebrewText(normalized, todayISO);
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const numberedSubtasks: string[] = [];
  const titleLines: string[] = [];
  let sawList = false;

  lines.forEach((line) => {
    const numbered = line.match(/^(?:\d+[.)\-:]|[-•*])\s*(.+)$/);
    if (numbered) {
      sawList = true;
      const clean = stripTemporalWords(cleanTaskText(numbered[1] ?? ''));
      if (clean) numberedSubtasks.push(clean);
      return;
    }
    if (sawList) {
      const clean = stripTemporalWords(cleanTaskText(line));
      if (clean) numberedSubtasks.push(clean);
    } else {
      titleLines.push(line);
    }
  });

  if (numberedSubtasks.length > 0) {
    const titleFromLines = stripTemporalWords(cleanTaskText(titleLines.join(' ').replace(/[:\-–—]+\s*$/g, '')));
    const title = titleFromLines || numberedSubtasks[0];
    return {
      title: title.length > 90 ? `${title.slice(0, 90)}…` : title,
      subtasks: numberedSubtasks.slice(0, 10),
      date: parsedDate.date,
      label: parsedDate.label,
      sourceNote: `טקסט מקור: ${normalized}`,
    };
  }

  const candidates = splitFreeTextIntoCandidates(normalized);
  const fallback = stripTemporalWords(cleanTaskText(normalized));
  const sentenceSubtasks =
    candidates.length <= 1 ? splitSentenceSubtasks(fallback) : [];

  if (candidates.length > 1 && !shouldUseSingleParent(candidates, normalized)) {
    const reviewRows = candidates.map((candidate, index) => {
      const rowDate = getDateFromHebrewText(candidate, todayISO);
      const cleanCandidate = stripTemporalWords(cleanTaskText(candidate)) || cleanTaskText(candidate);
      const match = findBestParentTask(cleanCandidate, existingTasks, existingSubtasks);
      return {
        id: createReviewRowId(index),
        text: cleanCandidate,
        targetMode: match ? ('existing_task' as const) : ('new_task' as const),
        targetTaskId: match?.task.id ?? null,
        targetTitle: match?.task.title ?? cleanCandidate,
        date: rowDate.date,
        label: rowDate.label,
        search: '',
        confidence: match ? ('auto' as const) : ('new' as const),
      };
    });

    return {
      title: stripTemporalWords(cleanTaskText(candidates[0] ?? fallback)) || fallback,
      subtasks: reviewRows.map((row) => row.text),
      date: parsedDate.date,
      label: parsedDate.label,
      sourceNote: `טקסט מקור: ${normalized}`,
      reviewRows,
    };
  }

  const titleSource =
    sentenceSubtasks.length > 1 ? sentenceSubtasks[0] : candidates[0] ?? fallback;
  const title = stripTemporalWords(cleanTaskText(titleSource)) || fallback;
  const cleanSubtasks = (
    sentenceSubtasks.length > 1
      ? sentenceSubtasks
      : candidates.length > 0
        ? candidates
        : [fallback]
  )
    .map((c) => stripTemporalWords(cleanTaskText(c)) || cleanTaskText(c))
    .filter(Boolean);
  return {
    title: title.length > 90 ? `${title.slice(0, 90)}…` : title,
    subtasks: cleanSubtasks.length > 0 ? cleanSubtasks : [title],
    date: parsedDate.date,
    label: parsedDate.label,
    sourceNote: `טקסט מקור: ${normalized}`,
  };
}

// ─── CSS helpers ──────────────────────────────────────────────────────────────

export function getChoiceClass(isSelected: boolean, optionClassName: string): string {
  return `rounded-xl border px-3 py-1.5 text-xs font-black ring-1 transition ${optionClassName} ${
    isSelected ? 'border-slate-950 scale-[1.02] shadow-sm ring-2 ring-slate-950/30' : 'border-transparent opacity-80 hover:opacity-100'
  }`;
}

export function getProjectOptionClass(index: number): string {
  const classes = [
    'bg-sky-50 text-sky-800 ring-sky-100',
    'bg-emerald-50 text-emerald-800 ring-emerald-100',
    'bg-violet-50 text-violet-800 ring-violet-100',
    'bg-amber-50 text-amber-800 ring-amber-100',
    'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-100',
    'bg-cyan-50 text-cyan-800 ring-cyan-100',
  ];
  return classes[index % classes.length];
}

export function getDomainOptionClass(index: number): string {
  const classes = [
    'bg-slate-50 text-slate-800 ring-slate-200',
    'bg-orange-50 text-orange-800 ring-orange-100',
    'bg-teal-50 text-teal-800 ring-teal-100',
    'bg-indigo-50 text-indigo-800 ring-indigo-100',
    'bg-lime-50 text-lime-800 ring-lime-100',
    'bg-rose-50 text-rose-800 ring-rose-100',
  ];
  return classes[index % classes.length];
}

// ─── Speech ───────────────────────────────────────────────────────────────────

export type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function normalizeSpokenText(input: string): string {
  return normalizeSpokenTextWithCommands(input);
}

function collapseRepeatedSpeechChunks(input: string): string {
  return input
    .split('\n')
    .map((line) => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      if (words.length < 3) return line.trim();

      const output: string[] = [];
      let index = 0;

      while (index < words.length) {
        let matchedSize = 0;
        const maxChunkSize = Math.min(8, Math.floor((words.length - index) / 2));

        for (let size = maxChunkSize; size >= 2; size -= 1) {
          const chunk = words.slice(index, index + size).join(' ');
          const nextChunk = words.slice(index + size, index + size * 2).join(' ');
          if (chunk && chunk === nextChunk) {
            matchedSize = size;
            break;
          }
        }

        if (matchedSize > 0) {
          const chunk = words.slice(index, index + matchedSize);
          output.push(...chunk);
          index += matchedSize;
          while (words.slice(index, index + matchedSize).join(' ') === chunk.join(' ')) {
            index += matchedSize;
          }
          continue;
        }

        if (
          index + 2 < words.length &&
          words[index] === words[index + 1] &&
          words[index] === words[index + 2]
        ) {
          output.push(words[index]);
          const repeated = words[index];
          while (words[index] === repeated) index += 1;
          continue;
        }

        output.push(words[index]);
        index += 1;
      }

      return output.join(' ');
    })
    .join('\n');
}

function normalizeSpokenTextWithCommands(input: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/\b(line break|go down a line|new line)\b/gi, '\n'],
    [/\bnew paragraph\b/gi, '\n\n'],
    [/\b(next item|new item)\b/gi, '\n- '],
    [/\bcomma\b/gi, ','],
    [/\b(period|full stop)\b/gi, '.'],
    [/\bquestion mark\b/gi, '?'],
    [/\bcolon\b/gi, ':'],
    [/\bsemicolon\b/gi, ';'],
    [/\b(hyphen|dash)\b/gi, '-'],
    [/\bslash\b/gi, '/'],
    [/\b(open quote|close quote)\b/gi, '"'],
    [/\bopen parenthesis\b/gi, '('],
    [/\bclose parenthesis\b/gi, ')'],
    [/(^|[\s\n])(one|number one)(?=[\s\n]|$)/gi, '$1\n1. '],
    [/(^|[\s\n])(two|number two)(?=[\s\n]|$)/gi, '$1\n2. '],
    [/(^|[\s\n])(three|number three)(?=[\s\n]|$)/gi, '$1\n3. '],
    [/(^|[\s\n])(four|number four)(?=[\s\n]|$)/gi, '$1\n4. '],
    [/(^|[\s\n])(five|number five)(?=[\s\n]|$)/gi, '$1\n5. '],
    [/רד שורה|תרד שורה|שורה חדשה|ירידת שורה/g, '\n'],
    [/פסקה חדשה/g, '\n\n'],
    [/סעיף חדש|סעיף הבא|מקף חדש/g, '\n- '],
    [/נקודתיים|נקודותיים/g, ':'],
    [/נקודה/g, '.'],
    [/פסיק/g, ','],
    [/סימן שאלה/g, '?'],
    [/סימן קריאה/g, '!'],
    [/גרשיים|מרכאות/g, '"'],
    [/פתח סוגריים/g, '('],
    [/סגור סוגריים/g, ')'],
    [/(^|[\s\n])(אחד|מספר אחד)(?=[\s\n]|$)/g, '$1\n1. '],
    [/(^|[\s\n])(שתיים|שניים|מספר שתיים|מספר שניים)(?=[\s\n]|$)/g, '$1\n2. '],
    [/(^|[\s\n])(שלוש|מספר שלוש)(?=[\s\n]|$)/g, '$1\n3. '],
    [/(^|[\s\n])(ארבע|מספר ארבע)(?=[\s\n]|$)/g, '$1\n4. '],
    [/(^|[\s\n])(חמש|מספר חמש)(?=[\s\n]|$)/g, '$1\n5. '],
    [/(^|[\s\n])(שש|מספר שש)(?=[\s\n]|$)/g, '$1\n6. '],
    [/(^|[\s\n])(שבע|מספר שבע)(?=[\s\n]|$)/g, '$1\n7. '],
    [/(^|[\s\n])(שמונה|מספר שמונה)(?=[\s\n]|$)/g, '$1\n8. '],
    [/(^|[\s\n])(תשע|מספר תשע)(?=[\s\n]|$)/g, '$1\n9. '],
    [/(^|[\s\n])(עשר|מספר עשר)(?=[\s\n]|$)/g, '$1\n10. '],
  ];

  return replacements
    .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), input)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => collapseRepeatedSpeechChunks(line))
    .join('\n')
    .trim();
}

function normalizeSpokenTextLegacy(input: string): string {
  return input
    .replace(/\bline break\b|\bgo down a line\b/gi, '\n')
    .replace(/\bnew line\b/gi, '\n')
    .replace(/\bnew paragraph\b/gi, '\n\n')
    .replace(/\bcomma\b/gi, ',')
    .replace(/\bperiod\b|\bfull stop\b/gi, '.')
    .replace(/\bquestion mark\b/gi, '?')
    .replace(/\bcolon\b/gi, ':')
    .replace(/\bsemicolon\b/gi, ';')
    .replace(/\bhyphen\b|\bdash\b/gi, '-')
    .replace(/\bslash\b/gi, '/')
    .replace(/\bopen quote\b/gi, '"')
    .replace(/\bclose quote\b/gi, '"')
    .replace(/\bopen parenthesis\b/gi, '(')
    .replace(/\bclose parenthesis\b/gi, ')')
    .replace(/\bnext item\b/gi, '\n- ')
    .replace(/\bone\b/gi, '\n1. ')
    .replace(/\btwo\b/gi, '\n2. ')
    .replace(/\bthree\b/gi, '\n3. ')
    .replace(/\bfour\b/gi, '\n4. ')
    .replace(/\bfive\b/gi, '\n5. ')
    .replace(/רד שורה/g, '\n')
    .replace(/תרד שורה/g, '\n')
    .replace(/שורה חדשה/g, '\n')
    .replace(/ירידת שורה/g, '\n')
    .replace(/פסקה חדשה/g, '\n\n')
    .replace(/סעיף חדש/g, '\n- ')
    .replace(/מקף חדש/g, '\n- ')
    .replace(/נקודתיים/g, ':')
    .replace(/נקודותיים/g, ':')
    .replace(/סימן שאלה/g, '?')
    .replace(/סימן קריאה/g, '!')
    .replace(/גרשיים/g, '"')
    .replace(/מרכאות/g, '"')
    .replace(/פתח סוגריים/g, '(')
    .replace(/סגור סוגריים/g, ')')
    .replace(/(^|[\s\n])אחד(?=[\s\n]|$)/g, '$1\n1. ')
    .replace(/(^|[\s\n])שתיים(?=[\s\n]|$)/g, '$1\n2. ')
    .replace(/(^|[\s\n])שניים(?=[\s\n]|$)/g, '$1\n2. ')
    .replace(/(^|[\s\n])שלוש(?=[\s\n]|$)/g, '$1\n3. ')
    .replace(/(^|[\s\n])ארבע(?=[\s\n]|$)/g, '$1\n4. ')
    .replace(/(^|[\s\n])חמש(?=[\s\n]|$)/g, '$1\n5. ')
    .replace(/(^|[\s\n])שש(?=[\s\n]|$)/g, '$1\n6. ')
    .replace(/(^|[\s\n])שבע(?=[\s\n]|$)/g, '$1\n7. ')
    .replace(/(^|[\s\n])שמונה(?=[\s\n]|$)/g, '$1\n8. ')
    .replace(/(^|[\s\n])תשע(?=[\s\n]|$)/g, '$1\n9. ')
    .replace(/(^|[\s\n])עשר(?=[\s\n]|$)/g, '$1\n10. ')
    .replace(/שורה חדשה/g, '\n')
    .replace(/פסקה חדשה/g, '\n\n')
    .replace(/סעיף חדש/g, '\n- ')
    .replace(/נקודה/g, '.')
    .replace(/פסיק/g, ',')
    .replace(/סימן שאלה/g, '?')
    .replace(/נקודתיים/g, ':')
    .replace(/נקודה פסיק/g, ';')
    .replace(/מקף/g, '-')
    .replace(/סלאש/g, '/')
    .replace(/פתח סוגריים/g, '(')
    .replace(/סגור סוגריים/g, ')')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function mergeSpeechIntoDraft(baseText: string, spokenText: string): string {
  const normalized = normalizeSpokenText(spokenText);
  if (!normalized) return baseText;
  if (!baseText.trim()) return normalized;
  const needsNewLine = /\n$/.test(baseText) || /^[-•]/.test(normalized);
  return `${baseText}${needsNewLine ? '' : ' '}${normalized}`;
}
