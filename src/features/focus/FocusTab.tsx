import { useEffect, useMemo, useRef, useState } from "react";
import { LinkifiedText } from "../../components/ui/LinkifiedText";
import type { FocusItem } from "../../domain/focus/focusTypes";
import { MAX_FOCUS_ITEMS } from "../../domain/focus/focusMutations";
import { getTaskProgress } from "../../domain/tasks/taskProgress";
import type { Subtask, Task } from "../../domain/tasks/taskTypes";

interface FocusTabProps {
  focusItems: FocusItem[];
  tasks: Task[];
  subtasks: Subtask[];
  focusSeconds: number;
  focusRunning: boolean;
  isSaving?: boolean;
  onStartTimer: () => void;
  onStopTimer: () => void;
  onResetTimer: () => void;
  onSetTimerMinutes: (minutes: number) => void;
  onOpenTimer: () => void;
  onCompleteFocusItem: (focusItemId: string) => Promise<void> | void;
  onRemoveFocusItem: (focusItemId: string) => Promise<void> | void;
  onClearFocus: () => Promise<void> | void;
  onJumpToTask: (taskId: string) => void;
  onUpdateFocusProgress: (focusItemId: string, progressPercent: number) => Promise<void> | void;
  onAddFocusTime: (focusItemId: string, seconds: number) => Promise<void> | void;
}

function formatTimer(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const rest = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function formatSpent(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) return `${hours}ש ${minutes}ד`;
  if (minutes > 0) return `${minutes}ד`;
  return `${safeSeconds}ש`;
}

function getTaskLabel(task: Task | undefined): string {
  if (!task) return "משימה לא נמצאה";
  return [task.projectId, task.domainId].filter(Boolean).join(" · ") || "משימה";
}

function getItemTitle(item: FocusItem, task: Task | undefined, subtask: Subtask | undefined): string {
  if (item.targetType === "subtask") return subtask?.title ?? item.titleSnapshot;
  return task?.title ?? item.titleSnapshot;
}

