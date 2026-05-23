import type { AppSettings } from '../settings/settingsTypes';
import type { BacklogGroup, SubtaskStatus, Task, TaskBucket, TaskEffort, TaskPriority } from '../tasks/taskTypes';

export type DailyReportImportSection = 'completed' | 'in_progress' | 'tomorrow' | 'weekly' | 'backlog';

export interface ImportSubtaskDraft {
  title: string;
  status: SubtaskStatus;
}

export interface DuplicateCandidate {
  taskId: string;
  title: string;
  score: number;
  reason: string;
}

export interface DailyReportImportTaskDraft {
  importId: string;
  section: DailyReportImportSection;
  originalLine: string;
  title: string;
  percent: number | null;
  projectId: string;
  domainId: string;
  bucket: TaskBucket;
  backlogGroup: BacklogGroup | null;
  date: string | null;
  scheduledTimeLabel: string;
  priority: TaskPriority;
  effort: TaskEffort;
  isQuickWin: boolean;
  tags: string[];
  whyNow?: string;
  notes?: string;
  subtasks: ImportSubtaskDraft[];
  duplicateCandidates: DuplicateCandidate[];
  /** If set, this imported task should be merged as new subtasks into an existing parent task. */
  mergeTargetTaskId?: string | null;
  selectedByDefault: boolean;
}

export interface DailyReportLeadSnapshot {
  lines: string[];
  clinicCount?: number;
  countryCount?: number;
}

export interface DailyReportImportPreview {
  sourceDate: string | null;
  targetDate: string;
  tasks: DailyReportImportTaskDraft[];
  notes: string[];
  leadSnapshot: DailyReportLeadSnapshot;
  summary: {
    total: number;
    selectedByDefault: number;
    possibleDuplicates: number;
    completed: number;
    inProgress: number;
    tomorrow: number;
    weekly: number;
    backlog: number;
  };
}

export interface DailyReportParseOptions {
  settings: AppSettings | null;
  existingTasks: Task[];
  targetDate: string;
}

const sectionAliases: Array<[RegExp, DailyReportImportSection | 'notes']> = [
  [/^completed\s*:/i, 'completed'],
  [/^in\s*progress\s*:/i, 'in_progress'],
  [/^(not\s*started\s*\/\s*tomorrow|not\s*started|tomorrow)\s*:/i, 'tomorrow'],
  [/^weekly\s*:/i, 'weekly'],
  [/^backlog\s*:/i, 'backlog'],
  [/^notes\s*:/i, 'notes'],
];

const sectionLabels: Record<DailyReportImportSection, string> = {
  completed: 'בוצע',
  in_progress: 'בתהליך',
  tomorrow: 'מחר / להיום',
  weekly: 'שבועי',
  backlog: 'Backlog',
};

function cleanLine(line: string): string {
  return line
    .replace(/^[-•*]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPercent(line: string): number | null {
  const match = line.match(/\((\d{1,3})%\)/);
  if (!match) return null;
  return Math.max(0, Math.min(100, Number(match[1])));
}

function stripPercent(line: string): string {
  return cleanLine(line.replace(/\(\d{1,3}%\)/g, ''));
}

function parseReportDate(text: string): string | null {
  const match = text.match(/Daily\s+Report\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!match) return null;
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  return `${match[3]}-${month}-${day}`;
}

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'׳״`]/g, '')
    .replace(/[—–\-_/|:()\[\],.!?;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): Set<string> {
  const stopWords = new Set(['את', 'של', 'עם', 'על', 'אל', 'זה', 'the', 'and', 'for', 'to', 'of', 'in', 'a']);
  return new Set(
    normalizeForSearch(value)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !stopWords.has(token)),
  );
}

function getOverlapScore(a: string, b: string): number {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) overlap += 1;
  });

  const containmentBonus = normalizeForSearch(a).includes(normalizeForSearch(b)) || normalizeForSearch(b).includes(normalizeForSearch(a)) ? 0.2 : 0;
  return Math.min(1, overlap / Math.min(aTokens.size, bTokens.size) + containmentBonus);
}

