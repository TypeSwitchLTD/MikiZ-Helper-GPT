import type { AppSettings } from '../settings/settingsTypes';
import type { Reminder } from '../reminders/reminderTypes';
import type { Subtask, Task } from '../tasks/taskTypes';
import { getTaskProgress } from '../tasks/taskProgress';
import { getSubtasksForTask } from '../tasks/taskSelectors';
import type { WeatherBrief } from './weather';

export interface BuildMorningBriefingInput {
  todayISO: string;
  settings: AppSettings | null;
  tasks: Task[];
  subtasks: Subtask[];
  reminders?: Reminder[];
  leadTaskCount: number;
  weather?: WeatherBrief | null;
}

// Future morning sources to wire later: Google Calendar, inbox/WhatsApp/LinkedIn,
// finance/open invoices, people waiting for replies, and project bottlenecks.

const MORNING_TOP_TASK_LIMIT = 3;
const MORNING_BACKLOG_LIMIT = 2;
const MORNING_REMINDER_LIMIT = 3;
const MAX_SPOKEN_WORDS = 12;
const MAX_BRIEFING_CHARS = 1300;

export interface BriefingTaskLine {
  id: string;
  title: string;
  projectId: string;
  domainId: string;
  status: string;
  percent: number;
  priority: Task['priority'];
  effort: Task['effort'];
  movedCount: number;
  tags: string[];
  bucket: Task['bucket'];
  backlogGroup?: Task['backlogGroup'];
  updatedAt?: string;
}

export interface DayPlanBlock {
  time: string;
  title: string;
  description: string;
  tone: 'start' | 'exercise' | 'deep' | 'leads' | 'light' | 'close';
}

export interface MorningCommandPlan {
  topTasks: BriefingTaskLine[];
  quickOpeners: BriefingTaskLine[];
  doNotDelayTask: BriefingTaskLine | null;
  planBlocks: DayPlanBlock[];
}

function dateFromISO(dateISO: string): Date {
  return new Date(`${dateISO}T12:00:00`);
}

function formatHebrewDay(dateISO: string): string {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(dateFromISO(dateISO));
}

function hebrewNumber(value: number): string {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
  const parts: string[] = [];
  let n = value;
  while (n >= 400) {
    parts.push('ת');
    n -= 400;
  }
  if (n >= 100) {
    const h = Math.floor(n / 100);
    parts.push(hundreds[h]);
    n %= 100;
  }
  if (n === 15) return `${parts.join('')}ט״ו`;
  if (n === 16) return `${parts.join('')}ט״ז`;
  if (n >= 10) {
    const t = Math.floor(n / 10);
    parts.push(tens[t]);
    n %= 10;
  }
  if (n > 0) parts.push(ones[n]);
  const raw = parts.join('');
  if (raw.length <= 1) return raw;
  return `${raw.slice(0, -1)}״${raw.slice(-1)}`;
}

export function formatHebrewCalendarDateLetters(dateISO: string): string {
  try {
    const parts = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long' }).formatToParts(dateFromISO(dateISO));
    const day = Number(parts.find((part) => part.type === 'day')?.value ?? 0);
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    const dayLetters = day > 0 ? hebrewNumber(day) : '';
    return [dayLetters, month ? `ב${month}` : ''].filter(Boolean).join(' ');
  } catch {
    return '';
  }
}

function seededIndex(dateISO: string, length: number): number {
  if (length <= 1) return 0;
  const seed = dateISO.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return seed % length;
}

