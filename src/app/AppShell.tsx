import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLocalBiometricCredentialId, isBiometricSupported, verifyBiometric } from "../features/auth/useBiometricAuth";
import { CreateMissionItemButton } from "../features/create/CreateMissionItemButton";
import { useReminderChecker } from "../features/reminders/useReminderChecker";
import { ReminderToast } from "../features/reminders/ReminderToast";
import { RemindersTab } from "../features/reminders/RemindersTab";
import { QuickReminderModal } from "../features/reminders/QuickReminderModal";
import { SettingsTab } from "../features/settings/SettingsTab";
import { TasksHubTab } from "../features/tasks/TasksHubTab";
import { SocialPreviewTab } from "../features/social/SocialPreviewTab";
import { WorkoutsPreviewTab } from "../features/workouts/WorkoutsPreviewTab";
import { PersonalTab } from "../features/personal/PersonalTab";
import { MorningBriefingModal } from "../features/morning/MorningBriefingModal";
import { CommandCenterModal } from "../features/morning/CommandCenterModal";
import { ReadyCheckModal } from "../features/morning/ReadyCheckModal";
import { FocusTimerModal } from "../features/focus/FocusTimerModal";
import { useMorningBriefing } from "../features/morning/useMorningBriefing";
import { getTaskProgress } from "../domain/tasks/taskProgress";
import { getSubtasksForTask } from "../domain/tasks/taskSelectors";
import type { AppSettings, ColorThemeId } from "../domain/settings/settingsTypes";
import type { Subtask, Task } from "../domain/tasks/taskTypes";
import { formatHebrewDate, localISOSeconds } from "../utils/dates";
import { normalizeSearch, isSameDatePrefix, addDaysToISO } from "../utils/strings";
import { appTabs, type AppTabId } from "./routes";
import { useMissionControlData } from "./useMissionControlData";

const APP_VERSION = "0.8.6";

// ─── Auth lockout constants ────────────────────────────────────────────────────
const LOCKOUT_KEY = "mission-control-auth-lockout";
const AUTH_OK_KEY = "mission-control-auth-ok";
const AUTH_PIN_VERSION_KEY = "mission-control-auth-pin-version";
const AUTH_UNTIL_KEY = "mission-control-auth-ok-until";
const AUTH_DURATION_MS = 4 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

interface LockoutState { attempts: number; lockedUntil: number | null; }
function readLockout(): LockoutState {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    if (raw) return JSON.parse(raw) as LockoutState;
  } catch { /* ignore */ }
  return { attempts: 0, lockedUntil: null };
}
function writeLockout(s: LockoutState) {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(s));
}

function getAuthPinVersion(settings: AppSettings | null | undefined): string {
  if (!settings?.pinEnabled) return "disabled";
  return settings.pinUpdatedAt || settings.pinHash || "enabled-without-pin-hash";
}

function setAuthSession(settings: AppSettings | null | undefined): void {
  const pinVersion = getAuthPinVersion(settings);
  const authUntil = String(Date.now() + AUTH_DURATION_MS);
  sessionStorage.setItem(AUTH_OK_KEY, "true");
  sessionStorage.setItem(AUTH_PIN_VERSION_KEY, pinVersion);
  localStorage.setItem(AUTH_OK_KEY, "true");
  localStorage.setItem(AUTH_PIN_VERSION_KEY, pinVersion);
  localStorage.setItem(AUTH_UNTIL_KEY, authUntil);
}

function clearAuthSession(): void {
  sessionStorage.removeItem(AUTH_OK_KEY);
  sessionStorage.removeItem(AUTH_PIN_VERSION_KEY);
  localStorage.removeItem(AUTH_OK_KEY);
  localStorage.removeItem(AUTH_PIN_VERSION_KEY);
  localStorage.removeItem(AUTH_UNTIL_KEY);
}

function hasValidAuthSession(settings: AppSettings | null | undefined): boolean {
  const pinVersion = getAuthPinVersion(settings);
  const sessionOk =
    sessionStorage.getItem(AUTH_OK_KEY) === "true" &&
    sessionStorage.getItem(AUTH_PIN_VERSION_KEY) === pinVersion;
  if (sessionOk) return true;

  const localOk =
    localStorage.getItem(AUTH_OK_KEY) === "true" &&
    localStorage.getItem(AUTH_PIN_VERSION_KEY) === pinVersion;
  const authUntil = Number(localStorage.getItem(AUTH_UNTIL_KEY) || "0");
  return localOk && Number.isFinite(authUntil) && authUntil > Date.now();
}

// ─── Color theme config ───────────────────────────────────────────────────────

