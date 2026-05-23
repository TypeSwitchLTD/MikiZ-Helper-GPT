import type { AppSettings } from '../settings/settingsTypes';
import type { Subtask, Task } from '../tasks/taskTypes';
import { getTaskProgress } from '../tasks/taskProgress';
import { getSubtasksForTask } from '../tasks/taskSelectors';
import type { WeatherBrief } from './weather';

export interface BuildMorningBriefingInput {
  todayISO: string;
  settings: AppSettings | null;
  tasks: Task[];
  subtasks: Subtask[];
  leadTaskCount: number;
  weather?: WeatherBrief | null;
}

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

export function pickMorningTasks(tasks: Task[], subtasks: Subtask[], todayISO: string, limit = 3): BriefingTaskLine[] {
  const priorityWeight: Record<Task['priority'], number> = { high: 3, medium: 2, low: 1 };
  const effortWeight: Record<Task['effort'], number> = { quick: 2, medium: 1, deep: 0 };

  return tasks
    .filter((task) => task.statusOverride !== 'cancelled')
    .filter((task) => task.bucket === 'today' && task.date === todayISO)
    .map((task) => {
      const taskSubtasks = getSubtasksForTask(task.id, subtasks);
      const progress = getTaskProgress(task, taskSubtasks);
      return { task, progress };
    })
    .filter(({ progress }) => progress.status !== 'done' && progress.status !== 'cancelled')
    .sort((a, b) => {
      const morningTagA = a.task.tags.includes('morning-important') || a.task.tags.includes('important') ? 30 : 0;
      const morningTagB = b.task.tags.includes('morning-important') || b.task.tags.includes('important') ? 30 : 0;
      const scoreA = morningTagA + priorityWeight[a.task.priority] * 12 + effortWeight[a.task.effort] + (a.progress.status === 'in_progress' ? 6 : 0) + Math.min(a.task.movedCount, 4) * 2;
      const scoreB = morningTagB + priorityWeight[b.task.priority] * 12 + effortWeight[b.task.effort] + (b.progress.status === 'in_progress' ? 6 : 0) + Math.min(b.task.movedCount, 4) * 2;
      return scoreB - scoreA || a.task.title.localeCompare(b.task.title);
    })
    .slice(0, limit)
    .map(({ task, progress }) => ({
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
    }));
}

