import { useEffect, useRef, useState } from "react";
import type { Reminder } from "../../domain/reminders/reminderTypes";
import type { AppSettings } from "../../domain/settings/settingsTypes";
import { LinkifiedText } from "../ui/LinkifiedText";
import type {
  BacklogGroup,
  Subtask,
  SubtaskStatus,
  Task,
} from "../../domain/tasks/taskTypes";
import { getTaskProgress } from "../../domain/tasks/taskProgress";
import { getSubtasksForTask } from "../../domain/tasks/taskSelectors";
import {
  effortLabels,
  priorityLabels,
  statusLabels,
} from "../../utils/hebrewLabels";

interface ReadOnlyTaskCardProps {
  task: Task;
  subtasks: Subtask[];
  reminders?: Reminder[];
  projectName?: string;
  domainName?: string;
  isSaving?: boolean;
  isCompletedArchived?: boolean;
  settings?: AppSettings | null;
  onChangeSubtaskStatus?: (
    subtaskId: string,
    status: SubtaskStatus,
  ) => Promise<void> | void;
  onCompleteTask?: (taskId: string) => Promise<void> | void;
  onMoveToTomorrow?: (task: Task) => Promise<void> | void;
  onMoveToBacklogGroup?: (task: Task, backlogGroup: BacklogGroup) => Promise<void> | void;
  onChangeTaskDate?: (task: Task, targetDate: string) => Promise<void> | void;
  onCancelTask?: (taskId: string) => Promise<void> | void;
  onUpdateTaskText?: (
    taskId: string,
    patch: { title?: string; whyNow?: string; notes?: string; aiConversationUrl?: string | null },
  ) => Promise<void> | void;
  onUpdateSubtaskText?: (
    subtaskId: string,
    patch: { title?: string; notes?: string; aiConversationUrl?: string | null },
  ) => Promise<void> | void;
  onUpdateTaskDetails?: (
    taskId: string,
    patch: {
      projectId?: string;
      domainId?: string;
      priority?: Task["priority"];
      effort?: Task["effort"];
      tags?: string[];
    },
  ) => Promise<void> | void;
  onAddSubtaskToTask?: (input: {
    taskId: string;
    title: string;
    notes?: string;
    aiConversationUrl?: string | null;
  }) => Promise<void> | void;
  onReorderTaskFocus?: (
    taskId: string,
    action: "first" | "up" | "down" | "bottom",
  ) => Promise<void> | void;
  canReorderFocus?: boolean;
  onAddReminder?: (input: {
    taskId: string;
    subtaskId?: string | null;
    title: string;
    date: string;
    time: string;
    note?: string;
  }) => Promise<void> | void;
  isFocused?: boolean;
  onOpenFocusTimer?: () => void;
  onAddTaskToFocus?: (taskId: string) => Promise<void> | void;
  onAddSubtaskToFocus?: (taskId: string, subtaskId: string) => Promise<void> | void;
  isBacklogPreview?: boolean;
}

function isSubtaskStarted(subtask: Subtask): boolean {
  return subtask.status === "started" || subtask.status === "done";
}

function isSubtaskDone(subtask: Subtask): boolean {
  return subtask.status === "done";
}

function getStatusBadgeClass(
  progress: ReturnType<typeof getTaskProgress>,
): string {
  if (progress.status === "done")
    return "bg-rose-50 text-rose-700 ring-rose-100";
  if (progress.status === "cancelled")
    return "bg-rose-50 text-rose-700 ring-rose-100";
  if (progress.status === "moved")
    return "bg-amber-50 text-amber-700 ring-amber-100";
  if (progress.startedCount > 0 && progress.percent === 0)
    return "bg-violet-50 text-violet-700 ring-violet-100";
  if (progress.status === "in_progress")
    return "bg-sky-50 text-sky-700 ring-sky-100";
  return "bg-slate-50 text-slate-600 ring-slate-200";
}

function getProgressFillClass(
  progress: ReturnType<typeof getTaskProgress>,
): string {
  if (progress.status === "done")
    return "bg-gradient-to-l from-emerald-400 to-teal-400";
  if (progress.startedCount > 0 && progress.percent === 0)
    return "bg-gradient-to-l from-violet-400 to-fuchsia-400";
  return "bg-gradient-to-l from-sky-400 to-cyan-300";
}

const defaultEditableTagOptions = [
  "follow-up",
  "urgent",
  "birthday",
  "phone",
  "email",
  "waiting",
  "qa",
  "sales",
  "marketing",
  "production",
  "website",
  "shopify",
  "apollo",
  "finance",
  "personal",
  "timeraligner",
  "typeswitch",
  "quick-win",
  "interruption",
  "leads",
  "jack",
  "instantly",
];

function getEditableTagOptions(
  settings: AppSettings | null | undefined,
  currentTags: string[],
): string[] {
  return Array.from(
    new Set([
      ...defaultEditableTagOptions,
      ...(settings?.projects.map((project) => project.id) ?? []),
      ...(settings?.domains.map((domain) => domain.id) ?? []),
      ...currentTags,
    ]),
  ).filter(Boolean);
}

function getTagChipClass(isSelected: boolean): string {
  return `rounded-xl px-3 py-1.5 text-xs font-black ring-1 transition ${
    isSelected
      ? "bg-slate-950 text-white ring-slate-950 shadow-sm"
      : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-sky-50 hover:text-sky-800 hover:ring-sky-100"
  }`;
}