const THEME_CONFIG: Record<ColorThemeId, {
  mainBg: string;
  sidebarBg: string;
  sidebarBorder: string;
  sidebarText: string;
  navActive: string;
  navIdle: string;
  navIconActive: string;
  navIconIdle: string;
  headerBg: string;
  headerBorder: string;
  logoGradient: string;
}> = {
  'slate-sky': {
    mainBg: 'radial-gradient(circle at 10% 0%, #e0f2fe 0, #f8fbff 26%, #ffffff 62%, #f7fbff 100%)',
    sidebarBg: 'bg-white/90',
    sidebarBorder: 'border-sky-100',
    sidebarText: 'text-slate-500',
    navActive: 'bg-slate-950 text-white shadow-soft',
    navIdle: 'bg-white text-slate-700 ring-1 ring-sky-100 hover:bg-sky-50 hover:text-sky-900',
    navIconActive: 'bg-white/15',
    navIconIdle: 'bg-sky-50',
    headerBg: 'bg-white/95',
    headerBorder: 'border-sky-100',
    logoGradient: 'from-sky-400 to-cyan-400 shadow-sky-200',
  },
  'indigo-clean': {
    mainBg: 'linear-gradient(155deg, #F0EEFF 0%, #EDE9FE 30%, #F9F8FF 65%, #FFFFFF 100%)',
    sidebarBg: 'bg-indigo-50/95',
    sidebarBorder: 'border-indigo-100',
    sidebarText: 'text-indigo-500',
    navActive: 'bg-indigo-600 text-white shadow-soft',
    navIdle: 'bg-white/80 text-indigo-800 ring-1 ring-indigo-100 hover:bg-indigo-50 hover:text-indigo-900',
    navIconActive: 'bg-white/20',
    navIconIdle: 'bg-indigo-100/60',
    headerBg: 'bg-indigo-50/97',
    headerBorder: 'border-indigo-100',
    logoGradient: 'from-indigo-500 to-violet-500 shadow-indigo-200',
  },
  'deep-warm': {
    mainBg: 'linear-gradient(155deg, #FDF9F3 0%, #FFF5E6 40%, #FFFBF5 75%, #FEFCF8 100%)',
    sidebarBg: 'bg-amber-50/95',
    sidebarBorder: 'border-amber-100',
    sidebarText: 'text-amber-700',
    navActive: 'bg-violet-700 text-white shadow-soft',
    navIdle: 'bg-white/70 text-amber-900 ring-1 ring-amber-100 hover:bg-amber-100 hover:text-amber-950',
    navIconActive: 'bg-white/20',
    navIconIdle: 'bg-amber-100/70',
    headerBg: 'bg-amber-50/97',
    headerBorder: 'border-amber-100',
    logoGradient: 'from-violet-500 to-fuchsia-500 shadow-violet-200',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function hashPin(pin: string): Promise<string> {
  const payload = new TextEncoder().encode(`mission-control-pin:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}


function createTomorrowHandoffMarkdown(input: {
  todayISO: string;
  tasks: Task[];
  subtasks: Subtask[];
  leadTaskCount: number;
}): string {
  const tomorrowISO = addDaysToISO(input.todayISO, 1);
  const groups = {
    completed: [] as string[],
    inProgress: [] as string[],
    tomorrow: [] as string[],
    weekly: [] as string[],
    backlog: [] as string[],
  };

  input.tasks.forEach((task) => {
    const taskSubtasks = getSubtasksForTask(task.id, input.subtasks);
    const progress = getTaskProgress(task, taskSubtasks);
    const percent = Number.isFinite(progress.percent) ? progress.percent : 0;
    const line = `- ${task.title} (${percent}%)`;

    if (progress.status === "cancelled" || task.statusOverride === "cancelled") return;
    if (progress.status === "done") {
      if (
        isSameDatePrefix(task.completedAt, input.todayISO) ||
        isSameDatePrefix(task.updatedAt, input.todayISO)
      )
        groups.completed.push(line);
      return;
    }
    if (progress.status === "in_progress") { groups.inProgress.push(line); return; }
    if (task.bucket === "weekly" || task.bucket === "recurring") { groups.weekly.push(line); return; }
    if (task.bucket === "backlog") {
      if (task.backlogGroup === "tomorrow" || isSameDatePrefix(task.date, tomorrowISO))
        groups.tomorrow.push(line);
      else groups.backlog.push(line);
      return;
    }
    if (task.bucket === "today") groups.tomorrow.push(line);
  });

  const section = (title: string, lines: string[]) =>
    `${title}:\n${lines.length ? lines.join("\n") : "- אין"}\n`;
  return [
    `Daily Report - ${input.todayISO}`,
    "",
    "Generated by Mission Control for tomorrow import.",
    `Tomorrow target: ${tomorrowISO}`,
    "",
    section("Completed", groups.completed),
    section("In Progress", groups.inProgress),
    section("Not Started / Tomorrow", groups.tomorrow),
    section("Weekly", groups.weekly),
    section("Backlog", groups.backlog),
    "Notes:",
    `- Lead-related tasks in system: ${input.leadTaskCount}`,
    "- Import this file tomorrow from Settings → דוח / ייבוא.",
  ].join("\n");
}

// ─── Small shared UI components ───────────────────────────────────────────────

function MetricPill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number | string;
  tone?: "sky" | "emerald" | "amber" | "violet" | "slate" | "rose";
}) {
  const toneClass: Record<typeof tone, string> = {
    sky: "bg-sky-50 text-sky-950 ring-sky-200",
    emerald: "bg-emerald-50 text-emerald-950 ring-emerald-200",
    amber: "bg-amber-50 text-amber-950 ring-amber-200",
    violet: "bg-violet-50 text-violet-950 ring-violet-200",
    slate: "bg-white text-slate-950 ring-slate-200",
    rose: "bg-rose-50 text-rose-950 ring-rose-200",
  };
  return (
    <div className={`rounded-3xl px-3 py-4 text-center ring-1 ${toneClass[tone]}`}>
      <p className="text-[11px] font-black opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black leading-none">{value}</p>
    </div>
  );
}

function MiniReminder({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/85 px-3 py-2 text-xs font-black ring-1 ring-sky-100">
      <span className="text-slate-800">{label}</span>
      <span className="text-slate-500">{value}</span>
    </div>
  );
}

// ─── SVG icon components ──────────────────────────────────────────────────────

const SVG_BASE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function NavIcon({ tabId, className }: { tabId: string; className?: string }) {
  const cls = className ?? "h-5 w-5";
  switch (tabId) {
    case "tasks":
      return (
        <svg {...SVG_BASE} className={cls}>
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "social":
      return (
        <svg {...SVG_BASE} className={cls}>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      );
    case "workouts":
      return (
        <svg {...SVG_BASE} className={cls}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case "reminders":
      return (
        <svg {...SVG_BASE} className={cls}>
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      );
    case "personal":
      return (
        <svg {...SVG_BASE} className={cls}>
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...SVG_BASE} className={cls}>
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      );
    default:
      return null;
  }
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTabId>("tasks");
  const [isRailCollapsed, setIsRailCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("mission-control-rail-collapsed") === "true";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [systemCheckOpen, setSystemCheckOpen] = useState(false);
  const [readyCheckOpen, setReadyCheckOpen] = useState(false);
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);
  const [quickReminderOpen, setQuickReminderOpen] = useState(false);
  const [focusTimerOpen, setFocusTimerOpen] = useState(false);
  const [focusEndToast, setFocusEndToast] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [globalQuietMode, setGlobalQuietMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("mission-control-quiet-mode") === "true";
  });
  const [focusSeconds, setFocusSeconds] = useState(20 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const [authPin, setAuthPin] = useState("");
  const [authError, setAuthError] = useState("");
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [localBiometricCredentialId] = useState(() => getLocalBiometricCredentialId());
  const [pinShake, setPinShake] = useState(false);
  const [authLockout, setAuthLockout] = useState<LockoutState>(readLockout);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [isPinAuthenticated, setIsPinAuthenticated] = useState(false);
  const [dailyStateImportStatus, setDailyStateImportStatus] = useState("");
  const dailyStateInputRef = useRef<HTMLInputElement | null>(null);
  const authInputRef = useRef<HTMLInputElement | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [scrollCompact, setScrollCompact] = useState(false);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [hasAutoOpenedReadiness, setHasAutoOpenedReadiness] = useState(false);
  const mainSectionRef = useRef<HTMLElement>(null);

  const data = useMissionControlData();
  const activeTabMeta = appTabs.find((tab) => tab.id === activeTab);

  // ─── Color theme ─────────────────────────────────────────────────────────────
  const themeId: ColorThemeId = data.settings?.colorTheme ?? "slate-sky";
  const theme = THEME_CONFIG[themeId];

  // ─── Lead task count (used in morning briefing + sidebar) ─────────────────────
  const leadTaskCount = useMemo(
    () =>
      data.tasks.filter((task) => {
        const text = normalizeSearch(
          `${task.title} ${(task.tags ?? []).join(" ")} ${task.domainId ?? ""} ${task.projectId ?? ""}`,
        );
        return /lead|leads|apollo|instantly|clinic|clinics|invisalign|לידים|קליניקות/.test(text);
      }).length,
    [data.tasks],
  );

  // ─── Morning briefing hook ────────────────────────────────────────────────────
  const morning = useMorningBriefing({
    settings: data.settings,
    tasks: data.tasks,
    subtasks: data.subtasks,
    todayISO: data.todayISO,
    leadTaskCount,
    appVersion: APP_VERSION,
    saveSettings: data.saveSettings,
    updateExistingTaskDetails: data.updateExistingTaskDetails,
    saveDailyPlan: data.saveDailyPlan,
  });

  // ─── Reminder checker ─────────────────────────────────────────────────────────
  // Single source of timing: useReminderChecker fires every 60 s, plays the chime,
  // then calls onDue so the toast appears at exactly the same moment as the sound.
  // We also recompute whenever data.reminders changes (user added / snoozed / dismissed).
  const [dueReminders, setDueReminders] = useState<typeof data.reminders>([]);
  const computeDueReminders = useRef(() => {});
  useEffect(() => {
    const compute = () => {
      const nowISO = localISOSeconds();
      setDueReminders(data.reminders.filter((r) => r.status === "pending" && r.remindAt <= nowISO));
    };
    computeDueReminders.current = compute;
    compute(); // run once on mount / data change — shows past-due reminders immediately
    // No independent interval here — useReminderChecker drives the timing via onDue
  }, [data.reminders]);
  useReminderChecker(data.reminders, () => computeDueReminders.current());

  // ─── SW → App: handle notification click ─────────────────────────────────────
  const dataTasksRef = useRef(data.tasks);
  dataTasksRef.current = data.tasks;

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (!event.data || event.data.type !== "REMINDER_CLICK") return;
      const { taskId } = event.data as { taskId?: string | null };
      if (!taskId) return;
      const task = dataTasksRef.current.find((t) => t.id === taskId);
      if (!task) return;
      setActiveTab("tasks");
      setFocusedTaskId(task.id);
      setSearchQuery("");
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  // ─── Auth ─────────────────────────────────────────────────────────────────────
  // IMPORTANT: wait for data to finish loading before evaluating PIN.
  // On first render data.settings is null → pinEnabled is undefined → !undefined = true
  // which would grant access immediately, bypassing auth on every new device.
  useEffect(() => {
    if (data.isLoading) return; // don't decide until real settings are loaded
    if (!data.settings?.pinEnabled) {
      setAuthSession(data.settings);
      setIsPinAuthenticated(true);
    } else {
      // PIN is enabled - only allow through if this session matches the current PIN version.
      if (hasValidAuthSession(data.settings)) {
        setAuthSession(data.settings);
        setIsPinAuthenticated(true);
      } else {
        clearAuthSession();
        setIsPinAuthenticated(false);
      }
    }
  }, [data.settings?.pinEnabled, data.settings?.pinHash, data.settings?.pinUpdatedAt, data.isLoading]);

  useEffect(() => {
    if (!data.settings?.pinEnabled || isPinAuthenticated) return;
    if (authLockout.lockedUntil && Date.now() < authLockout.lockedUntil) return;
    const timerId = window.setTimeout(() => {
      authInputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(timerId);
  }, [data.settings?.pinEnabled, isPinAuthenticated, authLockout.lockedUntil]);

  // ─── Lockout countdown timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (!authLockout.lockedUntil) { setLockCountdown(0); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((authLockout.lockedUntil! - Date.now()) / 1000));
      setLockCountdown(remaining);
      if (remaining === 0) {
        const cleared: LockoutState = { attempts: 0, lockedUntil: null };
        setAuthLockout(cleared);
        writeLockout(cleared);
        setAuthError("");
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [authLockout.lockedUntil]);

  const submitAuthPin = async (nextPin: string) => {
    // Block if locked
    if (authLockout.lockedUntil && Date.now() < authLockout.lockedUntil) {
      setAuthPin("");
      return;
    }
    if (!/^\d{6}$/.test(nextPin)) {
      setAuthError("הכנס קוד בן 6 ספרות כדי להמשיך.");
      return;
    }
    setAuthError("");
    if (!data.settings?.pinHash) {
      setAuthError("PIN פעיל אבל לא הוגדר קוד. כבה/הגדר אותו בהגדרות המקומיות.");
      return;
    }
    const nextHash = await hashPin(nextPin);
    if (nextHash === data.settings.pinHash) {
      // Success — clear lockout
      const cleared: LockoutState = { attempts: 0, lockedUntil: null };
      setAuthLockout(cleared);
      writeLockout(cleared);
      setAuthSession(data.settings);
      setIsPinAuthenticated(true);
      setAuthPin("");
      return;
    }
    // Wrong PIN
    const newAttempts = authLockout.attempts + 1;
    const isNowLocked = newAttempts >= MAX_ATTEMPTS;
    const next: LockoutState = isNowLocked
      ? { attempts: 0, lockedUntil: Date.now() + LOCKOUT_MS }
      : { attempts: newAttempts, lockedUntil: null };
    setAuthLockout(next);
    writeLockout(next);
    // Shake animation
    setPinShake(true);
    window.setTimeout(() => setPinShake(false), 500);
    setAuthError(
      isNowLocked
        ? "5 ניסיונות נכשלו — החשבון נחסם ל-15 דקות."
        : `קוד שגוי — נותרו ${MAX_ATTEMPTS - newAttempts} ניסיונות`
    );
    setAuthPin("");
  };

  const attemptBiometric = useCallback(async () => {
    const credId = localBiometricCredentialId;
    if (!credId) return;
    setIsBiometricLoading(true);
    setAuthError("");
    const ok = await verifyBiometric(credId);
    setIsBiometricLoading(false);
    if (ok) {
      setAuthSession(data.settings);
      setIsPinAuthenticated(true);
    } else {
      setAuthError("זיהוי ביומטרי נכשל — הכנס PIN.");
    }
  }, [localBiometricCredentialId]);

  const handleAuthPinChange = (value: string) => {
    const nextPin = value.replace(/\D/g, "").slice(0, 6);
    setAuthPin(nextPin);
    setAuthError("");
    if (nextPin.length === 6) void submitAuthPin(nextPin);
  };

  // ─── Cloud sync helper (prevents double-fire) ─────────────────────────────────
  const syncCloud = async (fn: () => Promise<unknown>) => {
    if (isSyncing) return;
    setIsSyncing(true);
    try { await fn(); } finally { setIsSyncing(false); }
  };

  // ─── Quiet mode persist ───────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("mission-control-quiet-mode", globalQuietMode ? "true" : "false");
  }, [globalQuietMode]);

  // ─── Morning readiness auto-open ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !data.todayISO) return;
    if (data.isLoading) return;
    if (data.settings?.pinEnabled && !isPinAuthenticated) return;
    if (hasAutoOpenedReadiness) return;

    const timerId = window.setTimeout(() => {
      setHasAutoOpenedReadiness(true);
      setReadyCheckOpen(true);
    }, 250);

    return () => window.clearTimeout(timerId);
  }, [data.todayISO, data.isLoading, data.settings?.pinEnabled, isPinAuthenticated, hasAutoOpenedReadiness]);

  // ─── Command center: re-init blocks when opened ───────────────────────────────
  useEffect(() => {
    morning.setCommandCenterReady(commandCenterOpen);
  }, [commandCenterOpen, morning]);

  // ─── Compact header on scroll (hysteresis: compact >80px, expand <40px) ─────────
  useEffect(() => {
    const section = mainSectionRef.current;
    const check = () => {
      const top = section ? section.scrollTop : window.scrollY;
      setScrollCompact((prev) => {
        if (!prev && top > 80) return true;
        if (prev && top < 40) return false;
        return prev;
      });
    };
    section?.addEventListener("scroll", check, { passive: true });
    window.addEventListener("scroll", check, { passive: true });
    return () => {
      section?.removeEventListener("scroll", check);
      window.removeEventListener("scroll", check);
    };
  }, []);

  // ─── Focus timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!focusRunning) return;
    const id = window.setInterval(() => {
      setFocusSeconds((current) => {
        if (current <= 1) {
          setFocusRunning(false);
          setFocusEndToast("הפסקה. הטיימר הסתיים, קח רגע לנשום.");
          try {
            const AC =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (AC) {
              const ctx = new AC();
              const scheduleNotes = () => {
                [0, 0.85, 1.7].forEach((repeatOffset) => {
                  [659.25, 830.61, 987.77].forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = "sine";
                    osc.frequency.value = freq;
                    const t = ctx.currentTime + repeatOffset + i * 0.16;
                    gain.gain.setValueAtTime(0, t);
                    gain.gain.linearRampToValueAtTime(0.12, t + 0.025);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(t);
                    osc.stop(t + 0.5);
                  });
                });
                window.setTimeout(() => void ctx.close(), 3400);
              };
              ctx.state === "suspended"
                ? void ctx.resume().then(scheduleNotes)
                : scheduleNotes();
            }
          } catch {
            /* best-effort */
          }
          if ("Notification" in window && Notification.permission === "granted") {
            void navigator.serviceWorker?.ready
              .then((reg) =>
                reg.showNotification("הפסקה", {
                  body: "הטיימר הסתיים. קח הפסקה קצרה.",
                  tag: "focus-timer",
                  silent: false,
                }),
              )
              .catch(() => {
                try {
                  new Notification("הפסקה", {
                    body: "הטיימר הסתיים. קח הפסקה קצרה.",
                    tag: "focus-timer",
                    silent: false,
                  });
                } catch {
                  /* best-effort */
                }
              });
          }
          return 5 * 60;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [focusRunning]);

  const focusTimerLabel = `${Math.floor(focusSeconds / 60).toString().padStart(2, "0")}:${(focusSeconds % 60).toString().padStart(2, "0")}`;

  // ─── Derived counts ───────────────────────────────────────────────────────────
  const pendingReminders = useMemo(
    () =>
      data.reminders
        .filter((r) => r.status === "pending")
        .sort((a, b) => (Date.parse(a.remindAt) || 0) - (Date.parse(b.remindAt) || 0)),
    [data.reminders],
  );

  const activeTaskCount = data.tasks.filter(
    (t) => t.statusOverride !== "cancelled" && !t.completedAt,
  ).length;

  const openSubtaskCount = data.subtasks.filter(
    (s) => s.status !== "done" && s.status !== "cancelled",
  ).length;

  // ─── Search ───────────────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    const terms = normalizeSearch(searchQuery).split(" ").filter((t) => t.length > 1);
    if (terms.length === 0) return [];
    return data.tasks
      .map((task) => {
        const taskSubtasks = getSubtasksForTask(task.id, data.subtasks);
        const projectName =
          data.settings?.projects.find((p) => p.id === task.projectId)?.name ?? task.projectId;
        const domainName =
          data.settings?.domains.find((d) => d.id === task.domainId)?.name ?? task.domainId;
        const haystack = normalizeSearch(
          [
            task.title, task.whyNow, task.notes, (task.tags ?? []).join(" "),
            projectName, domainName, task.scheduledTimeLabel,
            ...taskSubtasks.flatMap((s) => [s.title, s.notes, s.toolsNeeded]),
          ]
            .filter(Boolean)
            .join(" "),
        );
        const matchedTerms = terms.filter((t) => haystack.includes(t));
        const matchedSubtasks = taskSubtasks.filter((s) => {
          const st = normalizeSearch([s.title, s.notes, s.toolsNeeded].filter(Boolean).join(" "));
          return terms.some((t) => st.includes(t));
        });
        const titleBonus = terms.some((t) => normalizeSearch(task.title).includes(t)) ? 2 : 0;
        return {
          task, matchedSubtasks, projectName, domainName,
          score: matchedTerms.length + matchedSubtasks.length + titleBonus,
          tab: "tasks" as AppTabId,
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.task.title.localeCompare(b.task.title))
      .slice(0, 8);
  }, [data.subtasks, data.tasks, data.settings, data.todayISO, searchQuery]);

  const settingsSearchResults = useMemo(() => {
    const terms = normalizeSearch(searchQuery).split(" ").filter((t) => t.length > 1);
    if (terms.length === 0) return [];
    const items = [
      { id: "morning", title: "פתיחת בוקר וקול", description: "ElevenLabs, נאום בוקר, כינוי, קול, מהירות דיבור" },
      { id: "import", title: "דוח / ייבוא", description: "ייבוא דוח יומי וטעינת משימות" },
      { id: "storage", title: "מצב אחסון", description: "IndexedDB, גיבוי, Daily State" },
      { id: "social", title: "חיבורים לרשתות חברתיות", description: "LinkedIn, Instagram, token placeholders" },
      { id: "location", title: "מיקום / מזג אוויר / שבת", description: "עיר, timezone, שקיעה, כניסת שבת, צאת שבת" },
      { id: "projects", title: "פרויקטים ודומיינים", description: "פרויקטים, תחומים, תגיות בסיס" },
    ];
    return items
      .map((item) => ({
        ...item,
        score: terms.filter((t) =>
          normalizeSearch(`${item.title} ${item.description}`).includes(t),
        ).length,
      }))
      .filter((item) => item.score > 0)
      .slice(0, 5);
  }, [searchQuery]);

  // ─── Actions ──────────────────────────────────────────────────────────────────
  const jumpToTask = (task: Task) => {
    const taskSubtasks = getSubtasksForTask(task.id, data.subtasks);
    setActiveTab("tasks");
    setFocusedTaskId(task.id);
    setSearchQuery("");
  };

  const exportDailyState = () => {
    const payload = {
      schemaVersion: "mission-control-daily-state/0.1",
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      date: data.todayISO,
      summary: {
        totalTasks: data.progress.totalTasks,
        todayCount: data.progress.todayCount,
        inProgressCount: data.progress.inProgressCount,
        backlogCount: data.progress.backlogCount,
        doneCount: data.progress.doneCount,
        recurringCount: data.progress.recurringCount,
        leadTaskCount,
      },
      tasks: data.tasks,
      subtasks: data.subtasks,
      dailyPlans: data.dailyPlans,
      recurringDefinitions: data.recurringDefinitions,
      reports: data.reports,
      logs: data.logs,
      reminders: data.reminders,
      settings: data.settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mission-control-daily-state-${data.todayISO}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openDailyStateImportPicker = () => {
    setDailyStateImportStatus("");
    dailyStateInputRef.current?.click();
  };

  const importDailyStateFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw) as unknown;
      const preview = payload as { appVersion?: string; date?: string; tasks?: unknown[]; subtasks?: unknown[] };
      const taskCount = Array.isArray(preview.tasks) ? preview.tasks.length : 0;
      const subtaskCount = Array.isArray(preview.subtasks) ? preview.subtasks.length : 0;
      const confirmed = window.confirm(
        `לטעון Daily State?\n\nמקור: ${preview.appVersion ?? "לא ידוע"}\nתאריך: ${preview.date ?? "לא ידוע"}\nמשימות: ${taskCount}\nתתי־משימות: ${subtaskCount}\n\nהייבוא לא מוחק דאטה קיים. הוא מעדכן/מוסיף לפי ID ושומר Snapshot לפני הייבוא.`,
      );
      if (!confirmed) return;
      const result = await data.importDailyState(payload);
      setDailyStateImportStatus(
        `Daily State נטען: ${result.tasks} משימות, ${result.subtasks} תתי־משימות.`,
      );
    } catch (error) {
      setDailyStateImportStatus(
        error instanceof Error ? error.message : "ייבוא Daily State נכשל.",
      );
    }
  };

  const exportAITaskFormat = () => {
    const projects = (data.settings?.projects ?? []).map((p) => p.id || p.name).filter(Boolean);
    const domains = (data.settings?.domains ?? []).map((d) => d.id || d.name).filter(Boolean);
    const exampleTask = data.tasks[0];
    const template = [
      '# פורמט ייבוא משימות — MikiZ Helper',
      '',
      '## הוראות לAI:',
      'קרא את רשימת המשימות הבאה ומלא עבור כל אחת את כל השדות לפי הפורמט JSON למטה.',
      'החזר מערך JSON תקין בלבד — ללא טקסט נוסף.',
      '',
      '## שדות:',
      '- title: שם המשימה (כפי שניתן)',
      '- durationMinutes: זמן משוער בדקות — בחר מתוך: 5, 10, 15, 20, 25, 30, 45, 60, 90, 120',
      '- priority: "high" (קריטי/דחוף) | "medium" (רגיל) | "low" (נמוך/שאפשר לדחות)',
      '- isQuickWin: true אם < 15 דק׳ וקל לביצוע ללא מאמץ מחשבתי גדול, אחרת false',
      '- bucket: "today" (להיום) | "weekly" (השבוע) | "backlog" (עתיד) | "recurring" (חוזר)',
      '- scheduledTimeLabel: "בוקר" | "צהריים" | "אחה״צ" | "ערב" | null',
      `- projectId: אחד מ: ${projects.length ? projects.join(', ') : '(הגדר פרויקטים בהגדרות)'} — או null`,
      `- domainId: אחד מ: ${domains.length ? domains.join(', ') : '(הגדר דומיינים בהגדרות)'} — או null`,
      '- tags: מערך תגיות חופשיות רלוונטיות (לדוג׳: ["lead", "apollo", "shopify", "dev"])',
      '- notes: הערה קצרה אם יש — או null',
      '',
      '## פורמט JSON (מערך):',
      JSON.stringify([
        {
          title: exampleTask?.title ?? 'שם המשימה',
          durationMinutes: exampleTask?.estimatedDurationMinutes ?? 30,
          priority: exampleTask?.priority ?? 'medium',
          isQuickWin: exampleTask?.isQuickWin ?? false,
          bucket: exampleTask?.bucket ?? 'backlog',
          scheduledTimeLabel: exampleTask?.scheduledTimeLabel ?? null,
          projectId: exampleTask?.projectId ?? null,
          domainId: exampleTask?.domainId ?? null,
          tags: exampleTask?.tags ?? [],
          notes: null,
        },
      ], null, 2),
      '',
      '---',
      '## רשימת המשימות שלי (החלף את הטקסט הזה):',
      '1. ...',
      '2. ...',
      '3. ...',
    ].join('\n');

    navigator.clipboard.writeText(template).then(
      () => setDailyStateImportStatus('פורמט AI הועתק ללוח — הדבק בצ׳אט עם AI יחד עם רשימת המשימות.'),
      () => {
        const blob = new Blob([template], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'ai-task-format.md'; a.click();
        URL.revokeObjectURL(url);
      },
    );
  };

  const exportTomorrowHandoffReport = () => {
    const markdown = createTomorrowHandoffMarkdown({
      todayISO: data.todayISO,
      tasks: data.tasks,
      subtasks: data.subtasks,
      leadTaskCount,
    });
    const tomorrowISO = addDaysToISO(data.todayISO, 1);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mission-control-handoff-for-${tomorrowISO}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const toggleRail = () => {
    setIsRailCollapsed((current) => {
      const next = !current;
      if (typeof window !== "undefined")
        window.localStorage.setItem("mission-control-rail-collapsed", String(next));
      return next;
    });
  };

  const commonTaskActions = {
    isSaving: data.isSaving,
    focusedTaskId,
    onChangeSubtaskStatus: data.changeSubtaskStatus,
    onMoveToTomorrow: data.moveTaskTomorrow,
    onChangeTaskDate: data.changeTaskDate,
    onCancelTask: data.cancelExistingTask,
    onUpdateTaskText: data.updateExistingTaskText,
    onUpdateSubtaskText: data.updateExistingSubtaskText,
    onUpdateTaskDetails: data.updateExistingTaskDetails,
    onAddSubtaskToTask: data.addSubtaskToExistingTask,
    onReorderTaskFocus: data.reorderTaskFocus,
    onAddReminder: data.addReminder,
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "tasks":
        return (
          <TasksHubTab
            tasks={data.tasks}
            subtasks={data.subtasks}
            reminders={data.reminders}
            settings={data.settings}
            todayISO={data.todayISO}
            quietMode={globalQuietMode}
            onToggleQuietMode={() => setGlobalQuietMode((c) => !c)}
            onOpenFocusTimer={() => setFocusTimerOpen(true)}
            {...commonTaskActions}
          />
        );
      case "social":
        return (
          <SocialPreviewTab
            settings={data.settings}
            todayISO={data.todayISO}
            tasks={data.tasks}
            subtasks={data.subtasks}
            onJumpToTask={(task) => {
              setActiveTab("tasks");
              setFocusedTaskId(task.id);
              setSearchQuery("");
            }}
            onCompleteTask={(taskId) => void data.completeExistingTask(taskId)}
            onSaveSettings={data.saveSettings}
          />
        );
      case "workouts":
        return <WorkoutsPreviewTab />;
      case "personal":
        return (
          <PersonalTab
            habits={data.habits}
            habitLogs={data.habitLogs}
            onAddHabit={data.addHabit}
            onEditHabit={data.editHabit}
            onDeleteHabit={data.removeHabit}
            onNudgeHabit={data.nudgeHabitCount}
            recurringDefinitions={data.recurringDefinitions}
            tasks={data.tasks}
            onAddRecurringToToday={data.addRecurringToToday}
            onClearRecurringDefinitions={data.clearRecurringDefinitions}
            onImportRecurringDefinitions={data.importRecurringDefinitions}
            reminders={data.reminders}
            settings={data.settings}
            todayISO={data.todayISO}
            isSaving={data.isSaving}
          />
        );
      case "reminders":
        return (
          <RemindersTab
            reminders={data.reminders}
            tasks={data.tasks}
            onMarkDone={(id) => void data.markReminderAsSent(id)}
            onSnooze={(id, minutes) => void data.snoozeExistingReminder(id, minutes)}
            onCancel={(id) => void data.dismissReminder(id)}
            onJumpToTask={(task) => {
              setActiveTab("tasks");
              setFocusedTaskId(task.id);
              setSearchQuery("");
            }}
          />
        );
      case "settings":
        return (
          <SettingsTab
            settings={data.settings}
            isSaving={data.isSaving}
            onSaveSettings={data.saveSettings}
            onPushCloud={data.pushLocalDataToCloud}
            onPullCloud={data.pullCloudDataToLocal}
            cloudSyncStatus={data.cloudSyncStatus}
            reports={data.reports}
            tasks={data.tasks}
            todayISO={data.todayISO}
            onImportReportTasks={data.importReportTasks}
            onDeleteLastImport={data.deleteLastImport}
            onClearAllTasks={data.clearAllTasks}
            morningPreview={{
              text: morning.morningBriefingText,
              isSpeaking: morning.isSpeaking,
              isGeneratingVoice: morning.isGeneratingVoice,
              isMorningLoading: morning.isMorningLoading,
              playText: morning.playText,
              stop: morning.stopMorningBriefing,
            }}
          />
        );
      default:
        return null;
    }
  };

  // ─── PIN screen ───────────────────────────────────────────────────────────────
  if (data.settings?.pinEnabled && !isPinAuthenticated) {
    const isLocked = Boolean(authLockout.lockedUntil && Date.now() < authLockout.lockedUntil);
    const lockMins = Math.ceil(lockCountdown / 60);
    const lockSecs = lockCountdown % 60;

    return (
      <main
        dir="rtl"
        className="grid min-h-screen place-items-center bg-[linear-gradient(160deg,#EFF6FF_0%,#DBEAFE_50%,#E0F2FE_100%)] px-6 text-slate-950"
      >
        <section className="w-full max-w-sm rounded-[2rem] bg-white p-8 text-center shadow-soft ring-1 ring-sky-100">
          <div className="text-5xl">☀️</div>
          <h1 className="mt-3 text-3xl font-black">MikiZ Helper</h1>

          {/* ── Locked state ── */}
          {isLocked ? (
            <div className="mt-6 rounded-2xl bg-rose-50 px-5 py-4 ring-1 ring-rose-200">
              <p className="text-2xl font-black text-rose-700">🔒</p>
              <p className="mt-1 text-sm font-black text-rose-800">החשבון נחסם לאחר 5 ניסיונות כושלים</p>
              <p className="mt-2 text-2xl font-black text-rose-700 tabular-nums">
                {String(lockMins).padStart(2, "0")}:{String(lockSecs).padStart(2, "0")}
              </p>
              <p className="mt-1 text-xs font-bold text-rose-500">הספירה לאחור לביטול הנעילה</p>
            </div>
          ) : (
            <>
              {/* ── Biometric button ── */}
              {localBiometricCredentialId && isBiometricSupported() && (
                <button
                  type="button"
                  onClick={() => void attemptBiometric()}
                  disabled={isBiometricLoading}
                  className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 px-4 py-3.5 text-base font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {isBiometricLoading ? (
                    <span className="animate-pulse">מאמת...</span>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2C9.52 2 7.25 3.02 5.6 4.7" /><path d="M12 2c2.48 0 4.75 1.02 6.4 2.7" />
                        <path d="M2.5 8.5A9.96 9.96 0 0 0 2 12c0 5.52 4.48 10 10 10s10-4.48 10-10c0-1.27-.24-2.49-.67-3.61" />
                        <path d="M12 8a4 4 0 0 1 4 4c0 1.1-.45 2.1-1.17 2.83" />
                        <path d="M12 8a4 4 0 0 0-4 4c0 2.21 1.79 4 4 4" />
                        <path d="M12 12v.01" />
                      </svg>
                      כניסה עם טביעת אצבע / Face ID
                    </>
                  )}
                </button>
              )}

              <p className="mt-5 text-sm font-bold text-slate-500">
                {localBiometricCredentialId ? 'או הכנס קוד 6 ספרות' : 'הכנס קוד 6 ספרות'}
              </p>

              {/* ── PIN dots ── */}
              <div className={`mt-3 flex justify-center gap-3 ${pinShake ? "pin-shake" : ""}`} dir="ltr">
                {Array.from({ length: 6 }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-4 w-4 rounded-full ring-2 transition-all duration-150 ${
                      index < authPin.length
                        ? authError ? "bg-rose-500 ring-rose-500 scale-110" : "bg-sky-600 ring-sky-600 scale-110"
                        : "bg-white ring-slate-300"
                    }`}
                  />
                ))}
              </div>

              <input
                ref={authInputRef}
                autoFocus
                type="password"
                autoComplete="one-time-code"
                enterKeyHint="done"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={authPin}
                onChange={(e) => handleAuthPinChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitAuthPin(authPin);
                }}
                className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-2xl font-black tracking-[0.45em] outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                aria-label="קוד כניסה"
              />

              {/* ── Error / attempts feedback ── */}
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <button
                  type="button"
                  disabled={authPin.length !== 6}
                  onClick={() => void submitAuthPin(authPin)}
                  className="min-h-12 rounded-2xl bg-slate-950 px-4 text-base font-black text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
                >
                  כניסה
                </button>
                <button
                  type="button"
                  disabled={!authPin}
                  onClick={() => { setAuthPin(""); setAuthError(""); }}
                  className="min-h-12 rounded-2xl bg-white px-4 text-sm font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-[0.99] disabled:opacity-40"
                >
                  נקה
                </button>
              </div>

              {authError ? (
                <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 ring-1 ring-rose-100">
                  {authError}
                </p>
              ) : authLockout.attempts > 0 ? (
                <p className="mt-4 text-xs font-bold text-amber-600">
                  נותרו {MAX_ATTEMPTS - authLockout.attempts} ניסיונות לפני נעילה
                </p>
              ) : null}

              <p className="mt-4 text-xs font-bold text-slate-400">אפשר להכניס 6 ספרות או ללחוץ כניסה ידנית.</p>
            </>
          )}
        </section>
      </main>
    );
  }

  // ─── Main layout ──────────────────────────────────────────────────────────────
  return (
    <main dir="rtl" className="min-h-screen text-slate-900" style={{ background: theme.mainBg }}>
      <div
        className={`grid min-h-screen transition-[grid-template-columns] duration-200 ${
          isRailCollapsed
            ? "xl:grid-cols-[76px_minmax(0,1fr)]"
            : "xl:grid-cols-[292px_minmax(0,1fr)]"
        }`}
      >
        {/* Toggle rail button */}
        <button
          type="button"
          className={`fixed top-5 z-[60] hidden h-11 w-11 rounded-full bg-slate-950 text-lg font-black text-white shadow-soft transition hover:-translate-y-0.5 xl:grid xl:place-items-center ${
            isRailCollapsed ? "right-[54px]" : "right-[270px]"
          }`}
          onClick={toggleRail}
          aria-label={isRailCollapsed ? "פתח סרגל צד" : "קפל סרגל צד"}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isRailCollapsed ? (
              <>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </>
            ) : (
              <>
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 5 5 12 12 19" />
              </>
            )}
          </svg>
        </button>

        {/* Sidebar */}
        <aside
          className={`mission-scroll sticky top-0 z-40 hidden h-screen overflow-y-auto border-l p-3 shadow-soft backdrop-blur-xl xl:flex xl:flex-col xl:gap-3 ${theme.sidebarBg} ${theme.sidebarBorder}`}
        >
          <input
            ref={dailyStateInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={importDailyStateFile}
          />

          {/* Logo */}
          <div
            className={`flex items-center gap-3 ${
              isRailCollapsed ? "justify-center pt-12" : "justify-start pr-1 pt-1"
            }`}
          >
            <div
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-xl font-black text-white shadow-lg ${theme.logoGradient}`}
            >
              MZ
            </div>
            {!isRailCollapsed ? (
              <div className="min-w-0">
                <h1 className="text-xl font-black tracking-tight text-slate-950">MikiZ Helper</h1>
                <p className="mt-0.5 text-xs font-black text-slate-500">
                  Mission Control · Local First
                </p>
              </div>
            ) : null}
          </div>

          {/* Nav */}
          <nav className="grid gap-2" aria-label="MikiZ Helper tabs">
            {appTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-right text-sm font-black transition ${
                  activeTab === tab.id ? theme.navActive : theme.navIdle
                }`}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                    activeTab === tab.id ? theme.navIconActive : theme.navIconIdle
                  }`}
                >
                  <NavIcon tabId={tab.id} className="h-[18px] w-[18px]" />
                </span>
                {!isRailCollapsed ? <span>{tab.label}</span> : null}
              </button>
            ))}
          </nav>

          {!isRailCollapsed ? (
            <>
              {/* Today metrics */}
              <div className="grid grid-cols-2 gap-2">
                <MetricPill label="היום" value={data.progress.todayCount} tone="sky" />
                <MetricPill label="בתהליך" value={data.progress.inProgressCount} tone="violet" />
                <MetricPill label="בוצעו" value={data.progress.doneCount} tone="emerald" />
                <MetricPill label="Backlog" value={data.progress.backlogCount} tone="amber" />
              </div>

              {/* Weather / reminders / shabbat / holidays */}
              <section className="rounded-3xl bg-white/80 p-3 ring-1 ring-sky-100">
                <div className="space-y-2">
                  <MiniReminder label="מזג אוויר" value={morning.morningWeather?.currentTempC != null ? `${morning.morningWeather.currentTempC}°` : "—"} />
                  {morning.morningWeather?.shabbatTime ? (
                    <MiniReminder label={morning.morningWeather.shabbatLabel ?? "שקיעה"} value={morning.morningWeather.shabbatTime} />
                  ) : null}
                  {(morning.morningWeather?.upcomingHolidays ?? []).map((h) => (
                    <div key={h.date} className="rounded-2xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
                      <p className="text-[11px] font-black text-amber-800">{h.name}</p>
                      <p className="text-[10px] font-bold text-amber-600">
                        {h.daysUntil === 0 ? "היום" : h.daysUntil === 1 ? "מחר" : `עוד ${h.daysUntil} ימים`}
                        {h.candlesTime ? ` · כניסה ${h.candlesTime}` : ""}
                        {h.havdalahTime ? ` · יציאה ${h.havdalahTime}` : ""}
                      </p>
                    </div>
                  ))}
                  <button type="button" onClick={() => setActiveTab("reminders")} className="flex w-full items-center justify-between gap-2 rounded-2xl bg-white/85 px-3 py-2 text-right text-xs font-black ring-1 ring-sky-100 transition hover:bg-sky-50">
                    <span className="text-slate-800">תזכורות</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${pendingReminders.length > 0 ? "bg-amber-100 text-amber-800" : "text-slate-400"}`}>{pendingReminders.length} פעילות</span>
                  </button>
                </div>
              </section>

              {/* Cloud sync */}
              <div className="rounded-3xl bg-white/80 px-3 py-2.5 ring-1 ring-emerald-100">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-xs font-black text-emerald-800">Cloud Sync</span>
                  <button
                    type="button"
                    disabled={isSyncing}
                    className="rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    onClick={() => void syncCloud(data.pushLocalDataToCloud)}
                  >
                    {isSyncing ? "..." : "סנכרן"}
                  </button>
                  <button
                    type="button"
                    disabled={isSyncing}
                    className="rounded-xl bg-white px-2.5 py-1.5 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-50 disabled:opacity-50"
                    onClick={() => void syncCloud(data.pullCloudDataToLocal)}
                  >
                    {isSyncing ? "..." : "טען"}
                  </button>
                </div>
                {data.cloudSyncStatus ? (
                  <p className="mt-1.5 truncate text-[10px] font-bold text-emerald-700">
                    {data.cloudSyncStatus}
                  </p>
                ) : null}
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReadyCheckOpen(true)}
                  className="rounded-2xl bg-white/80 px-3 py-3 text-center text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-sky-50 hover:text-sky-800"
                >
                  ☀ בוקר?
                </button>
                <button
                  type="button"
                  onClick={() => setFocusTimerOpen(true)}
                  className="rounded-2xl bg-white/80 px-3 py-3 text-center text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-orange-50 hover:text-orange-800"
                >
                  ⏱ פוקוס
                </button>
              </div>

              {/* Version */}
              <div
                className={`mt-auto flex items-center justify-between px-2 text-xs font-black ${theme.sidebarText}`}
              >
                <span>local · {APP_VERSION}</span>
                <button
                  type="button"
                  onClick={() => setActiveTab("settings")}
                  className="opacity-60 transition hover:opacity-100"
                  title="הגדרות"
                >
                  ⚙
                </button>
              </div>
            </>
          ) : null}
        </aside>

        {/* Main content */}
        <section ref={mainSectionRef} className="mission-scroll min-w-0 px-2 pb-4 pt-0 sm:px-5 lg:px-8 xl:h-screen xl:overflow-y-auto">
          <header
            className={`sticky top-0 z-30 -mx-2 mb-2 border-b px-2 backdrop-blur-xl transition-[padding] duration-200 sm:-mx-5 sm:mb-4 sm:px-5 lg:-mx-8 lg:px-8 ${scrollCompact ? "py-1" : "py-1.5 sm:py-2"} ${theme.headerBg} ${theme.headerBorder}`}
          >
            {/* ── Desktop header expanded (CSS-only toggle, no remount) ──── */}
            <div className={`mx-auto max-w-[1220px] gap-3 ${scrollCompact ? "hidden" : "hidden lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"}`}>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-400">MikiZ Helper / Mission Control</p>
                <h1 className="mt-0.5 text-3xl font-black tracking-tight text-slate-950 xl:text-4xl">
                  {activeTab === "tasks" ? "היום שלך, בלי רעש." : activeTabMeta?.label}
                </h1>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {formatHebrewDate(data.todayISO)} · {data.settings?.location.label ?? "מיקום לא הוגדר"} · {activeTabMeta?.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <button
                  type="button"
                  className={`grid h-14 w-14 place-items-center rounded-[1.25rem] text-lg font-black text-white shadow-lg transition hover:-translate-y-0.5 ${morning.isGeneratingVoice || morning.isSpeaking || morning.isMorningLoading ? "bg-rose-600 shadow-rose-100" : "bg-gradient-to-br from-emerald-400 to-cyan-400 shadow-emerald-100"}`}
                  title="הפעל נאום בוקר"
                  onClick={() => void morning.speakMorningBriefing()}
                >
                  {morning.isGeneratingVoice || morning.isMorningLoading ? `${morning.morningPlayProgress}%` : morning.isSpeaking ? "■" : "▶"}
                </button>
                <button type="button" className="grid h-12 w-12 place-items-center rounded-[1.15rem] bg-orange-50 text-lg font-black text-orange-700 ring-1 ring-orange-100 transition hover:-translate-y-0.5" title="טיימר פוקוס" onClick={() => setFocusTimerOpen(true)}>⏱</button>
                <button type="button" className="grid h-12 w-12 place-items-center rounded-[1.15rem] bg-slate-50 text-lg font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5" title="מצב שקט" onClick={() => setGlobalQuietMode((c) => !c)}>◐</button>
                <input
                  className="min-h-12 w-72 xl:w-80 rounded-3xl border-2 border-sky-100 bg-white/90 px-4 text-base font-bold shadow-inner focus:border-sky-300 focus:ring-sky-100"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חיפוש משימות, תתי־משימות, תגיות..."
                />
                <span className="rounded-full bg-white px-3 py-2 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100">Cloud · {APP_VERSION}</span>
              </div>
            </div>

            {/* ── Desktop header compact (CSS-only toggle, no remount) ─────── */}
            <div className={`mx-auto max-w-[1220px] gap-3 ${scrollCompact ? "hidden lg:flex lg:items-center lg:justify-between" : "hidden"}`}>
              <h2 className="truncate text-base font-black tracking-tight text-slate-950">
                {activeTab === "tasks" ? "היום שלך" : activeTabMeta?.label}
              </h2>
              <div className="flex items-center gap-2">
                {desktopSearchOpen && (
                  <input
                    autoFocus
                    className="h-9 w-[240px] rounded-3xl border-2 border-sky-100 bg-white/90 pr-4 text-sm font-bold shadow-inner focus:border-sky-300 focus:outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => { if (!searchQuery) setDesktopSearchOpen(false); }}
                    placeholder="חיפוש..."
                    dir="rtl"
                  />
                )}
                <button
                  type="button"
                  onClick={() => void morning.speakMorningBriefing()}
                  className={`grid h-9 w-9 place-items-center rounded-2xl text-sm font-black text-white shadow-sm transition active:scale-95 ${morning.isGeneratingVoice || morning.isSpeaking || morning.isMorningLoading ? "bg-rose-600" : "bg-gradient-to-br from-emerald-400 to-cyan-400"}`}
                  title="נאום בוקר"
                >
                  {morning.isGeneratingVoice || morning.isMorningLoading ? `${morning.morningPlayProgress}%` : morning.isSpeaking ? "■" : "▶"}
                </button>
                <button
                  type="button"
                  onClick={() => setDesktopSearchOpen((c) => !c)}
                  className={`grid h-9 w-9 place-items-center rounded-2xl text-sm font-black transition active:scale-95 ${desktopSearchOpen ? "bg-sky-600 text-white" : "bg-white/90 text-slate-600 ring-1 ring-slate-200"}`}
                  title="חיפוש"
                >
                  🔍
                </button>
                <button
                  type="button"
                  onClick={() => setFocusTimerOpen(true)}
                  className="grid h-9 w-9 place-items-center rounded-2xl bg-orange-50 text-sm font-black text-orange-700 ring-1 ring-orange-100 transition active:scale-95"
                  title="טיימר פוקוס"
                >
                  ⏱
                </button>
              </div>
            </div>

            {/* ── Mobile header (hidden on lg+) ───────────────────────────── */}
            <div className="mx-auto max-w-[1220px] lg:hidden">
              <div className="flex items-center gap-2">
                {/* Title */}
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-lg font-black tracking-tight text-slate-950">
                    {activeTab === "tasks" ? "היום שלך" : activeTabMeta?.label}
                  </h1>
                  <p className="truncate text-[10px] font-bold text-slate-500">
                    {formatHebrewDate(data.todayISO)} · {data.settings?.location.label ?? ""}
                  </p>
                </div>
                {/* Morning briefing play */}
                <button
                  type="button"
                  className={`flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-2xl px-3 text-xs font-black text-white shadow-sm transition active:scale-95 ${morning.isGeneratingVoice || morning.isSpeaking || morning.isMorningLoading ? "bg-rose-500" : "bg-gradient-to-br from-emerald-400 to-cyan-400"}`}
                  title="נאום בוקר"
                  onClick={() => void morning.speakMorningBriefing()}
                >
                  {morning.isGeneratingVoice || morning.isMorningLoading ? `${morning.morningPlayProgress}%` : morning.isSpeaking ? "■" : "▶"}
                  <span>נאום</span>
                </button>
                {/* Search toggle */}
                <button
                  type="button"
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-sm font-black transition active:scale-95 ${mobileSearchOpen ? "bg-sky-600 text-white" : "bg-white/90 text-slate-600 ring-1 ring-slate-200"}`}
                  title="חיפוש"
                  onClick={() => setMobileSearchOpen((c) => !c)}
                >
                  🔍
                </button>
                {/* Panel (sidebar) */}
                <button
                  type="button"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white/90 text-sm font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-95"
                  title="מטריקות וסנכרון"
                  onClick={() => setMobilePanelOpen(true)}
                >
                  ◫
                </button>
              </div>

              {/* Mobile search row */}
              {mobileSearchOpen ? (
                <div className="mt-2">
                  <input
                    autoFocus
                    className="w-full rounded-2xl border-2 border-sky-200 bg-white/90 px-4 py-2.5 text-base font-bold shadow-inner focus:border-sky-400 focus:outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="חיפוש משימות..."
                  />
                </div>
              ) : null}
            </div>

            {/* Search dropdown (shared desktop + mobile) */}
            {searchQuery.trim() ? (
              <div className="mx-auto mt-2 max-h-96 max-w-[1220px] overflow-auto rounded-3xl bg-white p-3 shadow-2xl ring-1 ring-slate-200">
                {searchResults.length === 0 && settingsSearchResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm font-bold text-slate-500">לא מצאתי התאמות.</p>
                ) : (
                  <div className="space-y-2">
                    {settingsSearchResults.map((result) => (
                      <button key={`setting-${result.id}`} type="button" className="w-full rounded-2xl bg-violet-50 px-3 py-2 text-right ring-1 ring-violet-100 hover:bg-violet-100" onClick={() => { setActiveTab("settings"); setSearchQuery(""); setMobileSearchOpen(false); }}>
                        <span className="block text-sm font-black text-violet-950">⚙ הגדרה — {result.title}</span>
                        <span className="mt-1 block text-xs font-bold text-violet-700">{result.description}</span>
                      </button>
                    ))}
                    {searchResults.map((result) => (
                      <button key={result.task.id} type="button" className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-right ring-1 ring-slate-100 hover:bg-cyan-50 hover:ring-cyan-100" onClick={() => { jumpToTask(result.task); setMobileSearchOpen(false); }}>
                        <span className="block text-sm font-black text-slate-950">✓ משימה — {result.task.title}</span>
                        <span className="mt-1 block text-xs font-bold text-slate-500">{result.projectName} / {result.domainName} · מעבר ל־משימות</span>
                        {result.matchedSubtasks.length > 0 ? <span className="mt-1 block truncate text-xs text-emerald-700">✓ תת־משימה — {result.matchedSubtasks[0].title}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Mobile nav tabs */}
            <nav className="mission-tabs -mx-1 mt-1 flex gap-0.5 overflow-x-auto px-1 pb-1 xl:hidden" aria-label="Mission Control tabs mobile">
              {appTabs.map((tab) => (
                <button key={tab.id} type="button" className={`app-tab shrink-0 ${activeTab === tab.id ? theme.navActive : theme.navIdle}`} onClick={() => setActiveTab(tab.id)}>
                  {tab.mobileLabel ?? tab.label}
                </button>
              ))}
            </nav>
          </header>

          {/* ── Mobile panel (bottom sheet) ───────────────────────────────── */}
          {mobilePanelOpen ? (
            <>
              <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setMobilePanelOpen(false)} />
              <div dir="rtl" className={`fixed bottom-0 inset-x-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[2rem] p-5 shadow-2xl lg:hidden ${theme.sidebarBg}`}>
                {/* Drag handle */}
                <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-300" />

                {/* Today metrics */}
                <div className="mb-4 grid grid-cols-4 gap-2">
                  <MetricPill label="היום" value={data.progress.todayCount} tone="sky" />
                  <MetricPill label="בתהליך" value={data.progress.inProgressCount} tone="violet" />
                  <MetricPill label="בוצעו" value={data.progress.doneCount} tone="emerald" />
                  <MetricPill label="Backlog" value={data.progress.backlogCount} tone="amber" />
                </div>

                {/* Weather + holidays */}
                <section className="mb-4 rounded-3xl bg-white/80 p-3 ring-1 ring-sky-100">
                  <div className="space-y-2">
                    <MiniReminder label="מזג אוויר" value={morning.morningWeather?.currentTempC != null ? `${morning.morningWeather.currentTempC}°C · ${morning.morningWeather.cityLabel}` : "—"} />
                    {morning.morningWeather?.shabbatTime ? (
                      <MiniReminder label={morning.morningWeather.shabbatLabel ?? "שקיעה"} value={morning.morningWeather.shabbatTime} />
                    ) : null}
                    {(morning.morningWeather?.upcomingHolidays ?? []).map((h) => (
                      <div key={h.date} className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
                        <span className="text-xs font-black text-amber-800">{h.name}</span>
                        <span className="text-[11px] font-bold text-amber-600">
                          {h.daysUntil === 0 ? "היום" : h.daysUntil === 1 ? "מחר" : `עוד ${h.daysUntil} ימים`}
                          {h.candlesTime ? ` · כניסה ${h.candlesTime}` : ""}
                          {h.havdalahTime ? ` · יציאה ${h.havdalahTime}` : ""}
                        </span>
                      </div>
                    ))}
                    <button type="button" onClick={() => { setActiveTab("reminders"); setMobilePanelOpen(false); }} className="flex w-full items-center justify-between gap-2 rounded-2xl bg-white/85 px-3 py-2 text-right text-xs font-black ring-1 ring-sky-100 transition hover:bg-sky-50">
                      <span className="text-slate-800">תזכורות</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${pendingReminders.length > 0 ? "bg-amber-100 text-amber-800" : "text-slate-400"}`}>{pendingReminders.length} פעילות</span>
                    </button>
                  </div>
                </section>

                {/* Cloud sync */}
                <div className="mb-4 rounded-3xl bg-white/80 px-3 py-2.5 ring-1 ring-emerald-100">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-xs font-black text-emerald-800">Cloud Sync</span>
                    <button type="button" disabled={isSyncing} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-emerald-700 disabled:opacity-50" onClick={() => void syncCloud(data.pushLocalDataToCloud)}>{isSyncing ? "..." : "סנכרן ↑"}</button>
                    <button type="button" disabled={isSyncing} className="rounded-xl bg-white px-3 py-1.5 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-50 disabled:opacity-50" onClick={() => void syncCloud(data.pullCloudDataToLocal)}>{isSyncing ? "..." : "טען ↓"}</button>
                  </div>
                  {data.cloudSyncStatus ? <p className="mt-1.5 truncate text-[10px] font-bold text-emerald-700">{data.cloudSyncStatus}</p> : null}
                </div>

                {/* Quick actions */}
                <div className="mb-2 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => { setReadyCheckOpen(true); setMobilePanelOpen(false); }} className="rounded-2xl bg-white/80 px-3 py-3 text-center text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-sky-50">☀ בוקר?</button>
                  <button type="button" onClick={() => { setFocusTimerOpen(true); setMobilePanelOpen(false); }} className="rounded-2xl bg-white/80 px-3 py-3 text-center text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-orange-50">⏱ פוקוס</button>
                  <button type="button" onClick={() => { setActiveTab("settings"); setMobilePanelOpen(false); }} className="rounded-2xl bg-white/80 px-3 py-3 text-center text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100">⚙ הגדרות</button>
                </div>

                <p className="text-center text-[10px] font-bold text-slate-400">local · {APP_VERSION}</p>
              </div>
            </>
          ) : null}

          <div className="mx-auto max-w-[1220px] space-y-2 pb-36 sm:space-y-4 sm:pb-28">
            {data.error ? (
              <section className="rounded-3xl bg-red-50 p-5 text-red-900 ring-1 ring-red-200">
                <h2 className="font-bold">שגיאה בטעינת IndexedDB</h2>
                <p className="mt-1 text-sm ltr">{data.error}</p>
              </section>
            ) : null}

            {data.isLoading ? (
              <section className="rounded-3xl bg-white p-5 text-slate-500 shadow-soft ring-1 ring-slate-200">
                טוען נתונים מקומיים...
              </section>
            ) : (
              renderActiveTab()
            )}

            {dailyStateImportStatus ? (
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
                {dailyStateImportStatus}
              </p>
            ) : null}

            <footer className="flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-white/75 px-5 py-3 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
              <span>MikiZ Helper · UX-first local preview</span>
              {/* Desktop: all tool buttons */}
              <div className="hidden sm:flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={exportDailyState}
                  className="text-slate-400 transition hover:text-slate-700"
                >
                  ייצא Daily State
                </button>
                <button
                  type="button"
                  onClick={openDailyStateImportPicker}
                  className="text-slate-400 transition hover:text-slate-700"
                >
                  ייבוא Daily State
                </button>
                <button
                  type="button"
                  onClick={exportTomorrowHandoffReport}
                  className="text-slate-400 transition hover:text-slate-700"
                >
                  דוח למחר
                </button>
                <button
                  type="button"
                  onClick={() => setSystemCheckOpen(true)}
                  className="text-slate-400 transition hover:text-slate-700"
                >
                  בדיקת מערכת
                </button>
                <button
                  type="button"
                  onClick={exportAITaskFormat}
                  className="text-slate-400 transition hover:text-emerald-600"
                >
                  ייצא פורמט AI
                </button>
                <button
                  type="button"
                  onClick={() => setCommandCenterOpen(true)}
                  className="text-slate-400 transition hover:text-slate-700"
                >
                  Command Center
                </button>
              </div>
              {/* Mobile: single overflow button */}
              <div className="sm:hidden flex gap-2">
                <button
                  type="button"
                  onClick={exportAITaskFormat}
                  className="rounded-full px-3 py-1.5 text-slate-400 ring-1 ring-slate-200 transition hover:text-emerald-600"
                >
                  AI
                </button>
                <button
                  type="button"
                  onClick={() => setCommandCenterOpen(true)}
                  className="rounded-full px-3 py-1.5 text-slate-400 ring-1 ring-slate-200 transition hover:text-slate-700"
                >
                  ⋯
                </button>
              </div>
              <span>Supabase + Android Morning ready</span>
            </footer>
          </div>
        </section>
      </div>

      {/* ── Floating elements ─────────────────────────────────────────────────── */}

      <button
        type="button"
        className={`hidden ${
          morning.isGeneratingVoice || morning.isSpeaking || morning.isMorningLoading
            ? "bg-rose-600"
            : "bg-gradient-to-l from-emerald-500 to-cyan-500"
        }`}
        title="נאום בוקר"
        onClick={() => void morning.speakMorningBriefing()}
      >
        <span className="text-base">
          {morning.isGeneratingVoice || morning.isMorningLoading ? `${morning.morningPlayProgress}%` : morning.isSpeaking ? "■" : "▶"}
        </span>
        <span>{morning.isSpeaking ? "עצור נאום" : "נאום בוקר"}</span>
      </button>

      {activeTab !== "settings" ? (
        <CreateMissionItemButton
          settings={data.settings}
          todayISO={data.todayISO}
          isSaving={data.isSaving}
          existingTasks={data.tasks}
          existingSubtasks={data.subtasks}
          onCreateTask={data.createTask}
          onAddSubtaskToTask={data.addSubtaskToExistingTask}
          onOpenReminder={() => setQuickReminderOpen(true)}
        />
      ) : null}

      {quickReminderOpen ? (
        <QuickReminderModal
          todayISO={data.todayISO}
          isSaving={data.isSaving}
          onSave={async (input) => {
            await data.addReminder({
              taskId: null,
              subtaskId: null,
              title: input.title,
              date: input.date,
              time: input.time,
              note: input.note,
            });
          }}
          onClose={() => setQuickReminderOpen(false)}
        />
      ) : null}

      <ReminderToast
        dueReminders={dueReminders}
        tasks={data.tasks}
        onMarkDone={(id) => { setDueReminders((prev) => prev.filter((r) => r.id !== id)); void data.markReminderAsSent(id); }}
        onSnooze={(id, minutes) => { setDueReminders((prev) => prev.filter((r) => r.id !== id)); void data.snoozeExistingReminder(id, minutes); }}
        onDismiss={(id) => { setDueReminders((prev) => prev.filter((r) => r.id !== id)); void data.dismissReminder(id); }}
        onJumpToTask={(task) => {
          setActiveTab("tasks");
          setFocusedTaskId(task.id);
          setSearchQuery("");
        }}
      />

      {focusEndToast ? (
        <div className="fixed bottom-6 right-6 z-[90] max-w-sm rounded-3xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-2xl ring-1 ring-slate-700">
          <div className="flex items-start justify-between gap-4">
            <span>🔔 {focusEndToast}</span>
            <button
              type="button"
              className="text-white/70"
              onClick={() => setFocusEndToast("")}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Modals ────────────────────────────────────────────────────────────── */}

      {morning.showMorningBriefing ? (
        <MorningBriefingModal
          morningBriefingText={morning.morningBriefingText}
          setMorningBriefingTextOverride={morning.setMorningBriefingTextOverride}
          isMorningLoading={morning.isMorningLoading}
          isGeneratingVoice={morning.isGeneratingVoice}
          isSpeaking={morning.isSpeaking}
          voiceError={morning.voiceError}
          morningPublishStatus={morning.morningPublishStatus}
          voiceStatus={morning.voiceStatus}
          availableVoices={morning.availableVoices}
          selectedVoiceName={morning.selectedVoiceName}
          setSelectedVoiceName={morning.setSelectedVoiceName}
          speakMorningBriefing={morning.speakMorningBriefing}
          stopMorningBriefing={morning.stopMorningBriefing}
          downloadMorningBriefing={morning.downloadMorningBriefing}
          publishMorningBriefingForAndroid={morning.publishMorningBriefingForAndroid}
          onClose={() => morning.setShowMorningBriefing(false)}
        />
      ) : null}

      {commandCenterOpen ? (
        <CommandCenterModal
          morningCommandPlan={morning.morningCommandPlan}
          commandBlocks={morning.commandBlocks}
          commandStatus={morning.commandStatus}
          updateCommandBlock={morning.updateCommandBlock}
          saveMorningCommandPlan={morning.saveMorningCommandPlan}
          isSaving={data.isSaving}
          onClose={() => setCommandCenterOpen(false)}
        />
      ) : null}

      {readyCheckOpen ? (
        <ReadyCheckModal
          todayISO={data.todayISO}
          appVersion={APP_VERSION}
          activeTaskCount={activeTaskCount}
          openSubtaskCount={openSubtaskCount}
          pendingRemindersCount={pendingReminders.length}
          topTasksCount={morning.morningCommandPlan.topTasks.length}
          morningWeather={morning.morningWeather}
          voiceStatus={morning.voiceStatus}
          cloudSyncStatus={data.cloudSyncStatus}
          locationLabel={data.settings?.location.label ?? ""}
          onSpeakMorningBriefing={() => {
            setReadyCheckOpen(false);
            void morning.speakMorningBriefing();
          }}
          onClose={() => setReadyCheckOpen(false)}
        />
      ) : null}

      {systemCheckOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
          onClick={() => setSystemCheckOpen(false)}
        >
          <section
            className="w-full max-w-xl rounded-[2rem] bg-white p-5 shadow-2xl ring-1 ring-sky-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-black text-slate-950">בדיקת מערכת</h2>
            <div className="mt-4 grid gap-2 text-sm font-bold text-slate-700">
              <MiniReminder label="משימות" value={String(data.progress.totalTasks)} />
              <MiniReminder label="תתי־משימות" value={String(data.subtasks.length)} />
              <MiniReminder label="תזכורות" value={`${pendingReminders.length} פעילות`} />
              <MiniReminder
                label="התראות דפדפן"
                value={typeof Notification === "undefined" ? "לא נתמך" : Notification.permission}
              />
              <MiniReminder label="Daily State" value="ייצוא זמין" />
              <MiniReminder label="נאום בוקר" value={morning.morningBriefingText ? "נוצר" : "חסר"} />
              <MiniReminder label="ElevenLabs" value={morning.elevenLabsReady ? "מוגדר" : "לא מוגדר"} />
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
              onClick={() => setSystemCheckOpen(false)}
            >
              סגור
            </button>
          </section>
        </div>
      ) : null}

      {focusRunning && !focusTimerOpen ? (
        <button
          type="button"
          className="fixed top-3 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-2xl ring-2 ring-white/90"
          onClick={() => setFocusTimerOpen(true)}
          aria-label="פתח טיימר פוקוס"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span>פוקוס</span>
          <span className="tabular-nums">{focusTimerLabel}</span>
        </button>
      ) : null}

      {focusTimerOpen ? (
        <FocusTimerModal
          focusSeconds={focusSeconds}
          focusRunning={focusRunning}
          onStart={() => {
            if ("Notification" in window && Notification.permission === "default")
              void Notification.requestPermission();
            setFocusRunning(true);
          }}
          onStop={() => setFocusRunning(false)}
          onReset={() => { setFocusRunning(false); setFocusSeconds(20 * 60); }}
          onSetMinutes={(minutes) => { setFocusRunning(false); setFocusSeconds(minutes * 60); }}
          onClose={() => setFocusTimerOpen(false)}
        />
      ) : null}
    </main>
  );
}
