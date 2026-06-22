import { db } from '../../db/db';
import { nowISO } from '../../utils/dates';
import { createId } from '../../utils/ids';
import type { Subtask, Task } from '../tasks/taskTypes';

const TIMERALIGNER_LOGISTICS_TAG = 'timeraligner-logistics-plan';

const timerAlignerSteps = [
  '3PL בסין: לקבל הצעות מחיר מ-3-5 מחסנים',
  '3PL בסין: לוודא שהם עושים קיטינג, QC, מדבקות, B2B ו-B2C',
  '3PL בסין: לוודא שהם יודעים לשלוח מוצר עם סוללה נטענת',
  '3PL בסין: לקבל מחיר לפי 50 / 100 / 300 יחידות',
  'נתוני מוצר מהמפעל: לקבל גודל קרטון מאסטר',
  'נתוני מוצר מהמפעל: לקבל כמה יחידות נכנסות בקרטון',
  'נתוני מוצר מהמפעל: לקבל משקל קרטון מלא',
  'נתוני מוצר מהמפעל: לקבל סוג וקיבולת סוללה',
  'נתוני מוצר מהמפעל: לקבל רשימת מסמכי סוללה ואלקטרוניקה זמינים',
  'קיטינג ואריזה: להחליט איפה עושים קיטינג - מחסן או מפעל',
  'קיטינג ואריזה: לקבל מחיר קיטינג ליחידה',
  'קיטינג ואריזה: להגדיר מה נכנס לכל קופסה',
  'קיטינג ואריזה: להגדיר מי מספק כבל ואריזה',
  'QC: להגדיר בדיקה בסיסית - נדלק, נטען, כפתורים, טיימר, צבע וקופסה',
  'QC: לקבל מחיר QC ליחידה',
  'QC: להחליט אם בודקים 100% או מדגם',
  'QC: להגדיר מה עושים עם יחידות פגומות',
  'SKU וברקודים: לאשר SKU לכל צבע',
  'SKU וברקודים: להחליט אם מדביקים ברקוד על כל קופסה',
  'SKU וברקודים: להעביר למחסן טבלת SKU וכמויות',
  'SKU: TA-SKY כחול שמים - 125 יחידות',
  'SKU: TA-ROYAL כחול רויאל - 125 יחידות',
  'SKU: TA-BLACK שחור - 125 יחידות',
  'SKU: TA-WHITE לבן - 125 יחידות',
  'SKU: TA-YELLOW צהוב - 125 יחידות',
  'SKU: TA-GREEN ירוק - 125 יחידות',
  'SKU: TA-RED אדום - 125 יחידות',
  'SKU: TA-PINK ורוד - 125 יחידות',
  'שילוח B2B: לקבל מחיר 50/100/300 יחידות לסינגפור',
  'שילוח B2B: לקבל מחיר 50/100/300 יחידות למלזיה',
  'שילוח B2B: לקבל מחיר 50/100/300 יחידות לפיליפינים',
  'שילוח B2B: לקבל מחיר 50/100/300 יחידות לאינדונזיה',
  'שילוח B2B: לבדוק האם המסים על הלקוח',
  'שילוח B2B: להגדיר נוסח duties/taxes ללקוחות',
  'שילוח B2B: להבין זמן שילוח לכל מדינה',
  'שילוח B2C: לקבל מחיר שילוח ל-1/2/5 יחידות',
  'שילוח B2C: לבדוק אם המחסן יודע לעבוד ידנית או דרך Shopify',
  'שילוח B2C: לא לפתוח B2C עד שיש מחיר ברור',
  'החזרות: לברר איפה ChinaDivision מקבלים החזרות',
  'החזרות: לקבל מחיר טיפול בהחזרה',
  'החזרות: להגדיר מדיניות B2B',
  'החזרות: להחליט אם מוצר חוזר חוזר למלאי או לפגומים',
  'רווחיות: לחשב עלות אמיתית ליחידה כולל QC, קיטינג ושילוח',
  'רווחיות: לחשב רווח לפי 10/50/100/300 יחידות',
  'רווחיות: להחליט מה כלול במחיר ומה הלקוח משלם בנפרד',
  'רווחיות: להגדיר מינימום הזמנה משתלם',
  'שלב 1: לאסוף מחירים מהמחסנים ונתוני קרטון/סוללה מהמפעל',
  'שלב 2: לבחור מחסן ראשי, מחסן גיבוי, מודל QC ומודל קיטינג',
  'שלב 3: לבנות מחירון B2B לרופאים ומפיצים כולל תנאי שילוח ומסים',
  'שלב 4: להעביר מלאי ל-3PL, לבצע QC וקיטינג, לקבל דוח מלאי ולהתחיל B2B',
];

export async function ensureTimerAlignerLogisticsProcess(): Promise<boolean> {
  const existing = await db.tasks
    .filter((task) => (task.tags ?? []).includes(TIMERALIGNER_LOGISTICS_TAG))
    .first();
  if (existing) return false;

  const timestamp = nowISO();
  const taskId = createId('task');
  const task: Task = {
    id: taskId,
    title: 'TimerAligner - תוכנית לוגיסטית מלאה',
    projectId: 'timeraligner',
    domainId: 'operations',
    bucket: 'backlog',
    date: timestamp.slice(0, 10),
    originalDate: timestamp.slice(0, 10),
    scheduledTimeLabel: 'תהליך ארוך',
    estimatedDurationMinutes: null,
    durationLabel: undefined,
    priority: 'high',
    effort: 'deep',
    isQuickWin: false,
    isRecurring: false,
    recurrenceDefinitionId: null,
    backlogGroup: 'this_week',
    tags: ['process', 'long', 'operations', 'timeraligner', TIMERALIGNER_LOGISTICS_TAG],
    whyNow: 'תהליך לוגיסטי מרכזי: 3PL, נתוני מפעל, קיטינג, QC, SKU, שילוח, החזרות ורווחיות.',
    notes:
      'תוצר סופי: בחירת 3PL ראשי + גיבוי, דף נתונים למחסנים, תהליך קיטינג/QC, SKU מסודר, מחירי שילוח, מדיניות החזרות ומחירון B2B מבוסס מספרים.',
    statusOverride: null,
    movedCount: 0,
    movedToDate: null,
    source: 'manual',
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    cancelledAt: null,
    deletedAt: null,
  };

  const subtasks: Subtask[] = timerAlignerSteps.map((title, index) => ({
    id: createId('subtask'),
    taskId,
    title,
    domainId: 'operations',
    estimatedDurationMinutes: null,
    durationLabel: undefined,
    toolsNeeded: undefined,
    notes: undefined,
    aiConversationUrl: null,
    status: 'not_started',
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    deletedAt: null,
    sortOrder: index,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  await db.transaction('rw', db.tasks, db.subtasks, db.logs, async () => {
    await db.tasks.add(task);
    await db.subtasks.bulkAdd(subtasks);
    await db.logs.add({
      id: createId('log'),
      timestamp,
      type: 'task_created',
      entityType: 'task',
      entityId: taskId,
      message: 'TimerAligner logistics long process created',
      metadata: { source: 'process_template', subtaskCount: subtasks.length },
    });
  });

  return true;
}
