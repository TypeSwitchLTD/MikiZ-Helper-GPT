import type { DailyPlan } from '../domain/dailyPlans/dailyPlanTypes';
import type { RecurringTaskDefinition } from '../domain/recurring/recurringTypes';
import type { AppSettings } from '../domain/settings/settingsTypes';
import type { Subtask, Task } from '../domain/tasks/taskTypes';
import { getTodayISO, getTomorrowISO, nowISO } from '../utils/dates';

type SeedTaskInput = Pick<
  Task,
  | 'id'
  | 'title'
  | 'projectId'
  | 'domainId'
  | 'bucket'
  | 'priority'
  | 'effort'
  | 'isQuickWin'
  | 'isRecurring'
  | 'backlogGroup'
  | 'tags'
  | 'whyNow'
  | 'notes'
  | 'scheduledTimeLabel'
  | 'estimatedDurationMinutes'
  | 'durationLabel'
> & {
  date: string | null;
  subtasks: Array<{
    id: string;
    title: string;
    domainId?: string | null;
    estimatedDurationMinutes?: number | null;
    durationLabel?: string;
    toolsNeeded?: string;
    notes?: string;
    status?: Subtask['status'];
  }>;
};

function createTask(input: SeedTaskInput, timestamp: string): { task: Task; subtasks: Subtask[] } {
  const task: Task = {
    id: input.id,
    title: input.title,
    projectId: input.projectId,
    domainId: input.domainId,
    bucket: input.bucket,
    date: input.date,
    originalDate: input.date,
    scheduledTimeLabel: input.scheduledTimeLabel,
    estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
    durationLabel: input.durationLabel,
    priority: input.priority,
    effort: input.effort,
    isQuickWin: input.isQuickWin,
    isRecurring: input.isRecurring,
    recurrenceDefinitionId: null,
    backlogGroup: input.backlogGroup ?? null,
    tags: input.tags,
    whyNow: input.whyNow,
    notes: input.notes,
    statusOverride: null,
    movedCount: 0,
    movedToDate: null,
    source: 'seed',
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    cancelledAt: null,
  };

  const subtasks = input.subtasks.map((subtask, index) => ({
    id: subtask.id,
    taskId: input.id,
    title: subtask.title,
    domainId: subtask.domainId ?? input.domainId,
    estimatedDurationMinutes: subtask.estimatedDurationMinutes ?? null,
    durationLabel: subtask.durationLabel,
    toolsNeeded: subtask.toolsNeeded,
    notes: subtask.notes,
    status: subtask.status ?? 'not_started',
    startedAt: subtask.status === 'started' || subtask.status === 'done' ? timestamp : null,
    completedAt: subtask.status === 'done' ? timestamp : null,
    cancelledAt: null,
    sortOrder: index,
    createdAt: timestamp,
    updatedAt: timestamp,
  })) satisfies Subtask[];

  return { task, subtasks };
}

