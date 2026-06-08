export type AppTabId = "tasks" | "focus" | "processes" | "sales" | "social" | "workouts" | "personal" | "reminders" | "settings";

export interface AppTab {
  id: AppTabId;
  label: string;
  mobileLabel?: string;
  description: string;
}

export const appTabs: AppTab[] = [
  {
    id: "tasks",
    label: "משימות",
    description: "כל מה שרלוונטי, היום, קלילים, באקלוג וחוזרות במקום אחד",
  },
  {
    id: "focus",
    label: "פוקוס",
    description: "עד 6 משימות נבחרות לעבודה נקייה עם טיימר.",
  },
  {
    id: "processes",
    label: "תהליכים",
    mobileLabel: "תהליך",
    description: "משימות על ארוכות עם צעדים פתוחים, בוצעים והמשך עבודה.",
  },
  {
    id: "sales",
    label: "לקוחות והזמנות",
    mobileLabel: "הזמנות",
    description: "לקוחות אחרי פגישה, הזמנות, ביקוש, ייצור והקצאות ידניות",
  },
  {
    id: "social",
    label: "לידים וסושיאל",
    mobileLabel: "סושיאל",
    description: "Instantly, Instagram, LinkedIn ומשימות תוכן עתידיות",
  },
  {
    id: "workouts",
    label: "אימונים",
    description: "אזור עתידי לאימוני בוקר, הפסקות ותנועה",
  },
  {
    id: "personal",
    label: "אישי",
    description: "הרגלים יומיים, חוזרות ותזכורות — כל מה שאישי במקום אחד",
  },
  {
    id: "reminders",
    label: "תזכורות",
    description: "כל התזכורות שלך — ממתינות, שנשלחו וסגורות",
  },
  {
    id: "settings",
    label: "הגדרות",
    description: "הגדרות מקומיות, קול, ייבוא ודוחות",
  },
];