export function FocusTab({
  focusItems,
  tasks,
  subtasks,
  focusSeconds,
  focusRunning,
  isSaving,
  onStartTimer,
  onStopTimer,
  onResetTimer,
  onSetTimerMinutes,
  onOpenTimer,
  onCompleteFocusItem,
  onRemoveFocusItem,
  onClearFocus,
  onJumpToTask,
  onUpdateFocusProgress,
  onAddFocusTime,
}: FocusTabProps) {
  const [hyperFocusItemId, setHyperFocusItemId] = useState<string | null>(null);
  const [runningItemId, setRunningItemId] = useState<string | null>(null);
  const [runningStartedAtMs, setRunningStartedAtMs] = useState<number | null>(null);
  const [elapsedPreviewSeconds, setElapsedPreviewSeconds] = useState(0);
  const [progressDrafts, setProgressDrafts] = useState<Record<string, number>>({});
  const runningRef = useRef<{ itemId: string | null; startedAtMs: number | null }>({ itemId: null, startedAtMs: null });

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const subtaskById = useMemo(() => new Map(subtasks.map((subtask) => [subtask.id, subtask])), [subtasks]);
  const activeItems = useMemo(
    () =>
      focusItems
        .filter((item) => !item.deletedAt && !item.completedAt)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.addedAt.localeCompare(b.addedAt)),
    [focusItems],
  );

  const hyperFocusItem = activeItems.find((item) => item.id === hyperFocusItemId) ?? null;
  const visibleItems = hyperFocusItem ? [hyperFocusItem] : activeItems;
  const openTaskCount = activeItems.filter((item) => item.targetType === "task").length;
  const openSubtaskCount = activeItems.filter((item) => item.targetType === "subtask").length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const focusReportItems = useMemo(
    () =>
      focusItems
        .filter((item) => !item.deletedAt)
        .filter((item) => (item.updatedAt || item.addedAt).slice(0, 10) === todayKey)
        .filter((item) => (item.focusTimeSpentSeconds ?? 0) > 0 || (item.manualProgressPercent ?? 0) > 0),
    [focusItems, todayKey],
  );
  const focusReportSeconds = focusReportItems.reduce((sum, item) => sum + (item.focusTimeSpentSeconds ?? 0), 0);
  const focusReportAverageProgress = focusReportItems.length
    ? Math.round(focusReportItems.reduce((sum, item) => sum + (item.manualProgressPercent ?? 0), 0) / focusReportItems.length)
    : 0;
  const topFocusReportItems = [...focusReportItems]
    .sort((a, b) => (b.focusTimeSpentSeconds ?? 0) - (a.focusTimeSpentSeconds ?? 0))
    .slice(0, 3);

  useEffect(() => {
    runningRef.current = { itemId: runningItemId, startedAtMs: runningStartedAtMs };
  }, [runningItemId, runningStartedAtMs]);

  useEffect(() => {
    if (!runningItemId || !runningStartedAtMs) {
      setElapsedPreviewSeconds(0);
      return;
    }
    const tick = () => setElapsedPreviewSeconds(Math.max(0, Math.floor((Date.now() - runningStartedAtMs) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [runningItemId, runningStartedAtMs]);

  useEffect(() => {
    if (hyperFocusItemId && !activeItems.some((item) => item.id === hyperFocusItemId)) {
      setHyperFocusItemId(null);
    }
  }, [activeItems, hyperFocusItemId]);

  useEffect(() => {
    const flushRunningTime = (clearState = false) => {
      const current = runningRef.current;
      if (!current.itemId || !current.startedAtMs) return;
      const delta = Math.max(1, Math.floor((Date.now() - current.startedAtMs) / 1000));
      runningRef.current = { itemId: null, startedAtMs: null };
      if (clearState) {
        setRunningItemId(null);
        setRunningStartedAtMs(null);
      }
      void onAddFocusTime(current.itemId, delta);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushRunningTime(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      flushRunningTime();
    };
  }, [onAddFocusTime]);

  const stopItemTimer = async () => {
    if (!runningItemId || !runningStartedAtMs) return;
    const delta = Math.max(1, Math.floor((Date.now() - runningStartedAtMs) / 1000));
    const itemId = runningItemId;
    setRunningItemId(null);
    setRunningStartedAtMs(null);
    runningRef.current = { itemId: null, startedAtMs: null };
    await onAddFocusTime(itemId, delta);
  };

  const toggleItemTimer = async (itemId: string) => {
    if (runningItemId === itemId) {
      await stopItemTimer();
      return;
    }
    await stopItemTimer();
    setRunningItemId(itemId);
    setRunningStartedAtMs(Date.now());
  };

  const commitProgressDraft = (itemId: string, fallback: number) => {
    const nextProgress = progressDrafts[itemId] ?? fallback;
    void onUpdateFocusProgress(itemId, nextProgress);
    setProgressDrafts((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  };

  const renderFocusCard = (item: FocusItem, index: number) => {
    const task = taskById.get(item.taskId);
    const subtask = item.subtaskId ? subtaskById.get(item.subtaskId) : undefined;
    const isSubtask = item.targetType === "subtask";
    const title = getItemTitle(item, task, subtask);
    const parentTitle = isSubtask ? task?.title ?? item.parentTitleSnapshot : null;
    const taskProgress = task ? getTaskProgress(task, subtasks) : null;
    const savedManualProgress = Math.max(0, Math.min(100, item.manualProgressPercent ?? 0));
    const manualProgress = progressDrafts[item.id] ?? savedManualProgress;
    const spentSeconds = (item.focusTimeSpentSeconds ?? 0) + (runningItemId === item.id ? elapsedPreviewSeconds : 0);
    const childSubtasks = !isSubtask && task
      ? subtasks
          .filter((candidate) => candidate.taskId === task.id && !candidate.deletedAt && candidate.status !== "cancelled")
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      : [];

    return (
      <article
        key={item.id}
        className={`rounded-3xl bg-white p-4 shadow-sm ring-1 transition ${
          hyperFocusItem ? "min-h-[calc(100dvh-14rem)] ring-emerald-200" : "min-h-[13.5rem] ring-sky-100 hover:-translate-y-0.5 hover:shadow-soft"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-white">
            {index + 1}
          </div>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-[11px] font-black text-cyan-700">
              {isSubtask ? "תת־משימה" : getTaskLabel(task)}
            </p>
            <h3 className={`${hyperFocusItem ? "text-2xl sm:text-4xl" : "mobile-clamp-3 text-lg"} mt-1 font-black leading-tight text-slate-950`}>
              <LinkifiedText text={title} />
            </h3>
            {parentTitle ? <p className="mt-2 truncate text-xs font-bold text-slate-500">{parentTitle}</p> : null}
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <div className="flex items-center justify-between text-[11px] font-black text-slate-500">
            <span>התקדמות ידנית</span>
            <span>{manualProgress}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={manualProgress}
            className="mt-2 w-full accent-emerald-500"
            disabled={isSaving}
            onChange={(event) => setProgressDrafts((current) => ({ ...current, [item.id]: Number(event.currentTarget.value) }))}
            onPointerUp={() => commitProgressDraft(item.id, savedManualProgress)}
            onBlur={() => commitProgressDraft(item.id, savedManualProgress)}
            onKeyUp={(event) => {
              if (event.key === "Enter" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
                commitProgressDraft(item.id, savedManualProgress);
              }
            }}
          />
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-cyan-400" style={{ width: `${manualProgress}%` }} />
          </div>
        </div>

        {taskProgress ? (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] font-black text-slate-500">
              <span>התקדמות משימה בפועל</span>
              <span>{taskProgress.percent}% · {taskProgress.doneCount}/{taskProgress.totalCount || 1}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-l from-sky-400 to-cyan-300"
                style={{ width: `${Math.max(0, Math.min(100, taskProgress.percent))}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            className={`rounded-2xl px-3 py-2 text-xs font-black ring-1 ${
              runningItemId === item.id ? "bg-rose-500 text-white ring-rose-500" : "bg-emerald-50 text-emerald-800 ring-emerald-100"
            }`}
            onClick={() => void toggleItemTimer(item.id)}
          >
            {runningItemId === item.id ? `עצור ${formatTimer(elapsedPreviewSeconds)}` : "התחל משימה"}
          </button>
          <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center text-xs font-black text-slate-700 ring-1 ring-slate-100">
            {formatSpent(spentSeconds)}
          </div>
          {hyperFocusItem ? (
            <button type="button" className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200" onClick={() => setHyperFocusItemId(null)}>
              צא מהיפר
            </button>
          ) : (
            <button type="button" className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white" onClick={() => setHyperFocusItemId(item.id)}>
              היפר־פוקוס
            </button>
          )}
          <button type="button" className="rounded-2xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-800 ring-1 ring-sky-100" onClick={() => onJumpToTask(item.taskId)}>
            פתח מקור
          </button>
        </div>

        {childSubtasks.length > 0 ? (
          <div className={`${hyperFocusItem ? "mt-5 grid gap-2" : "mt-4 space-y-1.5"} rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-100`}>
            {childSubtasks.map((child) => (
              <div key={child.id} className="flex items-start gap-2 text-right text-sm font-bold text-slate-700">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${child.status === "done" ? "bg-emerald-400" : child.status === "started" ? "bg-cyan-400" : "bg-slate-300"}`} />
                <span className={child.status === "done" ? "line-through decoration-rose-400 text-slate-400" : ""}>
                  <LinkifiedText text={child.title} />
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
            disabled={isSaving}
            onClick={() => void onCompleteFocusItem(item.id)}
          >
            סיימתי
          </button>
          <button
            type="button"
            className="rounded-2xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 ring-1 ring-rose-100 disabled:opacity-50"
            disabled={isSaving}
            onClick={() => void onRemoveFocusItem(item.id)}
          >
            הוצא
          </button>
        </div>
      </article>
    );
  };

  return (
    <div dir="rtl" className="space-y-3">
      <section className={`rounded-3xl bg-slate-950 p-4 text-white shadow-soft sm:p-5 ${hyperFocusItem ? "sticky top-2 z-20" : ""}`}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-black text-cyan-200">{hyperFocusItem ? "Hyper focus" : "Focus deck"}</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">
              {hyperFocusItem ? "היפר־פוקוס" : "פוקוס נקי"}
            </h2>
            {!hyperFocusItem ? (
              <p className="mt-2 max-w-2xl text-sm font-bold text-slate-300">
                עד 6 פריטים שבחרת. במסך רגיל רואים ארבעה, ובהיפר־פוקוס רואים רק את מה שעובדים עליו עכשיו.
              </p>
            ) : null}
          </div>

          <div className="rounded-3xl bg-white/10 p-3 ring-1 ring-white/15">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className={`rounded-2xl px-4 py-2 text-sm font-black shadow-sm transition ${
                  focusRunning ? "bg-rose-500 text-white hover:bg-rose-600" : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                }`}
                onClick={focusRunning ? onStopTimer : onStartTimer}
              >
                {focusRunning ? "עצור" : "התחל"}
              </button>
              <button type="button" className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white ring-1 ring-white/15" onClick={onOpenTimer}>
                טיימר
              </button>
              <p className="min-w-[5.5rem] text-left text-3xl font-black tabular-nums">{formatTimer(focusSeconds)}</p>
            </div>
            {!hyperFocusItem ? (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[10, 20, 30].map((minutes) => (
                  <button key={minutes} type="button" className="rounded-xl bg-white/10 px-2 py-1.5 text-xs font-black text-slate-100 ring-1 ring-white/10" onClick={() => onSetTimerMinutes(minutes)}>
                    {minutes}
                  </button>
                ))}
                <button type="button" className="rounded-xl bg-white/10 px-2 py-1.5 text-xs font-black text-slate-100 ring-1 ring-white/10" onClick={onResetTimer}>
                  איפוס
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {!hyperFocusItem ? (
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-emerald-100 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-xs font-black text-emerald-700">דוח פוקוס יומי</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">מה באמת התקדם היום</h3>
              <p className="mt-1 text-sm font-bold text-slate-500">
                זמן העבודה והאחוזים כאן הם שכבת פוקוס נפרדת. הם לא מסמנים משימה כבוצעה.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-emerald-50 px-3 py-3 ring-1 ring-emerald-100">
                <p className="text-[11px] font-black text-emerald-700">זמן</p>
                <p className="mt-1 text-lg font-black text-emerald-950">{formatSpent(focusReportSeconds)}</p>
              </div>
              <div className="rounded-2xl bg-cyan-50 px-3 py-3 ring-1 ring-cyan-100">
                <p className="text-[11px] font-black text-cyan-700">פריטים</p>
                <p className="mt-1 text-lg font-black text-cyan-950">{focusReportItems.length}</p>
              </div>
              <div className="rounded-2xl bg-sky-50 px-3 py-3 ring-1 ring-sky-100">
                <p className="text-[11px] font-black text-sky-700">ממוצע</p>
                <p className="mt-1 text-lg font-black text-sky-950">{focusReportAverageProgress}%</p>
              </div>
            </div>
          </div>
          {topFocusReportItems.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {topFocusReportItems.map((item) => {
                const task = taskById.get(item.taskId);
                const subtask = item.subtaskId ? subtaskById.get(item.subtaskId) : undefined;
                return (
                  <div key={item.id} className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                    <p className="mobile-clamp-2 text-xs font-black text-slate-800">
                      <LinkifiedText text={getItemTitle(item, task, subtask)} />
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">
                      {formatSpent(item.focusTimeSpentSeconds ?? 0)} · {item.manualProgressPercent ?? 0}%
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {!hyperFocusItem ? (
        <section className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
          <div className="rounded-2xl bg-white px-3 py-3 text-center shadow-sm ring-1 ring-sky-100">
            <p className="text-[11px] font-black text-slate-500">בפוקוס</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{activeItems.length}/{MAX_FOCUS_ITEMS}</p>
          </div>
          <div className="rounded-2xl bg-white px-3 py-3 text-center shadow-sm ring-1 ring-emerald-100">
            <p className="text-[11px] font-black text-slate-500">משימות</p>
            <p className="mt-1 text-2xl font-black text-emerald-800">{openTaskCount}</p>
          </div>
          <div className="rounded-2xl bg-white px-3 py-3 text-center shadow-sm ring-1 ring-cyan-100">
            <p className="text-[11px] font-black text-slate-500">תתי־משימות</p>
            <p className="mt-1 text-2xl font-black text-cyan-800">{openSubtaskCount}</p>
          </div>
          <button
            type="button"
            className="col-span-3 rounded-2xl bg-white px-3 py-3 text-center text-xs font-black text-rose-700 shadow-sm ring-1 ring-rose-100 transition hover:bg-rose-50 sm:col-span-1"
            disabled={isSaving || activeItems.length === 0}
            onClick={() => void onClearFocus()}
          >
            נקה פוקוס
          </button>
        </section>
      ) : null}

      {activeItems.length === 0 ? (
        <section className="rounded-3xl bg-white p-5 text-center shadow-soft ring-1 ring-sky-100">
          <p className="text-xl font-black text-slate-950">אין עדיין פריטים בפוקוס.</p>
          <p className="mt-2 text-sm font-bold text-slate-500">עבור ללשונית משימות ולחץ + פוקוס על משימת על או תת־משימה.</p>
        </section>
      ) : (
        <section className={hyperFocusItem ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
          {visibleItems.map((item, index) => renderFocusCard(item, index))}
        </section>
      )}
    </div>
  );
}