export function createSeedData(settings: AppSettings): {
  tasks: Task[];
  subtasks: Subtask[];
  dailyPlans: DailyPlan[];
  recurringDefinitions: RecurringTaskDefinition[];
} {
  const timestamp = nowISO();
  const today = getTodayISO();
  const tomorrow = getTomorrowISO();

  const seedTasks: SeedTaskInput[] = [
    {
      id: 'seed-task-apollo-mapping',
      title: 'מיפוי Apollo לפי קהלים רלוונטיים',
      projectId: 'timeraligner',
      domainId: 'apollo',
      bucket: 'today',
      date: today,
      scheduledTimeLabel: 'בוקר',
      estimatedDurationMinutes: 45,
      durationLabel: '45 דק׳',
      priority: 'high',
      effort: 'deep',
      isQuickWin: false,
      isRecurring: false,
      backlogGroup: null,
      tags: ['apollo', 'sales', 'research'],
      whyNow: 'נדרש כדי לא לבזבז זמן בחיפושי לידים לא מדויקים.',
      subtasks: [
        { id: 'seed-subtask-apollo-1', title: 'להגדיר 3 סגמנטים ראשונים לחיפוש', toolsNeeded: 'Apollo, Sheet' },
        { id: 'seed-subtask-apollo-2', title: 'לרשום קריטריונים שמוציאים לידים לא רלוונטיים' },
      ],
    },
    {
      id: 'seed-task-apollo-people-search',
      title: 'בדיקת Apollo People Search לרופאי שיניים / אורתודונטים',
      projectId: 'timeraligner',
      domainId: 'sales',
      bucket: 'today',
      date: today,
      scheduledTimeLabel: 'אחרי Apollo mapping',
      estimatedDurationMinutes: 30,
      durationLabel: '30 דק׳',
      priority: 'medium',
      effort: 'medium',
      isQuickWin: false,
      isRecurring: false,
      backlogGroup: null,
      tags: ['apollo', 'leads'],
      whyNow: 'בדיקת איכות החיפוש לפני הגדלת נפח עבודה.',
      subtasks: [
        { id: 'seed-subtask-apollo-people-1', title: 'להריץ חיפוש ניסיוני על מדינה אחת' },
        { id: 'seed-subtask-apollo-people-2', title: 'לבדוק 15 תוצאות ידנית' },
      ],
    },
    {
      id: 'seed-task-direct-checkout',
      title: 'עדכון Direct Checkout Link ב־AlignersWorld',
      projectId: 'alignersworld',
      domainId: 'shopify',
      bucket: 'today',
      date: today,
      scheduledTimeLabel: 'קליל לפני צהריים',
      estimatedDurationMinutes: 10,
      durationLabel: '10 דק׳',
      priority: 'medium',
      effort: 'quick',
      isQuickWin: true,
      isRecurring: false,
      backlogGroup: null,
      tags: ['shopify', 'checkout'],
      whyNow: 'משפר מעבר ישיר לרכישה.',
      subtasks: [
        { id: 'seed-subtask-checkout-1', title: 'לאתר את הלינק הנוכחי', status: 'started' },
        { id: 'seed-subtask-checkout-2', title: 'להחליף ללינק התקין ולבדוק פתיחה' },
      ],
    },
    {
      id: 'seed-task-jack-followup',
      title: 'פולואפ לג׳ק לגבי ייצור ואריזה',
      projectId: 'timeraligner',
      domainId: 'production',
      bucket: 'today',
      date: today,
      scheduledTimeLabel: 'היום',
      estimatedDurationMinutes: 15,
      durationLabel: '15 דק׳',
      priority: 'high',
      effort: 'quick',
      isQuickWin: true,
      isRecurring: false,
      backlogGroup: null,
      tags: ['production', 'follow-up'],
      whyNow: 'חוסם התקדמות בייצור.',
      subtasks: [
        { id: 'seed-subtask-jack-1', title: 'לנסח הודעת פולואפ קצרה וברורה' },
        { id: 'seed-subtask-jack-2', title: 'לשלוח ולתעד תשובה כשהיא מגיעה' },
      ],
    },
    {
      id: 'seed-task-instagram-following',
      title: 'Instagram following — איתור חשבונות רלוונטיים',
      projectId: 'timeraligner',
      domainId: 'marketing',
      bucket: 'today',
      date: today,
      scheduledTimeLabel: 'כשאין הרבה פוקוס',
      estimatedDurationMinutes: 10,
      durationLabel: '10 דק׳',
      priority: 'low',
      effort: 'quick',
      isQuickWin: true,
      isRecurring: false,
      backlogGroup: null,
      tags: ['instagram', 'marketing'],
      whyNow: 'משימה קלילה שמתאימה לאנרגיה נמוכה.',
      subtasks: [{ id: 'seed-subtask-instagram-1', title: 'לעקוב אחרי 10 חשבונות רלוונטיים' }],
    },
    {
      id: 'seed-task-website-fixes',
      title: 'Website fixes — בדיקת תיקונים באתר',
      projectId: 'timeraligner',
      domainId: 'website-qa',
      bucket: 'today',
      date: today,
      scheduledTimeLabel: 'אחה״צ',
      estimatedDurationMinutes: 25,
      durationLabel: '25 דק׳',
      priority: 'medium',
      effort: 'medium',
      isQuickWin: false,
      isRecurring: true,
      backlogGroup: null,
      tags: ['website', 'qa'],
      whyNow: 'QA שוטף לאתר לפני תנועה/לידים.',
      subtasks: [
        { id: 'seed-subtask-website-1', title: 'לעבור על דף הבית', status: 'started' },
        { id: 'seed-subtask-website-2', title: 'לעבור על דף doctors' },
      ],
    },
    {
      id: 'seed-task-evening-story',
      title: 'תכנון סטורי ערב קצר',
      projectId: 'timeraligner',
      domainId: 'marketing',
      bucket: 'backlog',
      date: tomorrow,
      scheduledTimeLabel: 'ערב',
      estimatedDurationMinutes: 15,
      durationLabel: '15 דק׳',
      priority: 'low',
      effort: 'quick',
      isQuickWin: true,
      isRecurring: false,
      backlogGroup: 'tomorrow',
      tags: ['social', 'content'],
      subtasks: [{ id: 'seed-subtask-story-1', title: 'לבחור מסר אחד ולכתוב טקסט קצר' }],
    },
    {
      id: 'seed-task-finance-weekly',
      title: 'Finance weekly — מעבר שבועי על תשלומים והוצאות',
      projectId: 'finance',
      domainId: 'finance',
      bucket: 'weekly',
      date: null,
      scheduledTimeLabel: 'ראשון אחה״צ',
      estimatedDurationMinutes: 30,
      durationLabel: '30 דק׳',
      priority: 'medium',
      effort: 'medium',
      isQuickWin: false,
      isRecurring: true,
      backlogGroup: null,
      tags: ['finance', 'weekly'],
      subtasks: [
        { id: 'seed-subtask-finance-1', title: 'לעבור על תשלומים פתוחים' },
        { id: 'seed-subtask-finance-2', title: 'לעדכן רשימת הוצאות' },
      ],
    },
    {
      id: 'seed-task-shopify-tiers',
      title: 'Shopify quantity tiers — בדיקת מדרגות כמות',
      projectId: 'alignersworld',
      domainId: 'shopify',
      bucket: 'backlog',
      date: null,
      scheduledTimeLabel: 'השבוע',
      estimatedDurationMinutes: 35,
      durationLabel: '35 דק׳',
      priority: 'medium',
      effort: 'medium',
      isQuickWin: false,
      isRecurring: false,
      backlogGroup: 'this_week',
      tags: ['shopify', 'pricing'],
      subtasks: [{ id: 'seed-subtask-tiers-1', title: 'להחליט על 3 מדרגות מחיר ראשוניות' }],
    },
    {
      id: 'seed-task-payment-providers',
      title: 'בדיקת Payment Providers רלוונטיים',
      projectId: 'alignersworld',
      domainId: 'shopify',
      bucket: 'backlog',
      date: null,
      scheduledTimeLabel: 'בהמשך',
      estimatedDurationMinutes: 45,
      durationLabel: '45 דק׳',
      priority: 'medium',
      effort: 'deep',
      isQuickWin: false,
      isRecurring: false,
      backlogGroup: 'later',
      tags: ['payments', 'shopify'],
      subtasks: [{ id: 'seed-subtask-payments-1', title: 'להכין השוואה קצרה בין אפשרויות תשלום' }],
    },
    {
      id: 'seed-task-typeswitch-patent',
      title: 'TypeSwitch patent follow-up',
      projectId: 'typeswitch',
      domainId: 'operations',
      bucket: 'backlog',
      date: null,
      scheduledTimeLabel: 'ממתין',
      estimatedDurationMinutes: 20,
      durationLabel: '20 דק׳',
      priority: 'medium',
      effort: 'medium',
      isQuickWin: false,
      isRecurring: false,
      backlogGroup: 'waiting',
      tags: ['patent', 'follow-up'],
      subtasks: [{ id: 'seed-subtask-typeswitch-1', title: 'לבדוק מול מי צריך לעשות פולואפ הבא' }],
    },
    {
      id: 'seed-task-mission-control-supabase-future',
      title: 'Mission Control — Supabase updates tab future task',
      projectId: 'mission-control',
      domainId: 'development',
      bucket: 'backlog',
      date: null,
      scheduledTimeLabel: 'Phase 3+',
      estimatedDurationMinutes: 60,
      durationLabel: '60 דק׳',
      priority: 'low',
      effort: 'deep',
      isQuickWin: false,
      isRecurring: false,
      backlogGroup: 'later',
      tags: ['supabase', 'future'],
      notes: 'לא לממש ב־Phase 0/1. נשמר כתזכורת ארכיטקטונית בלבד.',
      subtasks: [{ id: 'seed-subtask-supabase-1', title: 'להגדיר בעתיד אילו טבלאות Supabase חשובות' }],
    },
  ];

  const tasks: Task[] = [];
  const subtasks: Subtask[] = [];

  for (const seedTask of seedTasks) {
    const created = createTask(seedTask, timestamp);
    tasks.push(created.task);
    subtasks.push(...created.subtasks);
  }

  const dailyPlans: DailyPlan[] = [
    {
      id: `daily-plan-${today}`,
      date: today,
      focusNote: 'להתחיל במשימות מכירה/לידים, ואז לעבור לקוויק וינס כשיש ירידת אנרגיה.',
      plannedTaskIds: tasks
        .filter((task) => task.bucket === 'today' && task.date === today)
        .map((task, order) => ({ taskId: task.id, order })),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  const recurringDefinitions: RecurringTaskDefinition[] = [
    {
      id: 'recurring-website-qa',
      sourceTaskId: 'seed-task-website-fixes',
      title: 'Website QA',
      projectId: 'timeraligner',
      domainId: 'website-qa',
      frequency: 'three_times_per_week',
      preferredTimingNote: 'בוקר, 3 פעמים בשבוע',
      defaultScheduledTimeLabel: 'בוקר',
      defaultSubtasks: [
        { title: 'בדיקת דף הבית', domainId: 'website-qa', estimatedDurationMinutes: 10, sortOrder: 0 },
        { title: 'בדיקת דף doctors / checkout links', domainId: 'website-qa', estimatedDurationMinutes: 15, sortOrder: 1 },
      ],
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastGeneratedAt: null,
    },
    {
      id: 'recurring-finance-weekly',
      sourceTaskId: 'seed-task-finance-weekly',
      title: 'Finance Weekly',
      projectId: 'finance',
      domainId: 'finance',
      frequency: 'once_per_week',
      preferredTimingNote: 'ראשון אחר הצהריים',
      defaultScheduledTimeLabel: 'ראשון אחה״צ',
      defaultSubtasks: [
        { title: 'מעבר על תשלומים פתוחים', domainId: 'finance', estimatedDurationMinutes: 15, sortOrder: 0 },
        { title: 'עדכון הוצאות והתחייבויות', domainId: 'finance', estimatedDurationMinutes: 15, sortOrder: 1 },
      ],
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastGeneratedAt: null,
    },
    {
      id: 'recurring-social-daily',
      title: 'Social Daily',
      projectId: 'timeraligner',
      domainId: 'marketing',
      frequency: 'every_day',
      preferredTimingNote: 'משימה קצרה יומית, עדיף כשיש פחות פוקוס',
      defaultScheduledTimeLabel: 'ערב',
      defaultSubtasks: [{ title: 'פעולת תוכן/מעורבות אחת', domainId: 'marketing', estimatedDurationMinutes: 10, sortOrder: 0 }],
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastGeneratedAt: null,
    },
    {
      id: 'recurring-typeswitch-followup',
      title: 'TypeSwitch Follow-up',
      projectId: 'typeswitch',
      domainId: 'operations',
      frequency: 'once_per_week',
      preferredTimingNote: 'בפועל רצוי 2 פעמים בשבוע; MVP שומר זאת כהערה תחת פעם בשבוע, בלי מנוע חזרתיות מורכב.',
      defaultScheduledTimeLabel: 'השבוע',
      defaultSubtasks: [{ title: 'בדיקת סטטוס מול איש הקשר הרלוונטי', domainId: 'operations', estimatedDurationMinutes: 15, sortOrder: 0 }],
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastGeneratedAt: null,
    },
  ];

  const knownProjectIds = new Set(settings.projects.map((project) => project.id));
  const knownDomainIds = new Set(settings.domains.map((domain) => domain.id));

  for (const task of tasks) {
    if (!knownProjectIds.has(task.projectId)) {
      throw new Error(`Seed task references unknown project: ${task.projectId}`);
    }
    if (!knownDomainIds.has(task.domainId)) {
      throw new Error(`Seed task references unknown domain: ${task.domainId}`);
    }
  }

  return { tasks, subtasks, dailyPlans, recurringDefinitions };
}