function cleanTaskTitle(title: string): string {
  return title
    .replace(/\s*[-—]\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTaskLine(task: BriefingTaskLine, index: number): string {
  const title = cleanTaskTitle(task.title);
  if (task.status === 'in_progress') {
    return `${index + 1}. ${title}. כבר התחלת, אז רק להמשיך משם.`;
  }
  if (task.movedCount >= 2) {
    return `${index + 1}. ${title}. זו משימה שלא דוחים שוב.`;
  }
  if (task.priority === 'high') {
    return `${index + 1}. ${title}. זו המשימה החשובה.`;
  }
  return `${index + 1}. ${title}. לפתוח ולהתקדם צעד אחד.`;
}

function getWeatherLine(weather: WeatherBrief | null | undefined, settings: AppSettings | null): string {
  const place = weather?.cityLabel || settings?.location.label || settings?.location.city || 'אצלך';
  const ritual = weather?.shabbatLabel && weather?.shabbatTime ? ` ${weather.shabbatLabel} היום ב${weather.shabbatTime}.` : '';
  if (weather?.morningTempC != null || weather?.noonTempC != null) {
    const morning = weather.morningTempC != null ? `${weather.morningTempC} מעלות בבוקר` : 'אין נתון בוקר';
    const noon = weather.noonTempC != null ? `${weather.noonTempC} בצהריים` : 'אין נתון צהריים';
    return `ב${place} צפויות היום ${morning} ו${noon}. ${weather.description}${ritual}`.trim();
  }
  return `מזג האוויר ב${place} עדיין לא נטען. לפני שאתה יוצא, תן בדיקה קצרה.${ritual}`;
}

function getMotivationLine(todayISO: string, settings: AppSettings | null): string {
  if (settings?.morningBriefing?.motivationLine?.trim()) {
    return `משפט חיזוק להיום: ${settings.morningBriefing.motivationLine.trim()}`;
  }
  const lines = [
    'משפט חיזוק להיום: לא צריך לנצח את כל היום בבת אחת, רק את הצעד הראשון.',
    'משפט חיזוק להיום: תנועה קטנה עכשיו שווה יותר מתכנון מושלם אחר כך.',
    'משפט חיזוק להיום: היום מתחיל כשאתה מתחיל, לא כשהכול מסודר.',
    'משפט חיזוק להיום: פוקוס אחד טוב יכול לשנות את כל היום.',
  ];
  return lines[seededIndex(todayISO, lines.length)];
}

function getReminderLines(input: BuildMorningBriefingInput): string[] {
  const topTasks = pickMorningTasks(input.tasks, input.subtasks, input.todayISO);
  const reminders = [
    'לקום ולעשות תרגיל בוקר קצר. שתי דקות, בלי משא ומתן.',
    input.weather?.shabbatLabel && input.weather.shabbatTime ? `${input.weather.shabbatLabel} היום ב${input.weather.shabbatTime}.` : 'לשתות מים לפני שאתה נכנס לעבודה.',
  ];
  if (topTasks.length > 0) {
    reminders.push(`לפתוח קודם את ${cleanTaskTitle(topTasks[0].title)}.`);
  } else if (input.leadTaskCount > 0) {
    reminders.push('לעבור על מצב הלידים ולבחור פעולה אחת קטנה.');
  } else {
    reminders.push('לבחור משימה אחת מהבאקלוג ולהכניס אותה להיום.');
  }
  return reminders.slice(0, 3);
}

function getClosing(todayISO: string, settings: AppSettings | null): string {
  if (settings?.morningBriefing?.closingLine?.trim()) return settings.morningBriefing.closingLine.trim();
  const closings = [
    'יאללה תן בראש אלוף.',
    'יאללה, צעד ראשון ועולים על היום.',
    'קדימה מיקי, יום טוב מתחיל בפעולה אחת.',
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
  const narratorVerb = input.settings?.voice?.narratorGender === 'female' ? 'מקריאה' : 'מקריא';
  const topTasks = pickMorningTasks(input.tasks, input.subtasks, input.todayISO);
  const quickOpeners = pickMorningTasks(input.tasks.filter((task) => task.effort === 'quick' || task.isQuickWin), input.subtasks, input.todayISO, 2);
  const dayText = formatHebrewDay(input.todayISO);
  const hebrewDate = formatHebrewCalendarDateLetters(input.todayISO);
  const weatherLine = getWeatherLine(input.weather, input.settings);
  const motivationLine = getMotivationLine(input.todayISO, input.settings);
  const reminderLines = getReminderLines(input);
  const taskLines = topTasks.length
    ? topTasks.map((task, index) => getTaskLine(task, index))
    : ['אין לך שלוש משימות מוגדרות להיום. זה סימן טוב לבחור אחת ברורה ולהתחיל קטן.'];

  const leadLine = input.leadTaskCount > 0
    ? `מצב לידים: יש ${input.leadTaskCount} משימות לידים במערכת. לא לפתוח הכול עכשיו, רק לזכור שזה קיים.`
    : 'מצב לידים שקט כרגע.';

  const summaryLine = [
    `היום ${dayText}${hebrewDate ? `, ${hebrewDate}` : ''}.`,
    topTasks.length > 0 ? `הפוקוס הוא ${cleanTaskTitle(topTasks[0].title)}.` : 'הפוקוס הראשון הוא לבחור משימה אחת ברורה.',
    quickOpeners.length > 0 ? `יש גם Quick Win: ${cleanTaskTitle(quickOpeners[0].title)}.` : '',
  ].filter(Boolean).join(' ');

  const sectionMap: Record<string, { enabled: boolean; text: string }> = {
    summary: { enabled: morning?.includeSummary !== false, text: `סיכום מצב היום: ${summaryLine}` },
    greeting: { enabled: morning?.includeGreeting !== false, text: `בוקר טוב ${nickname}.\n\nבזמן שאני ${narratorVerb} לך בריף על היום, תן לעצמך רגע להתעורר.` },
    date: { enabled: morning?.includeDate !== false, text: `היום ${dayText}${hebrewDate ? `, ${hebrewDate}` : ''}.` },
    weather: { enabled: morning?.includeWeather !== false, text: weatherLine },
    motivation: { enabled: morning?.includeMotivation !== false, text: motivationLine },
    exercise: { enabled: morning?.includeExerciseReminder !== false, text: morning?.exerciseLine || 'קום, תעשה תרגיל בוקר קצר, ותכניס אנרגיה לגוף לפני המסך.' },
    reminders: { enabled: morning?.includeReminders !== false, text: `תזכורות להיום: ${reminderLines.join(' ')}` },
    topTasks: { enabled: morning?.includeTopTasks !== false, text: `משימות בפוקוס: ${taskLines.join(' ')}` },
    leads: { enabled: morning?.includeLeads !== false, text: leadLine },
    closing: { enabled: morning?.includeClosing !== false, text: getClosing(input.todayISO, input.settings) },
  };

  const defaultOrder = ['summary', 'topTasks', 'reminders', 'weather', 'motivation', 'exercise', 'leads', 'greeting', 'closing'];
  const savedOrder = Array.isArray(morning?.sectionOrder) ? morning.sectionOrder : [];
  const order = [...savedOrder.filter((id) => id in sectionMap), ...defaultOrder.filter((id) => !savedOrder.includes(id))];

  return order
    .map((id) => sectionMap[id])
    .filter((section): section is { enabled: boolean; text: string } => Boolean(section))
    .filter((section) => section.enabled && section.text.trim().length > 0)
    .map((section) => section.text.trim())
    .join('\n\n');
}

export function buildMorningBriefingMarkdown(input: BuildMorningBriefingInput): string {
  return `# Morning Briefing — ${input.todayISO}\n\n${buildMorningBriefingText(input)}\n`;
}