function compactText(value: string, maxWords = MAX_SPOKEN_WORDS): string {
  const words = value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function dayDiff(dateISO: string | null | undefined, todayISO: string): number | null {
  if (!dateISO) return null;
  const date = Date.parse(`${dateISO.slice(0, 10)}T12:00:00`);
  const today = Date.parse(`${todayISO}T12:00:00`);
  if (!Number.isFinite(date) || !Number.isFinite(today)) return null;
  return Math.round((date - today) / 86_400_000);
}

function daysSince(dateTime: string | null | undefined, todayISO: string): number {
  if (!dateTime) return 999;
  const value = Date.parse(dateTime);
  const today = Date.parse(`${todayISO}T23:59:59`);
  if (!Number.isFinite(value) || !Number.isFinite(today)) return 999;
  return Math.max(0, Math.floor((today - value) / 86_400_000));
}

function toBriefingTaskLine(task: Task, progress: ReturnType<typeof getTaskProgress>): BriefingTaskLine {
  return {
    id: task.id,
    title: task.title,
    projectId: task.projectId,
    domainId: task.domainId,
    status: progress.status,
    percent: progress.percent,
    priority: task.priority,
    effort: task.effort,
    movedCount: task.movedCount,
    tags: task.tags,
    bucket: task.bucket,
    backlogGroup: task.backlogGroup,
    updatedAt: task.updatedAt,
  };
}

function scoreMorningTask(task: Task, progress: ReturnType<typeof getTaskProgress>, todayISO: string): number {
  const priorityWeight: Record<Task['priority'], number> = { high: 85, medium: 45, low: 15 };
  const effortWeight: Record<Task['effort'], number> = { quick: 12, medium: 6, deep: 0 };
  const backlogWeight: Record<string, number> = { tomorrow: 35, this_week: 25, waiting: 10, later: -5 };
  const diff = dayDiff(task.date, todayISO);
  const updatedAge = daysSince(task.updatedAt, todayISO);
  const createdAge = daysSince(task.createdAt, todayISO);
  const tags = task.tags ?? [];
  const important = tags.includes('morning-important') || tags.includes('important') || tags.includes('urgent') ? 90 : 0;
  const focus = typeof task.focusOrder === 'number' ? Math.max(0, 40 - task.focusOrder / 100) : 0;
  const dateScore =
    diff === null
      ? 0
      : diff === 0
        ? 60
        : diff < 0
          ? Math.max(-35, 25 - Math.abs(diff) * 8)
          : diff === 1
            ? 12
            : -30;
  const recencyScore = updatedAge <= 1 ? 35 : updatedAge <= 3 ? 22 : updatedAge <= 7 ? 8 : updatedAge >= 21 ? -35 : -8;
  const createdScore = createdAge <= 2 ? 20 : createdAge >= 21 ? -15 : 0;
  const progressScore = progress.status === 'in_progress' ? 45 : progress.startedCount > 0 ? 25 : 0;
  const bucketScore =
    task.bucket === 'today'
      ? 25
      : task.bucket === 'backlog'
        ? backlogWeight[task.backlogGroup ?? 'later'] ?? -5
        : -20;
  const movedPenalty = Math.min(task.movedCount ?? 0, 8) * -7;
  const stalePenalty = updatedAge >= 30 && task.priority !== 'high' && !important ? -45 : 0;

  return important + priorityWeight[task.priority] + effortWeight[task.effort] + focus + dateScore + recencyScore + createdScore + progressScore + bucketScore + movedPenalty + stalePenalty;
}

export function pickMorningTasks(tasks: Task[], subtasks: Subtask[], todayISO: string, limit = 3): BriefingTaskLine[] {
  return tasks
    .filter(isVisibleTask)
    .filter((task) => task.bucket === 'today' || task.bucket === 'backlog')
    .map((task) => {
      const taskSubtasks = getSubtasksForTask(task.id, subtasks);
      const progress = getTaskProgress(task, taskSubtasks);
      return { task, progress, score: scoreMorningTask(task, progress, todayISO) };
    })
    .filter(({ progress }) => progress.status !== 'done' && progress.status !== 'cancelled')
    .sort((a, b) => {
      const updatedB = Date.parse(b.task.updatedAt ?? '') || 0;
      const updatedA = Date.parse(a.task.updatedAt ?? '') || 0;
      return b.score - a.score || updatedB - updatedA || a.task.title.localeCompare(b.task.title);
    })
    .slice(0, limit)
    .map(({ task, progress }) => toBriefingTaskLine(task, progress));
}

function cleanTaskTitle(title: string): string {
  return title
    .replace(/\s*[-—]\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTaskLine(task: BriefingTaskLine, index: number): string {
  const title = compactText(cleanTaskTitle(task.title), 14);
  return `${index + 1}. ${title}.`;
}

function getWeatherLine(weather: WeatherBrief | null | undefined, settings: AppSettings | null): string {
  const place = weather?.cityLabel || settings?.location.label || settings?.location.city || 'אצלך';
  if (weather?.morningTempC != null || weather?.noonTempC != null) {
    const morning = weather.morningTempC != null ? `${weather.morningTempC} מעלות` : null;
    const noon = weather.noonTempC != null ? `${weather.noonTempC} מעלות` : null;
    const temps = [morning && `${morning} בבוקר`, noon && `${noon} בצהריים`].filter(Boolean).join(', ');
    const desc = weather.description ? ` ${weather.description}` : '';
    return `${place}: ${temps}.${desc}`;
  }
  return `מזג האוויר ב${place} לא נטען.`;
}

function getMotivationLine(todayISO: string, settings: AppSettings | null): string {
  if (settings?.morningBriefing?.motivationLine?.trim()) {
    return settings.morningBriefing.motivationLine.trim();
  }
  const lines = [
    'לא צריך לנצח את כל היום בבת אחת — רק את הצעד הראשון.',
    'תנועה קטנה עכשיו שווה יותר מתכנון מושלם אחר כך.',
    'היום מתחיל כשאתה מתחיל, לא כשהכול מסודר.',
    'פוקוס על דבר אחד יכול לשנות את כל היום.',
  ];
  return lines[seededIndex(todayISO, lines.length)];
}

function isVisibleTask(task: Task): boolean {
  return !task.deletedAt && task.statusOverride !== 'cancelled' && !task.completedAt && !task.cancelledAt;
}

function getBacklogTasks(tasks: Task[], subtasks: Subtask[], todayISO: string, limit = MORNING_BACKLOG_LIMIT): BriefingTaskLine[] {
  return tasks
    .filter(isVisibleTask)
    .filter((task) => task.bucket === 'backlog')
    .map((task) => {
      const taskSubtasks = getSubtasksForTask(task.id, subtasks);
      const progress = getTaskProgress(task, taskSubtasks);
      return { task, progress, score: scoreMorningTask(task, progress, todayISO) };
    })
    .filter(({ progress }) => progress.status !== 'done' && progress.status !== 'cancelled')
    .sort((a, b) => {
      const updatedB = Date.parse(b.task.updatedAt ?? '') || 0;
      const updatedA = Date.parse(a.task.updatedAt ?? '') || 0;
      return b.score - a.score || updatedB - updatedA || a.task.title.localeCompare(b.task.title);
    })
    .slice(0, limit)
    .map(({ task, progress }) => toBriefingTaskLine(task, progress));
}

function getOpenBacklogCount(tasks: Task[], subtasks: Subtask[]): number {
  return tasks
    .filter(isVisibleTask)
    .filter((task) => task.bucket === 'backlog')
    .filter((task) => {
      const progress = getTaskProgress(task, getSubtasksForTask(task.id, subtasks));
      return progress.status !== 'done' && progress.status !== 'cancelled';
    })
    .length;
}

function getReminderDayPart(remindAt: string): string {
  const raw = remindAt.includes('T') ? remindAt.split('T')[1]?.slice(0, 5) : '';
  const hour = raw ? Number(raw.slice(0, 2)) : new Date(remindAt).getHours();
  if (!Number.isFinite(hour)) return '';
  if (hour < 11) return 'בבוקר';
  if (hour < 16) return 'בצהריים';
  if (hour < 20) return 'בערב';
  return 'בלילה';
}

function getTodayReminderLines(input: BuildMorningBriefingInput): string[] {
  return (input.reminders ?? [])
    .filter((reminder) => reminder.status === 'pending')
    .filter((reminder) => reminder.remindAt.slice(0, 10) <= input.todayISO)
    .sort((a, b) => a.remindAt.localeCompare(b.remindAt))
    .slice(0, 6)
    .map((reminder, index) => {
      const dayPart = getReminderDayPart(reminder.remindAt);
      const reminderDate = reminder.remindAt.slice(0, 10);
      const prefix = reminderDate < input.todayISO ? 'נגררת - ' : '';
      const note = reminder.note?.trim();
      return `${index + 1}. ${prefix}${dayPart ? `${dayPart} - ` : ''}${reminder.title.trim()}${note ? `: ${note}` : ''}.`;
    });
}

function getTodayReminderBriefLines(input: BuildMorningBriefingInput): string[] {
  const reminders = (input.reminders ?? [])
    .filter((reminder) => reminder.status === 'pending')
    .filter((reminder) => reminder.remindAt.slice(0, 10) <= input.todayISO)
    .sort((a, b) => a.remindAt.localeCompare(b.remindAt));

  const lines = reminders.slice(0, MORNING_REMINDER_LIMIT).map((reminder, index) => {
    const dayPart = getReminderDayPart(reminder.remindAt);
    const reminderDate = reminder.remindAt.slice(0, 10);
    const prefix = reminderDate < input.todayISO ? 'נגררת - ' : '';
    const noteHint = reminder.note?.trim() ? ' יש הערה מצורפת.' : '';
    return `${index + 1}. ${prefix}${dayPart ? `${dayPart} - ` : ''}${compactText(reminder.title.trim(), 10)}.${noteHint}`;
  });

  const hiddenCount = reminders.length - lines.length;
  if (hiddenCount > 0) {
    lines.push(`ועוד ${hiddenCount} תזכורות, לא מקריא עכשיו.`);
  }
  return lines;
}

function getHolidayReminderLines(weather: WeatherBrief | null | undefined): string[] {
  return (weather?.upcomingHolidays ?? [])
    .filter((holiday) => holiday.daysUntil >= 0 && holiday.daysUntil <= 3)
    .map((holiday) => {
      const prefix =
        holiday.daysUntil === 0
          ? 'היום'
          : holiday.daysUntil === 1
            ? 'מחר'
            : holiday.daysUntil === 2
              ? 'עוד יומיים'
              : 'עוד 3 ימים';
      const times = [
        holiday.candlesTime ? `כניסה ${holiday.candlesTime}` : '',
        holiday.havdalahTime ? `יציאה ${holiday.havdalahTime}` : '',
      ].filter(Boolean).join(', ');
      return `${prefix} ${holiday.name}${times ? `, ${times}` : ''}.`;
    });
}

function getOpeningLines(input: BuildMorningBriefingInput, nickname: string): string[] {
  const morning = input.settings?.morningBriefing;
  const dayText = formatHebrewDay(input.todayISO);
  const hebrewDate = formatHebrewCalendarDateLetters(input.todayISO);
  const lines = [`בוקר טוב ${nickname}.`];
  if (morning?.includeDate !== false) {
    lines.push(`היום ${dayText}${hebrewDate ? `, ${hebrewDate}` : ''}.`);
  }
  if (morning?.includeWeather !== false) {
    lines.push(getWeatherLine(input.weather, input.settings));
  }
  if (input.weather?.shabbatTime) {
    lines.push(`${input.weather.shabbatLabel ?? 'שקיעה'} ב-${input.weather.shabbatTime}.`);
  }
  return lines;
}

function getImportantTaskNote(topTasks: BriefingTaskLine[], todayCount: number): string | null {
  const delayed = topTasks.find((task) => task.movedCount >= 2);
  if (delayed) return `הערה חשובה: ${cleanTaskTitle(delayed.title)} נדחתה כבר ${delayed.movedCount} פעמים.`;
  const inProgress = topTasks.find((task) => task.status === 'in_progress');
  if (inProgress) return `הערה חשובה: ${cleanTaskTitle(inProgress.title)} כבר בתהליך.`;
  if (todayCount >= 7) return `הערה חשובה: יש ${todayCount} משימות להיום. כדאי לשמור את הפוקוס על הראשונות.`;
  return null;
}

function getReminderConclusion(reminderCount: number, holidayCount: number): string | null {
  if (reminderCount >= 3) return `מסקנה חשובה: יש ${reminderCount} תזכורות היום. לא לפספס את הראשונה.`;
  if (holidayCount > 0 && reminderCount === 0) return 'מסקנה חשובה: אין תזכורות עבודה להיום, רק תזכורות לוח שנה.';
  return null;
}

function clampBriefingText(text: string): string {
  if (text.length <= MAX_BRIEFING_CHARS) return text;
  const trimmed = text.slice(0, MAX_BRIEFING_CHARS).replace(/\s+\S*$/, '').trim();
  return `${trimmed}\nזה מספיק לבוקר. השאר נשאר במערכת.`;
}

function getClosing(todayISO: string, settings: AppSettings | null): string {
  const customClosing = settings?.morningBriefing?.closingLine?.trim();
  if (customClosing) return customClosing;
  const closings = [
    'יום נקי, מיקי. מתחילים.',
    'זהו. קצר ומסודר. מתחילים.',
    'קדימה מיקי. דבר ראשון, משימה אחת.',
  ];
  return closings[seededIndex(todayISO, closings.length)];
}

export function buildMorningCommandPlan(input: BuildMorningBriefingInput): MorningCommandPlan {
  const topTasks = pickMorningTasks(input.tasks, input.subtasks, input.todayISO, 3);
  const quickOpeners = pickMorningTasks(input.tasks.filter((task) => task.effort === 'quick' || task.isQuickWin), input.subtasks, input.todayISO, 2);
  const doNotDelayTask = pickMorningTasks(input.tasks.filter((task) => task.movedCount >= 1 || task.priority === 'high'), input.subtasks, input.todayISO, 1)[0] ?? topTasks[0] ?? null;
  const workStart = input.settings?.workday.startTime || '09:00';
  const workEnd = input.settings?.workday.endTime || '18:30';
  const firstTask = topTasks[0]?.title ? cleanTaskTitle(topTasks[0].title) : 'בחירת משימה אחת ברורה';
  const secondTask = topTasks[1]?.title ? cleanTaskTitle(topTasks[1].title) : 'משימת המשך קצרה';
  const quickTask = quickOpeners[0]?.title ? cleanTaskTitle(quickOpeners[0].title) : 'Quick win של עשר דקות';

  return {
    topTasks,
    quickOpeners,
    doNotDelayTask,
    planBlocks: [
      { time: workStart, title: 'פתיחת יום', description: 'מים, נשימה, בדיקת היום בלי להיכנס לפיזור.', tone: 'start' },
      { time: '09:15', title: 'אימון בוקר', description: input.settings?.morningBriefing?.exerciseLine || 'תרגיל בוקר קצר לפני המסך.', tone: 'exercise' },
      { time: '10:00', title: 'בלוק עומק', description: firstTask, tone: 'deep' },
      { time: '12:30', title: 'לידים / כסף / follow-up', description: input.leadTaskCount > 0 ? 'לעבור על משימת לידים אחת בלבד ולא לפתוח עשר חזיתות.' : secondTask, tone: 'leads' },
      { time: '15:30', title: 'בלוק קל', description: secondTask, tone: 'light' },
      { time: workEnd, title: 'סגירת יום', description: 'לעדכן מה בוצע, מה עובר למחר, ולייצא Daily State.', tone: 'close' },
    ],
  };
}

export function buildMorningBriefingText(input: BuildMorningBriefingInput): string {
  const morning = input.settings?.morningBriefing;
  const nickname = morning?.nickname?.trim() || 'מיקי';
  const visibleTodayCount = input.tasks
    .filter(isVisibleTask)
    .filter((task) => task.bucket === 'today' && task.date === input.todayISO)
    .length;
  const topTasks = pickMorningTasks(input.tasks.filter(isVisibleTask), input.subtasks, input.todayISO, MORNING_TOP_TASK_LIMIT);
  const topTaskIds = new Set(topTasks.map((task) => task.id));
  const backlogTasks = getBacklogTasks(input.tasks, input.subtasks, input.todayISO, MORNING_BACKLOG_LIMIT + topTasks.length)
    .filter((task) => !topTaskIds.has(task.id))
    .slice(0, MORNING_BACKLOG_LIMIT);
  const openBacklogCount = getOpenBacklogCount(input.tasks, input.subtasks);
  const todayReminderLines = getTodayReminderBriefLines(input);
  const holidayReminderLines = getHolidayReminderLines(input.weather);
  const reminderLines = [...holidayReminderLines, ...todayReminderLines];
  const importantNote = getImportantTaskNote(topTasks, visibleTodayCount);
  const reminderConclusion = getReminderConclusion(todayReminderLines.length, holidayReminderLines.length);
  const taskLines = topTasks.length
    ? topTasks.map((task, index) => getTaskLine(task, index))
    : ['אין משימות להיום.'];
  const backlogLines = backlogTasks.length
    ? [
        `יש ${openBacklogCount} פריטי Backlog פתוחים.`,
        ...backlogTasks.map((task, index) => getTaskLine(task, index)),
        ...(openBacklogCount > backlogTasks.length ? [`ועוד ${openBacklogCount - backlogTasks.length} בבקלוג, לא מקריא עכשיו.`] : []),
      ]
    : ['אין משימות Backlog פתוחות להצגה.'];

  const sections = [
    morning?.includeGreeting === false ? '' : getOpeningLines(input, nickname).join('\n'),
    morning?.includeTopTasks === false ? '' : `משימות להיום:\n${taskLines.join('\n')}`,
    importantNote ?? '',
    `משימות בקלוג:\n${backlogLines.join('\n')}`,
    morning?.includeReminders === false
      ? ''
      : `תזכורות להיום:\n${reminderLines.length ? reminderLines.join('\n') : 'אין תזכורות להיום.'}`,
    reminderConclusion ?? '',
    morning?.includeClosing === false ? '' : getClosing(input.todayISO, input.settings),
  ];

  return clampBriefingText(sections
    .filter((section) => section.trim().length > 0)
    .map((section) => section.trim())
    .join('\n'));
}

export function buildMorningBriefingMarkdown(input: BuildMorningBriefingInput): string {
  return `# Morning Briefing — ${input.todayISO}\n\n${buildMorningBriefingText(input)}\n`;
}