function getLocalISODate(daysFromToday = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextHourTime(): string {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:00`;
}

function formatShortReminder(reminder: Reminder | undefined): string | null {
  if (!reminder) return null;
  const date = new Date(reminder.remindAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFirstPendingReminder(
  reminders: Reminder[],
  taskId: string,
  subtaskId?: string | null,
): Reminder | undefined {
  return reminders
    .filter(
      (reminder) =>
        reminder.status === "pending" &&
        reminder.taskId === taskId &&
        (subtaskId ? reminder.subtaskId === subtaskId : !reminder.subtaskId),
    )
    .sort(
      (a, b) => (Date.parse(a.remindAt) || 0) - (Date.parse(b.remindAt) || 0),
    )[0];
}

function focusButtonClass(tone: "strong" | "soft" = "soft"): string {
  return tone === "strong"
    ? "grid h-8 w-8 place-items-center rounded-full bg-slate-950 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
    : "grid h-8 w-8 place-items-center rounded-full bg-white text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-sky-50 hover:text-sky-800 hover:ring-sky-100";
}

function normalizeAiConversationUrl(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function getAiProviderLabel(value: string | null | undefined): string {
  const url = normalizeAiConversationUrl(value);
  if (!url) return "AI";
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("claude.ai")) return "Claude";
  if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) return "ChatGPT";
  return "AI";
}

function openAiConversation(value: string | null | undefined) {
  const url = normalizeAiConversationUrl(value);
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function ReadOnlyTaskCard({
  task,
  subtasks,
  reminders = [],
  projectName,
  domainName,
  isSaving = false,
  isCompletedArchived = false,
  settings,
  onChangeSubtaskStatus,
  onCompleteTask,
  onMoveToTomorrow,
  onMoveToBacklogGroup,
  onChangeTaskDate,
  onCancelTask,
  onUpdateTaskText,
  onUpdateSubtaskText,
  onUpdateTaskDetails,
  onAddSubtaskToTask,
  onReorderTaskFocus,
  canReorderFocus = false,
  onAddReminder,
  isFocused = false,
  onOpenFocusTimer,
  onAddTaskToFocus,
  onAddSubtaskToFocus,
  isBacklogPreview = false,
}: ReadOnlyTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [targetDate, setTargetDate] = useState(task.date ?? "");
  const [actionError, setActionError] = useState("");
  const [isTextEditOpen, setIsTextEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editWhyNow, setEditWhyNow] = useState(task.whyNow ?? "");
  const [editNotes, setEditNotes] = useState(task.notes ?? "");
  const [editAiConversationUrl, setEditAiConversationUrl] = useState(task.aiConversationUrl ?? "");
  const [isAddSubtaskOpen, setIsAddSubtaskOpen] = useState(false);
  const [isDetailsEditOpen, setIsDetailsEditOpen] = useState(false);
  const [editProjectId, setEditProjectId] = useState(task.projectId);
  const [editDomainId, setEditDomainId] = useState(task.domainId);
  const [editPriority, setEditPriority] = useState<Task["priority"]>(
    task.priority,
  );
  const [editEffort, setEditEffort] = useState<Task["effort"]>(task.effort);
  const [editTags, setEditTags] = useState<string[]>(task.tags ?? []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskNotes, setNewSubtaskNotes] = useState("");
  const [newSubtaskAiConversationUrl, setNewSubtaskAiConversationUrl] = useState("");
  const [showDoneSubtasks, setShowDoneSubtasks] = useState(false);
  const [editedSubtaskTitles, setEditedSubtaskTitles] = useState<Record<string, string>>({});
  const [editedSubtaskAiLinks, setEditedSubtaskAiLinks] = useState<Record<string, string>>({});
  const [reminderTarget, setReminderTarget] = useState<{
    type: "task" | "subtask";
    subtaskId?: string | null;
    title: string;
  } | null>(null);
  const [reminderDate, setReminderDate] = useState(() => getLocalISODate());
  const [reminderTime, setReminderTime] = useState(() => getNextHourTime());
  const [reminderNote, setReminderNote] = useState("");
  const [reminderTitle, setReminderTitle] = useState("");
  const cardRef = useRef<HTMLElement | null>(null);
  const taskSubtasks = getSubtasksForTask(task.id, subtasks);
  const activeWorkSubtasks = taskSubtasks.filter(
    (subtask) => subtask.status !== "done" && subtask.status !== "cancelled",
  );
  const startedWorkSubtasks = activeWorkSubtasks.filter((subtask) =>
    isSubtaskStarted(subtask),
  );
  const openWorkSubtasks = activeWorkSubtasks.filter(
    (subtask) => !isSubtaskStarted(subtask),
  );
  const doneSubtasks = taskSubtasks.filter((subtask) => subtask.status === "done");
  const cancelledSubtasks = taskSubtasks.filter((subtask) => subtask.status === "cancelled");
  const shouldCollapseDoneSubtasks = doneSubtasks.length >= 3;
  const visibleDoneSubtasks = shouldCollapseDoneSubtasks && !showDoneSubtasks
    ? doneSubtasks.slice(-1)
    : doneSubtasks;
  const visibleSubtasks = [
    ...startedWorkSubtasks,
    ...openWorkSubtasks,
    ...visibleDoneSubtasks,
    ...cancelledSubtasks,
  ];
  const progress = getTaskProgress(task, subtasks);
  const taskReminder = getFirstPendingReminder(reminders, task.id, null);
  const taskReminderLabel = formatShortReminder(taskReminder);
  const isDone = progress.status === "done";
  const isMutedDone = isCompletedArchived && isDone;
  const taskAiUrl = normalizeAiConversationUrl(task.aiConversationUrl);
  const taskAiProviderLabel = getAiProviderLabel(taskAiUrl);
  const canUseTaskActions = Boolean(
    onMoveToTomorrow ||
    onChangeTaskDate ||
    onCancelTask ||
    onUpdateTaskText ||
    onUpdateTaskDetails ||
    onAddSubtaskToTask ||
    onAddReminder ||
    onAddTaskToFocus,
  );

  useEffect(() => {
    setEditTitle(task.title);
    setEditWhyNow(task.whyNow ?? "");
    setEditNotes(task.notes ?? "");
    setEditAiConversationUrl(task.aiConversationUrl ?? "");
    setEditProjectId(task.projectId);
    setEditDomainId(task.domainId);
    setEditPriority(task.priority);
    setEditEffort(task.effort);
    setEditTags(task.tags);
    setTargetDate(task.date ?? "");
    setShowDoneSubtasks(false);
    setEditedSubtaskAiLinks({});
  }, [task]);

  useEffect(() => {
    if (!isFocused) return;
    setIsExpanded(true);
    const timeoutId = window.setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [isFocused]);

  const handleToggleStart = async (subtask: Subtask, checked: boolean) => {
    if (!onChangeSubtaskStatus) return;
    setActionError("");
    await onChangeSubtaskStatus(
      subtask.id,
      checked ? "started" : "not_started",
    );
  };

  const handleToggleDone = async (subtask: Subtask, checked: boolean) => {
    if (!onChangeSubtaskStatus) return;
    setActionError("");
    await onChangeSubtaskStatus(subtask.id, checked ? "done" : "started");
  };

  const handleToggleTaskDone = async (checked: boolean) => {
    setActionError("");
    if (taskSubtasks.length === 0) {
      if (!checked) return;
      if (!onCompleteTask) {
        setActionError("לא ניתן לסמן משימה בלי תתי־משימות כבוצעה כרגע.");
        return;
      }
      await onCompleteTask(task.id);
      return;
    }
    if (!onChangeSubtaskStatus) return;
    for (const subtask of taskSubtasks) {
      await onChangeSubtaskStatus(subtask.id, checked ? "done" : "not_started");
    }
  };

  const handleSaveTaskText = async () => {
    if (!onUpdateTaskText) return;
    const title = editTitle.trim();
    if (!title) {
      setActionError("אי אפשר לשמור משימה בלי כותרת.");
      return;
    }
    setActionError("");
    await onUpdateTaskText(task.id, {
      title,
      whyNow: editWhyNow,
      notes: editNotes,
      aiConversationUrl: normalizeAiConversationUrl(editAiConversationUrl) || null,
    });
    setIsTextEditOpen(false);
  };

  const resetTaskTextEdit = () => {
    setEditTitle(task.title);
    setEditWhyNow(task.whyNow ?? "");
    setEditNotes(task.notes ?? "");
    setEditAiConversationUrl(task.aiConversationUrl ?? "");
    setIsTextEditOpen(false);
    setActionError("");
  };

  const handleSaveSubtaskText = async (subtask: Subtask) => {
    if (!onUpdateSubtaskText) return;
    const nextTitle = (editedSubtaskTitles[subtask.id] ?? subtask.title).trim();
    if (!nextTitle) {
      setActionError("אי אפשר לשמור תת־משימה בלי טקסט.");
      return;
    }
    const nextAiConversationUrl = normalizeAiConversationUrl(editedSubtaskAiLinks[subtask.id] ?? subtask.aiConversationUrl ?? "") || null;
    if (nextTitle === subtask.title && nextAiConversationUrl === (subtask.aiConversationUrl ?? null)) return;
    setActionError("");
    await onUpdateSubtaskText(subtask.id, { title: nextTitle, aiConversationUrl: nextAiConversationUrl });
    setEditedSubtaskTitles((current) => {
      const next = { ...current };
      delete next[subtask.id];
      return next;
    });
    setEditedSubtaskAiLinks((current) => {
      const next = { ...current };
      delete next[subtask.id];
      return next;
    });
  };

  const resetTaskDetailsEdit = () => {
    setEditProjectId(task.projectId);
    setEditDomainId(task.domainId);
    setEditPriority(task.priority);
    setEditEffort(task.effort);
    setEditTags(task.tags);
    setIsDetailsEditOpen(false);
    setActionError("");
  };

  const openReminderBubble = (target: {
    type: "task" | "subtask";
    subtaskId?: string | null;
    title: string;
  }) => {
    setReminderTarget(target);
    setReminderTitle(target.title);
    setReminderDate(getLocalISODate());
    setReminderTime(getNextHourTime());
    setReminderNote("");
    setActionError("");
  };

  const handleSaveReminder = async () => {
    if (!onAddReminder || !reminderTarget) return;
    if (!reminderDate || !reminderTime) {
      setActionError("בחר תאריך ושעה לתזכורת.");
      return;
    }
    setActionError("");
    await onAddReminder({
      taskId: task.id,
      subtaskId:
        reminderTarget.type === "subtask"
          ? (reminderTarget.subtaskId ?? null)
          : null,
      title: reminderTitle.trim() || reminderTarget.title,
      date: reminderDate,
      time: reminderTime,
      note: reminderNote,
    });
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    setReminderTarget(null);
    setReminderNote("");
  };

  const handleReorderFocus = async (
    action: "first" | "up" | "down" | "bottom",
  ) => {
    if (!onReorderTaskFocus) return;
    setActionError("");
    await onReorderTaskFocus(task.id, action);
  };

  const toggleEditTag = (tag: string) => {
    setEditTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  };

  const handleSaveTaskDetails = async () => {
    if (!onUpdateTaskDetails) return;
    setActionError("");
    const tags = Array.from(
      new Set(editTags.map((tag) => tag.trim()).filter(Boolean)),
    );
    await onUpdateTaskDetails(task.id, {
      projectId: editProjectId,
      domainId: editDomainId,
      priority: editPriority,
      effort: editEffort,
      tags,
    });
    setIsDetailsEditOpen(false);
  };

  const handleMarkMorningImportant = async () => {
    if (!onUpdateTaskDetails) return;
    setActionError("");
    const tags = Array.from(new Set([...(task.tags ?? []), "important", "morning-important"]));
    await onUpdateTaskDetails(task.id, {
      projectId: task.projectId,
      domainId: task.domainId,
      priority: "high",
      effort: task.effort,
      tags,
    });
  };

  const pendingSubtaskTitles = newSubtaskTitle
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const handleAddSubtask = async () => {
    if (!onAddSubtaskToTask) return;
    if (!pendingSubtaskTitles.length) {
      setActionError("כתוב לפחות תת־משימה אחת לפני שמירה.");
      return;
    }
    setActionError("");
    for (const title of pendingSubtaskTitles) {
      await onAddSubtaskToTask({
        taskId: task.id,
        title,
        notes: newSubtaskNotes.trim() || undefined,
        aiConversationUrl: normalizeAiConversationUrl(newSubtaskAiConversationUrl) || null,
      });
    }
    setNewSubtaskTitle("");
    setNewSubtaskNotes("");
    setNewSubtaskAiConversationUrl("");
    setIsAddSubtaskOpen(false);
  };

  const handleMoveTomorrow = async () => {
    if (!onMoveToTomorrow) return;
    setActionError("");
    await onMoveToTomorrow(task);
  };

  const handleMoveToday = async () => {
    if (!onChangeTaskDate) return;
    setActionError("");
    await onChangeTaskDate(task, getLocalISODate());
  };

  const handleMoveBacklogGroup = async (backlogGroup: BacklogGroup) => {
    if (!onMoveToBacklogGroup) return;
    setActionError("");
    await onMoveToBacklogGroup(task, backlogGroup);
  };

  const handleAddTaskToFocus = async () => {
    if (!onAddTaskToFocus) return;
    setActionError("");
    try {
      await onAddTaskToFocus(task.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "לא ניתן להוסיף לפוקוס כרגע.");
    }
  };

  const handleAddSubtaskToFocus = async (subtaskId: string) => {
    if (!onAddSubtaskToFocus) return;
    setActionError("");
    try {
      await onAddSubtaskToFocus(task.id, subtaskId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "לא ניתן להוסיף לפוקוס כרגע.");
    }
  };

  const handleChangeDate = async () => {
    if (!onChangeTaskDate) return;
    if (!targetDate) {
      setActionError("בחר תאריך יעד לפני שינוי תאריך.");
      return;
    }
    setActionError("");
    await onChangeTaskDate(task, targetDate);
  };

  const handleCancelTask = async () => {
    if (!onCancelTask) return;
    setActionError("");
    await onCancelTask(task.id);
    setCancelConfirm(false);
  };

  return (
    <article
      ref={cardRef}
      className={`rounded-2xl border p-3 shadow-sm transition hover:shadow-soft sm:p-4 ${
        isFocused
          ? "border-cyan-300 bg-cyan-50/60 ring-4 ring-cyan-100"
          : isDone
            ? `${isMutedDone ? "opacity-85" : ""} border-rose-100 bg-rose-50/60`
            : isBacklogPreview
              ? "border-amber-200 bg-amber-50 hover:border-amber-300"
              : "border-slate-200 bg-white hover:border-sky-200"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        className="w-full text-right"
        onClick={() => setIsExpanded((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsExpanded((current) => !current);
          }
        }}
        aria-expanded={isExpanded}
      >
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-3">
          <div className="min-w-0">
            <div className="mission-task-meta flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 sm:gap-2 sm:text-xs">
              <span className="rounded-full bg-sky-50 px-2 py-0.5 font-bold text-sky-700 ring-1 ring-sky-100 sm:py-1">
                {task.scheduledTimeLabel ?? "ללא שעה"}
              </span>
              <span className="truncate">{projectName ?? task.projectId}</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">{domainName ?? task.domainId}</span>
              {task.durationLabel ? <span className="hidden sm:inline">• {task.durationLabel}</span> : null}
              {task.movedCount > 0 ? (
                <span className="font-bold text-amber-700">
                  • הועבר {task.movedCount}
                </span>
              ) : null}
              {isMutedDone ? (
                <span className="font-bold text-emerald-700">• הושלם</span>
              ) : null}
              {taskReminderLabel ? (
                <span className="font-black text-emerald-700">
                  • 🔔 {taskReminderLabel}
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 flex items-start gap-2 sm:mt-2 sm:items-center">
              <span className="mt-0.5 text-base font-black text-slate-950 sm:mt-0 sm:text-lg">
                {isExpanded ? "▾" : "▸"}
              </span>
              <h3
                className={`mobile-clamp-2 min-w-0 text-base font-black leading-tight sm:truncate sm:text-lg ${isDone ? "text-rose-950/70 line-through decoration-rose-400 decoration-2" : "text-slate-950"}`}
              >
                <LinkifiedText text={task.title} />
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:gap-2 sm:text-xs">
            {canReorderFocus && onReorderTaskFocus ? (
              <div
                className="hidden sm:flex items-center gap-1"
                onClick={(event) => event.stopPropagation()}
                aria-label="סידור פוקוס יומי"
              >
                <button
                  type="button"
                  className={focusButtonClass("strong")}
                  title="העלה לראש"
                  onClick={() => void handleReorderFocus("first")}
                >
                  ⇧
                </button>
                <button
                  type="button"
                  className={focusButtonClass()}
                  title="העלה מקום אחד"
                  onClick={() => void handleReorderFocus("up")}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={focusButtonClass()}
                  title="הורד מקום אחד"
                  onClick={() => void handleReorderFocus("down")}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={focusButtonClass("strong")}
                  title="לא עכשיו — הורד הכי למטה"
                  onClick={() => void handleReorderFocus("bottom")}
                >
                  ⇩
                </button>
              </div>
            ) : null}
            {taskAiUrl ? (
              <button
                type="button"
                className="rounded-full bg-cyan-50 px-2 py-0.5 font-black text-cyan-700 ring-1 ring-cyan-100 transition hover:bg-cyan-100 sm:py-1"
                onClick={(event) => {
                  event.stopPropagation();
                  openAiConversation(taskAiUrl);
                }}
              >
                {taskAiProviderLabel}
              </button>
            ) : null}
            {onAddTaskToFocus ? (
              <button
                type="button"
                className={`rounded-full px-2 py-0.5 font-black ring-1 transition sm:py-1 ${
                  isFocused
                    ? "bg-cyan-600 text-white ring-cyan-600"
                    : "bg-cyan-50 text-cyan-800 ring-cyan-100 hover:bg-cyan-100"
                }`}
                disabled={isSaving}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleAddTaskToFocus();
                }}
                title={isFocused ? "כבר בפוקוס" : "הוסף לפוקוס"}
              >
                {isFocused ? "בפוקוס" : "+ פוקוס"}
              </button>
            ) : null}
            <span
              className={`rounded-full px-2 py-0.5 font-bold ring-1 sm:py-1 ${getStatusBadgeClass(progress)}`}
            >
              {progress.startedCount > 0 &&
              progress.percent === 0 &&
              progress.status !== "done"
                ? "התחיל · 0%"
                : statusLabels[progress.status]}
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-700 ring-1 ring-amber-100 sm:py-1">
              {priorityLabels[task.priority]}
            </span>
            {onUpdateTaskDetails ? (
              <button
                type="button"
                className={`rounded-full px-2 py-0.5 font-black ring-1 transition sm:py-1 ${task.priority === "high" && (task.tags ?? []).includes("morning-important") ? "bg-rose-600 text-white ring-rose-600" : "bg-rose-50 text-rose-700 ring-rose-100 hover:bg-rose-100"}`}
                disabled={isSaving}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleMarkMorningImportant();
                }}
                title="סמן כדחוף לנאום הבוקר"
              >
                דחוף
              </button>
            ) : null}
            {task.bucket !== "today" && onChangeTaskDate ? (
              <button
                type="button"
                className="rounded-full bg-sky-50 px-2 py-0.5 font-black text-sky-800 ring-1 ring-sky-100 transition hover:bg-sky-100 sm:py-1"
                disabled={isSaving}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleMoveToday();
                }}
                title="העבר להיום"
              >
                היום
              </button>
            ) : null}
            <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 font-bold text-fuchsia-700 ring-1 ring-fuchsia-100 sm:py-1">
              {effortLabels[task.effort]}
            </span>
            {onChangeSubtaskStatus ? (
              <label
                className="flex items-center gap-1.5 rounded-2xl bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-emerald-50 hover:text-emerald-800 hover:ring-emerald-100 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
                onClick={(event) => event.stopPropagation()}
                title={task.isRecurring ? "סמן שהמופע של היום בוצע" : "סמן סוף משימה"}
              >
                <span>{task.isRecurring ? "בוצע היום" : "סוף"}</span>
                <input
                  type="checkbox"
                  checked={isDone}
                  disabled={isSaving || (taskSubtasks.length === 0 && !onCompleteTask)}
                  onChange={(event) =>
                    void handleToggleTaskDone(event.currentTarget.checked)
                  }
                />
              </label>
            ) : null}
          </div>
        </div>

        <div className="mt-2 sm:mt-3">
          <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-500 sm:text-xs">
            <span>
              {progress.doneCount}/{progress.totalCount} תתי־משימות הושלמו
              {progress.startedCount > 0 && progress.doneCount === 0
                ? " · התחלת להתעסק בזה"
                : ""}
            </span>
            <span>{progress.percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 sm:h-2">
            <div
              className={`h-full rounded-full transition-all ${getProgressFillClass(progress)}`}
              style={{
                width: `${progress.percent > 0 ? progress.percent : progress.startedCount > 0 ? 6 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 sm:mt-4 sm:space-y-3 sm:pt-4">
          {task.whyNow ? (
            <p className="rounded-2xl bg-sky-50 px-3 py-2 text-xs text-slate-700 sm:text-sm">
              <LinkifiedText text={task.whyNow} />
            </p>
          ) : null}
          {task.notes ? (
            <p className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:text-sm">
              <LinkifiedText text={task.notes} />
            </p>
          ) : null}
          {taskAiUrl ? (
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-2xl bg-cyan-50 px-3 py-2 text-right text-xs font-black text-cyan-900 ring-1 ring-cyan-100 transition hover:bg-cyan-100 sm:text-sm"
              onClick={(event) => {
                event.stopPropagation();
                openAiConversation(taskAiUrl);
              }}
            >
              <span>פתח שיחת AI</span>
              <span className="truncate text-[11px] text-cyan-700">{taskAiProviderLabel}</span>
            </button>
          ) : null}

          {canUseTaskActions ? (
            <div
              className="sticky top-2 z-10 grid grid-cols-2 gap-2 rounded-2xl bg-white/95 p-2 shadow-sm ring-1 ring-slate-200 backdrop-blur sm:flex sm:flex-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={`rounded-2xl px-3 py-2 text-xs font-black ring-1 transition ${isTextEditOpen ? "bg-sky-600 text-white ring-sky-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-sky-50 hover:text-sky-800"}`}
                disabled={!onUpdateTaskText}
                onClick={() => setIsTextEditOpen((c) => !c)}
              >
                עריכה
              </button>
              <button
                type="button"
                className={`rounded-2xl px-3 py-2 text-xs font-black ring-1 transition ${isDetailsEditOpen ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-indigo-50 hover:text-indigo-700"}`}
                disabled={!onUpdateTaskDetails}
                onClick={() => setIsDetailsEditOpen((c) => !c)}
              >
                פרטים
              </button>
              <button
                type="button"
                className={`rounded-2xl px-3 py-2 text-xs font-black ring-1 transition ${isAddSubtaskOpen ? "bg-emerald-600 text-white ring-emerald-600" : "bg-emerald-50 text-emerald-700 ring-emerald-100 hover:bg-emerald-100"}`}
                disabled={!onAddSubtaskToTask}
                onClick={() => setIsAddSubtaskOpen((c) => !c)}
              >
                + תת־משימה
              </button>
              <button
                type="button"
                className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 ring-1 ring-amber-100 transition hover:bg-amber-100"
                disabled={!onAddReminder}
                onClick={() => openReminderBubble({ type: "task", title: task.title })}
              >
                {taskReminderLabel ? `תזכורת ${taskReminderLabel}` : "תזכורת"}
              </button>
              <button
                type="button"
                className="rounded-2xl bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800 ring-1 ring-cyan-100 transition hover:bg-cyan-100 disabled:opacity-40"
                disabled={isSaving || !onAddTaskToFocus}
                onClick={() => void handleAddTaskToFocus()}
              >
                + פוקוס
              </button>
              <button
                type="button"
                className="rounded-2xl bg-orange-50 px-3 py-2 text-xs font-black text-orange-800 ring-1 ring-orange-100 transition hover:bg-orange-100 disabled:opacity-40"
                disabled={!onOpenFocusTimer}
                onClick={() => onOpenFocusTimer?.()}
              >
                טיימר
              </button>
              <button
                type="button"
                className="rounded-2xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-800 ring-1 ring-sky-100 transition hover:bg-sky-100 disabled:opacity-40"
                disabled={isSaving || !onChangeTaskDate || task.bucket === "today"}
                onClick={() => void handleMoveToday()}
              >
                היום
              </button>
              <button
                type="button"
                className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                disabled={isSaving || !onMoveToTomorrow}
                onClick={() => void handleMoveTomorrow()}
              >
                מחר
              </button>
            </div>
          ) : null}

          {taskSubtasks.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[11px] font-black text-slate-600 ring-1 ring-slate-200">
              <span className="text-slate-900">עבודה פתוחה: {activeWorkSubtasks.length}</span>
              <span>בוצעו: {doneSubtasks.length}</span>
              {cancelledSubtasks.length ? <span>בוטלו: {cancelledSubtasks.length}</span> : null}
            </div>
          ) : null}

          <ul className="space-y-2">
            {visibleSubtasks.map((subtask) => {
              const started = isSubtaskStarted(subtask);
              const done = isSubtaskDone(subtask);
              const subtaskReminder = getFirstPendingReminder(
                reminders,
                task.id,
                subtask.id,
              );
              const subtaskReminderLabel = formatShortReminder(subtaskReminder);
              const subtaskAiUrl = normalizeAiConversationUrl(subtask.aiConversationUrl) || taskAiUrl;
              const subtaskAiProviderLabel = getAiProviderLabel(subtaskAiUrl);
              const subtaskAiDraft = editedSubtaskAiLinks[subtask.id] ?? subtask.aiConversationUrl ?? "";
              const hasSubtaskTextChange = (editedSubtaskTitles[subtask.id] ?? subtask.title) !== subtask.title;
              const hasSubtaskAiChange = normalizeAiConversationUrl(subtaskAiDraft) !== normalizeAiConversationUrl(subtask.aiConversationUrl);

              return (
                <li
                  key={subtask.id}
                  className="rounded-xl bg-slate-50 px-2.5 py-2 text-sm ring-1 ring-slate-200 sm:px-3"
                >
                  <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                    <label className="flex items-center gap-2 whitespace-nowrap text-[11px] font-bold text-slate-700 sm:text-xs">
                      <input
                        type="checkbox"
                        checked={started}
                        disabled={isSaving || !onChangeSubtaskStatus}
                        onChange={(event) =>
                          void handleToggleStart(
                            subtask,
                            event.currentTarget.checked,
                          )
                        }
                      />
                      <span>התחלה</span>
                    </label>

                    <div className="min-w-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          className={`min-h-9 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 sm:min-h-10 ${done ? "text-slate-500 line-through" : ""}`}
                          value={editedSubtaskTitles[subtask.id] ?? subtask.title}
                          disabled={isSaving || !onUpdateSubtaskText}
                          onChange={(event) =>
                            setEditedSubtaskTitles((current) => ({
                              ...current,
                              [subtask.id]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                              void handleSaveSubtaskText(subtask);
                            }
                          }}
                          aria-label="עריכת טקסט תת־משימה"
                        />
                        {onUpdateSubtaskText &&
                        (hasSubtaskTextChange || hasSubtaskAiChange) ? (
                          <button
                            type="button"
                            className="rounded-full bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100"
                            disabled={isSaving}
                            onClick={() => void handleSaveSubtaskText(subtask)}
                          >
                            שמור
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <input
                          className="min-h-9 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 ltr text-left"
                          value={subtaskAiDraft}
                          disabled={isSaving || !onUpdateSubtaskText}
                          onChange={(event) =>
                            setEditedSubtaskAiLinks((current) => ({
                              ...current,
                              [subtask.id]: event.target.value,
                            }))
                          }
                          placeholder={taskAiUrl ? "ריק = משתמש בקישור של משימת העל" : "AI conversation URL"}
                          aria-label="AI conversation URL"
                        />
                        {subtaskAiUrl ? (
                          <button
                            type="button"
                            className="rounded-2xl bg-cyan-50 px-3 py-2 text-[11px] font-black text-cyan-800 ring-1 ring-cyan-100 hover:bg-cyan-100"
                            onClick={() => openAiConversation(subtaskAiUrl)}
                          >
                            {subtaskAiProviderLabel}
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
                        {subtask.durationLabel ??
                          (subtask.estimatedDurationMinutes
                            ? `${subtask.estimatedDurationMinutes} דק׳`
                            : "ללא זמן")}
                        {subtask.toolsNeeded ? ` · ${subtask.toolsNeeded}` : ""}
                        {subtaskReminderLabel
                          ? ` · 🔔 ${subtaskReminderLabel}`
                          : ""}
                      </p>
                      {subtask.notes ? (
                        <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
                          <LinkifiedText text={subtask.notes} />
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {onAddReminder ? (
                        <button
                          type="button"
                          className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700 ring-1 ring-amber-100 hover:bg-amber-100"
                          onClick={() =>
                            openReminderBubble({
                              type: "subtask",
                              subtaskId: subtask.id,
                              title: subtask.title,
                            })
                          }
                        >
                          תזכורת
                        </button>
                      ) : null}
                      {onAddSubtaskToFocus ? (
                        <button
                          type="button"
                          className="rounded-2xl bg-cyan-50 px-3 py-1.5 text-xs font-black text-cyan-800 ring-1 ring-cyan-100 transition hover:bg-cyan-100 disabled:opacity-40"
                          disabled={isSaving}
                          onClick={() => void handleAddSubtaskToFocus(subtask.id)}
                        >
                          + פוקוס
                        </button>
                      ) : null}
                      <label className="flex items-center gap-2 whitespace-nowrap text-xs font-bold text-slate-700">
                        <span>סיום</span>
                        <input
                          type="checkbox"
                          checked={done}
                          disabled={isSaving || !onChangeSubtaskStatus}
                          onChange={(event) =>
                            void handleToggleDone(
                              subtask,
                              event.currentTarget.checked,
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {shouldCollapseDoneSubtasks ? (
            <button
              type="button"
              className="w-full rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 ring-1 ring-emerald-100 transition hover:bg-emerald-100"
              onClick={() => setShowDoneSubtasks((current) => !current)}
            >
              {showDoneSubtasks
                ? "הסתר תתי־משימות שבוצעו"
                : `הצג ${doneSubtasks.length} תתי־משימות שבוצעו`}
            </button>
          ) : null}

          {canUseTaskActions ? (
            <div
              className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="hidden">
                <button
                  type="button"
                  className={`rounded-2xl px-3 py-2 text-xs font-black ring-1 transition ${isTextEditOpen ? "bg-sky-600 text-white ring-sky-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-sky-50 hover:text-sky-800"}`}
                  disabled={!onUpdateTaskText}
                  onClick={() => setIsTextEditOpen((c) => !c)}
                >
                  ✏ עריכה
                </button>
                <button
                  type="button"
                  className={`rounded-2xl px-3 py-2 text-xs font-black ring-1 transition ${isDetailsEditOpen ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-indigo-50 hover:text-indigo-700"}`}
                  disabled={!onUpdateTaskDetails}
                  onClick={() => setIsDetailsEditOpen((c) => !c)}
                >
                  ⚙ פרטים
                </button>
                <button
                  type="button"
                  className={`rounded-2xl px-3 py-2 text-xs font-black ring-1 transition ${isAddSubtaskOpen ? "bg-emerald-600 text-white ring-emerald-600" : "bg-emerald-50 text-emerald-700 ring-emerald-100 hover:bg-emerald-100"}`}
                  disabled={!onAddSubtaskToTask}
                  onClick={() => setIsAddSubtaskOpen((c) => !c)}
                >
                  + תת-משימה
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 ring-1 ring-amber-100 hover:bg-amber-100 transition"
                  disabled={!onAddReminder}
                  onClick={() => openReminderBubble({ type: "task", title: task.title })}
                >
                  {taskReminderLabel ? `🔔 ${taskReminderLabel}` : "🔔 תזכורת"}
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-orange-50 px-3 py-2 text-xs font-black text-orange-800 ring-1 ring-orange-100 hover:bg-orange-100 transition disabled:opacity-40"
                  disabled={!onOpenFocusTimer}
                  onClick={() => onOpenFocusTimer?.()}
                >
                  ⏱ טיימר
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800 ring-1 ring-cyan-100 hover:bg-cyan-100 transition disabled:opacity-40"
                  disabled={isSaving || !onAddTaskToFocus}
                  onClick={() => void handleAddTaskToFocus()}
                >
                  + פוקוס
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800 ring-1 ring-cyan-100 hover:bg-cyan-100 transition disabled:opacity-40"
                  disabled={!taskAiUrl}
                  onClick={() => openAiConversation(taskAiUrl)}
                >
                  AI
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 transition"
                  disabled={isSaving || !onMoveToTomorrow}
                  onClick={() => void handleMoveTomorrow()}
                >
                  ← מחר
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-800 ring-1 ring-sky-100 hover:bg-sky-100 transition disabled:opacity-40"
                  disabled={isSaving || !onChangeTaskDate || task.bucket === "today"}
                  onClick={() => void handleMoveToday()}
                >
                  היום
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-800 ring-1 ring-blue-100 hover:bg-blue-100 transition disabled:opacity-40"
                  disabled={isSaving || !onMoveToBacklogGroup}
                  onClick={() => void handleMoveBacklogGroup("this_week")}
                >
                  השבוע
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 ring-1 ring-amber-100 hover:bg-amber-100 transition disabled:opacity-40"
                  disabled={isSaving || !onMoveToBacklogGroup}
                  onClick={() => void handleMoveBacklogGroup("waiting")}
                >
                  ממתין
                </button>
                {cancelConfirm ? (
                  <div className="flex items-center gap-1.5 rounded-2xl bg-rose-50 px-3 py-2 ring-1 ring-rose-200">
                    <span className="text-xs font-black text-rose-700">בטוח?</span>
                    <button
                      type="button"
                      className="rounded-xl bg-rose-600 px-2.5 py-1 text-xs font-black text-white transition hover:bg-rose-700"
                      disabled={isSaving}
                      onClick={() => void handleCancelTask()}
                    >
                      כן
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-white px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
                      onClick={() => setCancelConfirm(false)}
                    >
                      לא
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="rounded-2xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 ring-1 ring-rose-100 hover:bg-rose-100 transition"
                    disabled={isSaving || !onCancelTask}
                    onClick={() => setCancelConfirm(true)}
                  >
                    בטל
                  </button>
                )}
              </div>

                  {isTextEditOpen ? (
                    <div className="grid gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                      <label className="field-compact">
                        <span>כותרת משימה</span>
                        <input
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                        />
                      </label>
                      <label className="field-compact">
                        <span>למה עכשיו?</span>
                        <input
                          value={editWhyNow}
                          onChange={(event) =>
                            setEditWhyNow(event.target.value)
                          }
                        />
                      </label>
                      <label className="field-compact">
                        <span>הערות</span>
                        <textarea
                          rows={3}
                          value={editNotes}
                          onChange={(event) => setEditNotes(event.target.value)}
                        />
                      </label>
                      <label className="field-compact">
                        <span>AI conversation link</span>
                        <input
                          className="ltr text-left"
                          value={editAiConversationUrl}
                          onChange={(event) => setEditAiConversationUrl(event.target.value)}
                          placeholder="https://chatgpt.com/c/... או https://claude.ai/chat/..."
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white"
                          disabled={isSaving || !onUpdateTaskText}
                          onClick={() => void handleSaveTaskText()}
                        >
                          שמור מלל
                        </button>
                        <button
                          type="button"
                          className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                          disabled={isSaving}
                          onClick={resetTaskTextEdit}
                        >
                          ביטול עריכה
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isDetailsEditOpen ? (
                    <div className="grid gap-3 rounded-2xl bg-white p-3 ring-1 ring-indigo-100">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="field-compact">
                          <span>פרויקט</span>
                          <select
                            value={editProjectId}
                            onChange={(event) =>
                              setEditProjectId(event.target.value)
                            }
                          >
                            {(settings?.projects ?? [])
                              .filter((project) => project.isActive)
                              .map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="field-compact">
                          <span>תחום</span>
                          <select
                            value={editDomainId}
                            onChange={(event) =>
                              setEditDomainId(event.target.value)
                            }
                          >
                            {(settings?.domains ?? [])
                              .filter((domain) => domain.isActive)
                              .map((domain) => (
                                <option key={domain.id} value={domain.id}>
                                  {domain.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="field-compact">
                          <span>עדיפות</span>
                          <select
                            value={editPriority}
                            onChange={(event) =>
                              setEditPriority(
                                event.target.value as Task["priority"],
                              )
                            }
                          >
                            <option value="high">{priorityLabels.high}</option>
                            <option value="medium">
                              {priorityLabels.medium}
                            </option>
                            <option value="low">{priorityLabels.low}</option>
                          </select>
                        </label>
                        <label className="field-compact">
                          <span>מאמץ</span>
                          <select
                            value={editEffort}
                            onChange={(event) =>
                              setEditEffort(
                                event.target.value as Task["effort"],
                              )
                            }
                          >
                            <option value="quick">{effortLabels.quick}</option>
                            <option value="medium">
                              {effortLabels.medium}
                            </option>
                            <option value="deep">{effortLabels.deep}</option>
                          </select>
                        </label>
                      </div>

                      <div className="field-compact">
                        <span>תגיות</span>
                        <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200">
                          {getEditableTagOptions(settings, editTags).map(
                            (tag) => (
                              <button
                                key={tag}
                                type="button"
                                className={getTagChipClass(
                                  editTags.includes(tag),
                                )}
                                onClick={() => toggleEditTag(tag)}
                              >
                                #{tag}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-2xl bg-indigo-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                          disabled={isSaving || !onUpdateTaskDetails}
                          onClick={() => void handleSaveTaskDetails()}
                        >
                          שמור פרטים
                        </button>
                        <button
                          type="button"
                          className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                          disabled={isSaving}
                          onClick={resetTaskDetailsEdit}
                        >
                          ביטול פרטים
                        </button>
                      </div>
                    </div>
                  ) : null}

                      {isAddSubtaskOpen ? (
                        <div className="grid gap-2 rounded-2xl bg-white p-3 ring-1 ring-emerald-100">
                          <label className="field-compact">
                            <span>תתי־משימות חדשות</span>
                            <textarea
                              rows={4}
                              value={newSubtaskTitle}
                              onChange={(event) =>
                                setNewSubtaskTitle(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) void handleAddSubtask();
                              }}
                              placeholder={"כל שורה תהיה תת־משימה נפרדת\nלמשל: לשלוח לג׳ק סיכום צבעים\nלוודא מחיר אריזה\nלקבל ETA"}
                            />
                          </label>
                      <label className="field-compact">
                        <span>הערות לתת־משימה</span>
                        <textarea
                          rows={2}
                          value={newSubtaskNotes}
                          onChange={(event) =>
                            setNewSubtaskNotes(event.target.value)
                          }
                        />
                      </label>
                      <label className="field-compact">
                        <span>AI conversation link</span>
                        <input
                          className="ltr text-left"
                          value={newSubtaskAiConversationUrl}
                          onChange={(event) => setNewSubtaskAiConversationUrl(event.target.value)}
                          placeholder={taskAiUrl ? "ריק = משתמש בקישור של משימת העל" : "https://chatgpt.com/c/..."}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                          disabled={
                            isSaving ||
                            !onAddSubtaskToTask ||
                            pendingSubtaskTitles.length === 0
                          }
                          onClick={() => void handleAddSubtask()}
                        >
                          {pendingSubtaskTitles.length > 1
                            ? `הוסף ${pendingSubtaskTitles.length} תתי־משימות`
                            : "הוסף תת־משימה"}
                        </button>
                        <button
                          type="button"
                          className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                          disabled={isSaving}
                          onClick={() => {
                            setNewSubtaskTitle("");
                            setNewSubtaskNotes("");
                            setNewSubtaskAiConversationUrl("");
                            setIsAddSubtaskOpen(false);
                          }}
                        >
                          ביטול
                        </button>
                      </div>
                    </div>
                  ) : null}

{/* reminder form moved to overlay below */}

                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <label className="field-compact min-w-[190px]">
                      <span>שינוי תאריך</span>
                      <input
                        type="date"
                        value={targetDate}
                        onChange={(event) => setTargetDate(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                      disabled={isSaving || !onChangeTaskDate}
                      onClick={() => void handleChangeDate()}
                    >
                      שנה תאריך
                    </button>
                  </div>
              {actionError ? (
                <p className="mt-2 text-xs font-bold text-rose-700">
                  {actionError}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="text-xs text-slate-400">
            אפשר לסמן ולבטל התחלה/סיום. ביטול התחלה מאפס גם סיום; ביטול סיום
            מחזיר ל־Started.
          </p>
        </div>
      ) : null}

      {/* ── Reminder overlay — appears on top regardless of card state ── */}
      {reminderTarget ? (
        <div
          className="fixed inset-x-0 top-0 h-dvh z-[65] flex items-end sm:items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"
          onClick={() => setReminderTarget(null)}
        >
          <div
            className="w-full max-w-sm overflow-y-auto max-h-[85dvh] rounded-t-[2rem] sm:rounded-[2rem] bg-white p-5 shadow-2xl ring-2 ring-amber-200"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-black text-amber-700">
              🔔 תזכורת ל{reminderTarget.type === "task" ? "משימה" : "תת־משימה"}
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-slate-400 truncate">
              {reminderTarget.title}
            </p>

            <div className="mt-4 grid gap-3">
              <label className="field-compact">
                <span>כותרת התזכורת</span>
                <input
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder={reminderTarget.title}
                />
              </label>
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <label className="field-compact">
                  <span>תאריך</span>
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                  />
                </label>
                <label className="field-compact">
                  <span>שעה</span>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "בוקר", value: "09:00" },
                  { label: "צהריים", value: "13:00" },
                  { label: "ערב", value: "18:00" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-2xl px-3 py-1.5 text-xs font-black ring-1 ${
                      reminderTime === option.value
                        ? "bg-slate-950 text-white ring-slate-950"
                        : "bg-white text-slate-700 ring-slate-200"
                    }`}
                    onClick={() => setReminderTime(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-2xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700"
                  onClick={() => setReminderDate(getLocalISODate())}
                >
                  היום
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700"
                  onClick={() => setReminderDate(getLocalISODate(1))}
                >
                  מחר
                </button>
              </div>

              <label className="field-compact">
                <span>הערה (אופציונלי)</span>
                <input
                  value={reminderNote}
                  onChange={(e) => setReminderNote(e.target.value)}
                  placeholder="להתקשר אחרי 16:00..."
                />
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 rounded-2xl bg-amber-500 py-2.5 text-sm font-black text-white shadow-sm"
                  disabled={isSaving || !onAddReminder}
                  onClick={() => void handleSaveReminder()}
                >
                  שמור תזכורת
                </button>
                <button
                  type="button"
                  className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700"
                  onClick={() => setReminderTarget(null)}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