function findDuplicates(title: string, existingTasks: Task[]): DuplicateCandidate[] {
  return existingTasks
    .filter((task) => task.statusOverride !== 'cancelled' && !task.completedAt)
    .map((task) => ({
      taskId: task.id,
      title: task.title,
      score: getOverlapScore(title, task.title),
      reason: 'דמיון בשם המשימה / מילות מפתח',
    }))
    .filter((candidate) => candidate.score >= 0.48)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function firstExistingId(settings: AppSettings | null, type: 'project' | 'domain', fallback: string): string {
  const items = type === 'project' ? settings?.projects : settings?.domains;
  if (!items?.length) return fallback;
  return items.find((item) => item.id === fallback)?.id ?? items.find((item) => item.isActive)?.id ?? items[0].id;
}

function inferProjectId(title: string, settings: AppSettings | null): string {
  const text = normalizeForSearch(title);
  if (/typeswitch|פטנט|יעקב|סבטלנה/.test(text)) return firstExistingId(settings, 'project', 'typeswitch');
  if (/mission control|backend|supabase|db|logs|משימות/.test(text)) return firstExistingId(settings, 'project', 'mission-control');
  if (/alignersworld|shopify/.test(text)) return firstExistingId(settings, 'project', 'alignersworld');
  if (/finance|תזרים|upay|payme|netflix|partner|אישי/.test(text)) return firstExistingId(settings, 'project', text.includes('אישי') || text.includes('netflix') ? 'personal' : 'finance');
  return firstExistingId(settings, 'project', 'timeraligner');
}

function inferDomainId(title: string, settings: AppSettings | null): string {
  const text = normalizeForSearch(title);
  if (/apollo/.test(text)) return firstExistingId(settings, 'domain', 'apollo');
  if (/shopify|checkout|cart/.test(text)) return firstExistingId(settings, 'domain', 'shopify');
  if (/website|patient|mobile|qa|תיקונים|אתר/.test(text)) return firstExistingId(settings, 'domain', 'website-qa');
  if (/jack|packaging|fulfillment|מחסן|ייצור|אריזה|supplier/.test(text)) return firstExistingId(settings, 'domain', 'production');
  if (/instagram|linkedin|פרסומת|קריאייטיב|social|content|שיווק/.test(text)) return firstExistingId(settings, 'domain', 'marketing');
  if (/finance|תזרים|upay|payme/.test(text)) return firstExistingId(settings, 'domain', 'finance');
  if (/אישי|netflix|partner|אמא|סבתא/.test(text)) return firstExistingId(settings, 'domain', 'personal');
  if (/backend|db|logs|supabase|פיתוח/.test(text)) return firstExistingId(settings, 'domain', 'development');
  if (/lead|leads|locator|invisalign|clinics|קליניקות|מכירות/.test(text)) return firstExistingId(settings, 'domain', 'sales');
  return firstExistingId(settings, 'domain', 'operations');
}

function inferTags(title: string, section: DailyReportImportSection): string[] {
  const text = normalizeForSearch(title);
  const tags = new Set<string>(['imported-report', section]);

  const rules: Array<[RegExp, string[]]> = [
    [/apollo/, ['apollo', 'leads', 'research']],
    [/invisalign|clinics|locator|קליניקות/, ['invisalign', 'clinics', 'lead-strategy']],
    [/website|patient|mobile|qa|אתר/, ['website', 'qa']],
    [/shopify|checkout|cart/, ['shopify', 'checkout']],
    [/alignersworld|linkedin|מחקר/, ['alignersworld', 'content']],
    [/instagram|following|social/, ['instagram', 'social']],
    [/jack|supplier|ייצור|דגם/, ['jack', 'supplier', 'production']],
    [/packaging|fulfillment|מחסן|אריזה/, ['packaging', 'logistics']],
    [/finance|תזרים|upay|payme/, ['finance']],
    [/typeswitch|פטנט|סבטלנה|יעקב/, ['typeswitch', 'patent']],
    [/mission control|backend|supabase|db|logs/, ['mission-control', 'future']],
    [/פרסומת|וידאו|קריאייטיב/, ['creative', 'ads']],
    [/אישי|netflix|partner/, ['personal']],
  ];

  rules.forEach(([regex, values]) => {
    if (regex.test(text)) values.forEach((tag) => tags.add(tag));
  });

  return Array.from(tags).slice(0, 10);
}

function inferPriority(title: string, section: DailyReportImportSection): TaskPriority {
  const text = normalizeForSearch(title);
  if (section === 'completed') return 'low';
  if (/apollo|website|checkout|jack|lead|leads|money|כסף|ייצור/.test(text)) return 'high';
  if (section === 'tomorrow' || section === 'in_progress') return 'medium';
  return 'low';
}

function inferEffort(title: string): TaskEffort {
  const text = normalizeForSearch(title);
  if (/לרשום|לסמן|לשמור|תזכורת|follow|פולואפ|נטפליקס|netflix/.test(text)) return 'quick';
  if (/apollo|backend|supabase|website|מחקר|strategy|אסטרטגיית|packaging/.test(text)) return 'deep';
  return 'medium';
}

function getActionTextFromTitle(title: string): string {
  const parts = title.split(/\s+[—–-]\s+/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(' — ') : title;
}

function buildSubtasks(title: string, section: DailyReportImportSection, percent: number | null): ImportSubtaskDraft[] {
  const action = getActionTextFromTitle(title);

  if (section === 'completed' || percent === 100) {
    return [{ title: `בוצע: ${action}`, status: 'done' }];
  }

  if (section === 'in_progress') {
    if ((percent ?? 0) >= 50) {
      return [
        { title: `מה שכבר בוצע מתוך: ${action}`, status: 'done' },
        { title: `להמשיך טיפול: ${action}`, status: 'started' },
      ];
    }

    return [{ title: `להמשיך טיפול: ${action}`, status: 'started' }];
  }

  if (section === 'weekly') {
    return [{ title: `לבצע השבוע: ${action}`, status: 'not_started' }];
  }

  return [{ title: action, status: 'not_started' }];
}

function getBucketForSection(section: DailyReportImportSection): { bucket: TaskBucket; backlogGroup: BacklogGroup | null; scheduledTimeLabel: string } {
  if (section === 'completed') return { bucket: 'today', backlogGroup: null, scheduledTimeLabel: 'יובא מדוח — בוצע' };
  if (section === 'in_progress') return { bucket: 'today', backlogGroup: null, scheduledTimeLabel: 'יובא מדוח — בתהליך' };
  if (section === 'tomorrow') return { bucket: 'today', backlogGroup: null, scheduledTimeLabel: 'יובא מדוח — להיום' };
  if (section === 'weekly') return { bucket: 'weekly', backlogGroup: null, scheduledTimeLabel: 'יובא מדוח — שבועי' };
  return { bucket: 'backlog', backlogGroup: 'later', scheduledTimeLabel: 'יובא מדוח — Backlog' };
}

function extractLeadSnapshot(notes: string[]): DailyReportLeadSnapshot {
  const lines = notes.filter((line) => /apollo|invisalign|clinic|clinics|countries|קליניקות|מדינות/i.test(line));
  const joined = lines.join(' ');
  const clinicMatch = joined.match(/(\d+)\s+clinics/i) ?? joined.match(/(\d+)\s+קליניקות/i);
  const countryMatch = joined.match(/(\d+)\s+countries/i) ?? joined.match(/(\d+)\s+מדינות/i);

  return {
    lines,
    clinicCount: clinicMatch ? Number(clinicMatch[1]) : undefined,
    countryCount: countryMatch ? Number(countryMatch[1]) : undefined,
  };
}

function getSection(line: string): DailyReportImportSection | 'notes' | null {
  for (const [regex, section] of sectionAliases) {
    if (regex.test(line.trim())) return section;
  }
  return null;
}

export function parseDailyReportImport(text: string, options: DailyReportParseOptions): DailyReportImportPreview {
  const sourceDate = parseReportDate(text);
  const notes: string[] = [];
  const tasks: DailyReportImportTaskDraft[] = [];
  let currentSection: DailyReportImportSection | 'notes' | null = null;
  let lastTask: DailyReportImportTaskDraft | null = null;

  const createTaskDraft = (line: string, index: number): DailyReportImportTaskDraft | null => {
    if (!currentSection || currentSection === 'notes') return null;
    const percent = extractPercent(line);
    const title = stripPercent(line);
    if (!title) return null;

    const { bucket, backlogGroup, scheduledTimeLabel } = getBucketForSection(currentSection);
    const effort = inferEffort(title);
    const duplicateCandidates = findDuplicates(title, options.existingTasks);
    const strongDuplicate = duplicateCandidates.some((candidate) => candidate.score >= 0.72);
    const date = bucket === 'today' ? options.targetDate : bucket === 'weekly' ? null : null;

    return {
      importId: `import-${currentSection}-${index}`,
      section: currentSection,
      originalLine: line,
      title,
      percent,
      projectId: inferProjectId(title, options.settings),
      domainId: inferDomainId(title, options.settings),
      bucket,
      backlogGroup,
      date,
      scheduledTimeLabel,
      priority: inferPriority(title, currentSection),
      effort,
      isQuickWin: effort === 'quick',
      tags: inferTags(title, currentSection),
      whyNow: `יובא מדוח יומי (${sectionLabels[currentSection]}).`,
      notes: undefined,
      subtasks: [],
      duplicateCandidates,
      selectedByDefault: !strongDuplicate,
    };
  };

  text
    .replace(/\r/g, '')
    .split('\n')
    .forEach((rawLine, index) => {
      if (!rawLine.trim()) return;
      const trimmed = rawLine.trim();
      const indent = rawLine.search(/\S|$/);
      const nextSection = getSection(trimmed);
      if (nextSection) {
        currentSection = nextSection;
        lastTask = null;
        return;
      }

      if (!currentSection) return;

      if (currentSection === 'notes') {
        const note = cleanLine(trimmed);
        if (note) notes.push(note);
        return;
      }

      if (!/^[-•*]\s+/.test(trimmed)) return;

      const isChecklistSubtask = /^[-•*]\s+\[[ xX]\]\s+/.test(trimmed);
      const checklistDone = /^[-•*]\s+\[[xX]\]\s+/.test(trimmed);
      const isIndentedSubtask = indent > 0;
      const shouldAttachToParent = Boolean(lastTask && (isChecklistSubtask || isIndentedSubtask));

      if (shouldAttachToParent && lastTask) {
        const title = cleanLine(trimmed.replace(/^[-•*]\s+\[[ xX]\]\s+/, '- '));
        if (title) {
          lastTask.subtasks.push({ title, status: checklistDone ? 'done' : 'not_started' });
        }
        return;
      }

      const task = createTaskDraft(trimmed, index);
      if (!task) return;
      tasks.push(task);
      lastTask = task;
    });

  const tasksWithDefaultSubtasks = tasks.map((task) => ({
    ...task,
    subtasks: task.subtasks.length > 0 ? task.subtasks : buildSubtasks(task.title, task.section, task.percent),
  }));

  const leadSnapshot = extractLeadSnapshot(notes);
  const enrichedTasks = tasksWithDefaultSubtasks.map((task) => {
    if (/apollo|invisalign|clinic|clinics|קליניקות/i.test(task.title) && leadSnapshot.lines.length > 0) {
      return {
        ...task,
        notes: [`Lead snapshot:`, ...leadSnapshot.lines].join('\n'),
        tags: Array.from(new Set([...task.tags, 'lead-snapshot'])),
      };
    }
    return task;
  });

  return {
    sourceDate,
    targetDate: options.targetDate,
    tasks: enrichedTasks,
    notes,
    leadSnapshot,
    summary: {
      total: enrichedTasks.length,
      selectedByDefault: enrichedTasks.filter((task) => task.selectedByDefault).length,
      possibleDuplicates: enrichedTasks.filter((task) => task.duplicateCandidates.length > 0).length,
      completed: enrichedTasks.filter((task) => task.section === 'completed').length,
      inProgress: enrichedTasks.filter((task) => task.section === 'in_progress').length,
      tomorrow: enrichedTasks.filter((task) => task.section === 'tomorrow').length,
      weekly: enrichedTasks.filter((task) => task.section === 'weekly').length,
      backlog: enrichedTasks.filter((task) => task.section === 'backlog').length,
    },
  };
}

export function getImportSectionLabel(section: DailyReportImportSection): string {
  return sectionLabels[section];
}
