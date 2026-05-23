import { useEffect, useRef, useState } from "react";
import type { Reminder } from "../../domain/reminders/reminderTypes";
import type { AppSettings } from "../../domain/settings/settingsTypes";
import type {
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
  onMoveToTomorrow?: (task: Task) => Promise<void> | void;
  onChangeTaskDate?: (task: Task, targetDate: string) => Promise<void> | void;
  onCancelTask?: (taskId: string) => Promise<void> | void;
  onUpdateTaskText?: (
    taskId: string,
    patch: { title?: string; whyNow?: string; notes?: string },
  ) => Promise<void> | void;
  onUpdateSubtaskText?: (
    subtaskId: string,
    patch: { title?: string; notes?: string },
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
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
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
  onMoveToTomorrow,
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
}: ReadOnlyTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [targetDate, setTargetDate] = useState(task.date ?? "");
  const [actionError, setActionError] = useState("");
  const [isTextEditOpen, setIsTextEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editWhyNow, setEditWhyNow] = useState(task.whyNow ?? "");
  const [editNotes, setEditNotes] = useState(task.notes ?? "");
  const [isAddSubtaskOpen, setIsAddSubtaskOpen] = useState(false);
  const [isDetailsEditOpen, setIsDetailsEditOpen] = useState(false);
  const [editProjectId, setEditProjectId] = useState(task.projectId);
  const [editDomainId, setEditDomainId] = useState(task.domainId);
  const [editPriority, setEditPriority] = useState<Task["priority"]>(
    task.priority,
  );
  const [editEffort, setEditEffort] = useState<Task["effort"]>(task.effort);
  const [editTags, setEditTags] = useState<string[]>(task.tags);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskNotes, setNewSubtaskNotes] = useState("");
  const [editedSubtaskTitles, setEditedSubtaskTitles] = useState<Record<string, string>>({});
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
  const progress = getTaskProgress(task, subtasks);
  const taskReminder = getFirstPendingReminder(reminders, task.id, null);
  const taskReminderLabel = formatShortReminder(taskReminder);
  const isDone = progress.status === "done";
  const isMutedDone = isCompletedArchived && isDone;
  const canUseTaskActions = Boolean(
    onMoveToTomorrow ||
    onChangeTaskDate ||
    onCancelTask ||
    onUpdateTaskText ||
    onUpdateTaskDetails ||
    onAddSubtaskToTask ||
    onAddReminder,
  );

  useEffect(() => {
    setEditTitle(task.title);
    setEditWhyNow(task.whyNow ?? "");
    setEditNotes(task.notes ?? "");
    setEditProjectId(task.projectId);
    setEditDomainId(task.domainId);
    setEditPriority(task.priority);
    setEditEffort(task.effort);
    setEditTags(task.tags);
    setTargetDate(task.date ?? "");
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
    if (!onChangeSubtaskStatus) return;
    setActionError("");
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
    });
    setIsTextEditOpen(false);
  };

  const resetTaskTextEdit = () => {
    setEditTitle(task.title);
    setEditWhyNow(task.whyNow ?? "");
    setEditNotes(task.notes ?? "");
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
    if (nextTitle === subtask.title) return;
    setActionError("");
    await onUpdateSubtaskText(subtask.id, { title: nextTitle });
    setEditedSubtaskTitles((current) => {
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

  const handleAddSubtask = async () => {
    if (!onAddSubtaskToTask) return;
    const title = newSubtaskTitle.trim();
    if (!title) {
      setActionError("כתוב שם לתת־משימה לפני שמירה.");
      return;
    }
    setActionError("");
    await onAddSubtaskToTask({
      taskId: task.id,
      title,
      notes: newSubtaskNotes,
    });
    setNewSubtaskTitle("");
    setNewSubtaskNotes("");
    setIsAddSubtaskOpen(false);
  };

  const handleMoveTomorrow = async () => {
    if (!onMoveToTomorrow) return;
    setActionError("");
    await onMoveToTomorrow(task);
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
      className={`rounded-2xl border p-4 shadow-sm transition hover:shadow-soft ${
        isFocused
          ? "border-cyan-300 bg-cyan-50/60 ring-4 ring-cyan-100"
          : isMutedDone
            ? "border-emerald-100 bg-emerald-50/60 opacity-80"
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
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-sky-50 px-2 py-1 font-bold text-sky-700 ring-1 ring-sky-100">
                {task.scheduledTimeLabel ?? "ללא שעה"}
              </span>
              <span>{projectName ?? task.projectId}</span>
              <span>•</span>
              <span>{domainName ?? task.domainId}</span>
              {task.durationLabel ? <span>• {task.durationLabel}</span> : null}
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
            <div className="mt-2 flex items-center gap-2">
              <span className="text-lg font-black text-slate-950">
                {isExpanded ? "▾" : "▸"}
              </span>
              <h3
                className={`truncate text-lg font-black ${isMutedDone ? "text-slate-500 line-through" : "text-slate-950"}`}
              >
                {task.title}
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
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
            <span
              className={`rounded-full px-2 py-1 font-bold ring-1 ${getStatusBadgeClass(progress)}`}
            >
              {progress.startedCount > 0 &&
              progress.percent === 0 &&
              progress.status !== "done"
                ? "התחיל · 0%"
                : statusLabels[progress.status]}
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-1 font-bold text-amber-700 ring-1 ring-amber-100">
              {priorityLabels[task.priority]}
            </span>
            <span className="rounded-full bg-fuchsia-50 px-2 py-1 font-bold text-fuchsia-700 ring-1 ring-fuchsia-100">
              {effortLabels[task.effort]}
            </span>
            {onChangeSubtaskStatus ? (
              <label
                className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-emerald-50 hover:text-emerald-800 hover:ring-emerald-100"
                onClick={(event) => event.stopPropagation()}
                title="סמן סוף משימה"
              >
                <span>סוף</span>
                <input
                  type="checkbox"
                  checked={isDone}
                  disabled={isSaving || taskSubtasks.length === 0}
                  onChange={(event) =>
                    void handleToggleTaskDone(event.currentTarget.checked)
                  }
                />
              </label>
            ) : null}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs font-bold text-slate-500">
            <span>
              {progress.doneCount}/{progress.totalCount} תתי־משימות הושלמו
              {progress.startedCount > 0 && progress.doneCount === 0
                ? " · התחלת להתעסק בזה"
                : ""}
            </span>
            <span>{progress.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
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
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          {task.whyNow ? (
            <p className="rounded-2xl bg-sky-50 px-3 py-2 text-sm text-slate-700">
              {task.whyNow}
            </p>
          ) : null}
          {task.notes ? (
            <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {task.notes}
            </p>
          ) : null}

          <ul className="space-y-2">
            {taskSubtasks.map((subtask) => {
              const started = isSubtaskStarted(subtask);
              const done = isSubtaskDone(subtask);
              const subtaskReminder = getFirstPendingReminder(
                reminders,
                task.id,
                subtask.id,
              );
              const subtaskReminderLabel = formatShortReminder(subtaskReminder);

              return (
                <li
                  key={subtask.id}
                  className="rounded-xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200"
                >
                  <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                    <label className="flex items-center gap-2 whitespace-nowrap text-xs font-bold text-slate-700">
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
                          className={`min-h-10 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 ${done ? "text-slate-500 line-through" : ""}`}
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
                        (editedSubtaskTitles[subtask.id] ?? subtask.title) !== subtask.title ? (
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
                      <p className="mt-1 text-xs text-slate-500">
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
                        <p className="mt-1 text-xs text-slate-500">
                          {subtask.notes}
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

          {canUseTaskActions ? (
            <div
              className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-wrap gap-2">
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
                  className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 transition"
                  disabled={isSaving || !onMoveToTomorrow}
                  onClick={() => void handleMoveTomorrow()}
                >
                  ← מחר
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
                        <span>תת־משימה חדשה</span>
                        <input
                          value={newSubtaskTitle}
                          onChange={(event) =>
                            setNewSubtaskTitle(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void handleAddSubtask();
                          }}
                          placeholder="למשל: לשלוח לג׳ק סיכום צבעים"
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
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                          disabled={
                            isSaving ||
                            !onAddSubtaskToTask ||
                            !newSubtaskTitle.trim()
                          }
                          onClick={() => void handleAddSubtask()}
                        >
                          הוסף תת־משימה
                        </button>
                        <button
                          type="button"
                          className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                          disabled={isSaving}
                          onClick={() => {
                            setNewSubtaskTitle("");
                            setNewSubtaskNotes("");
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
