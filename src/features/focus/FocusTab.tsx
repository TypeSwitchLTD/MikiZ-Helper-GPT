import { useMemo } from "react";
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
}

function formatTimer(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const rest = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function getTaskLabel(task: Task | undefined): string {
  if (!task) return "המשימה לא נמצאה";
  return [task.projectId, task.domainId].filter(Boolean).join(" · ") || "משימה";
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
}: FocusTabProps) {
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const subtaskById = useMemo(() => new Map(subtasks.map((subtask) => [subtask.id, subtask])), [subtasks]);
  const activeItems = useMemo(
    () =>
      focusItems
        .filter((item) => !item.deletedAt && !item.completedAt)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.addedAt.localeCompare(b.addedAt)),
    [focusItems],
  );

  const openTaskCount = activeItems.filter((item) => item.targetType === "task").length;
  const openSubtaskCount = activeItems.filter((item) => item.targetType === "subtask").length;

  return (
    <div dir="rtl" className="space-y-3">
      <section className="rounded-3xl bg-slate-950 p-4 text-white shadow-soft sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-black text-cyan-200">Focus deck</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">פוקוס נקי</h2>
            <p className="mt-2 max-w-2xl text-sm font-bold text-slate-300">
              עד 6 פריטים שבחרת. בלי רעש, בלי בקלוג, רק מה שנכנס לרגע העבודה הנוכחי.
            </p>
          </div>

          <div className="rounded-3xl bg-white/10 p-3 ring-1 ring-white/15">
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                className={`rounded-2xl px-4 py-2 text-sm font-black shadow-sm transition ${
                  focusRunning
                    ? "bg-rose-500 text-white hover:bg-rose-600"
                    : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                }`}
                onClick={focusRunning ? onStopTimer : onStartTimer}
              >
                {focusRunning ? "עצור" : "התחל"}
              </button>
              <button
                type="button"
                className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white ring-1 ring-white/15"
                onClick={onOpenTimer}
              >
                טיימר
              </button>
              <p className="min-w-[5.5rem] text-left text-3xl font-black tabular-nums">{formatTimer(focusSeconds)}</p>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[10, 20, 30].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className="rounded-xl bg-white/10 px-2 py-1.5 text-xs font-black text-slate-100 ring-1 ring-white/10"
                  onClick={() => onSetTimerMinutes(minutes)}
                >
                  {minutes}
                </button>
              ))}
              <button
                type="button"
                className="rounded-xl bg-white/10 px-2 py-1.5 text-xs font-black text-slate-100 ring-1 ring-white/10"
                onClick={onResetTimer}
              >
                איפוס
              </button>
            </div>
          </div>
        </div>
      </section>

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

      {activeItems.length === 0 ? (
        <section className="rounded-3xl bg-white p-5 text-center shadow-soft ring-1 ring-sky-100">
          <p className="text-xl font-black text-slate-950">אין עדיין פריטים בפוקוס.</p>
          <p className="mt-2 text-sm font-bold text-slate-500">
            עבור ללשונית משימות ולחץ “+ פוקוס” על משימת על או תת־משימה.
          </p>
        </section>
      ) : (
        <section className="grid max-h-[calc(100dvh-19rem)] gap-3 overflow-y-auto pr-0.5 sm:grid-cols-2">
          {activeItems.map((item, index) => {
            const task = taskById.get(item.taskId);
            const subtask = item.subtaskId ? subtaskById.get(item.subtaskId) : undefined;
            const isSubtask = item.targetType === "subtask";
            const title = isSubtask ? subtask?.title ?? item.titleSnapshot : task?.title ?? item.titleSnapshot;
            const parentTitle = isSubtask ? task?.title ?? item.parentTitleSnapshot : null;
            const progress = task ? getTaskProgress(task, subtasks) : null;
            const childSubtasks = !isSubtask && task
              ? subtasks
                  .filter((candidate) => candidate.taskId === task.id && !candidate.deletedAt && candidate.status !== "cancelled")
                  .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                  .slice(0, 6)
              : [];
            return (
              <article
                key={item.id}
                className="min-h-[13.5rem] rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100 transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-white">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <p className="text-[11px] font-black text-cyan-700">
                      {isSubtask ? "תת־משימה" : getTaskLabel(task)}
                    </p>
                    <h3 className="mt-1 mobile-clamp-3 text-lg font-black leading-tight text-slate-950">
                      <LinkifiedText text={title} />
                    </h3>
                    {parentTitle ? (
                      <p className="mt-2 truncate text-xs font-bold text-slate-500">{parentTitle}</p>
                    ) : null}
                  </div>
                </div>

                {progress ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] font-black text-slate-500">
                      <span>{progress.percent}%</span>
                      <span>{progress.doneCount}/{progress.totalCount || 1}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-cyan-400"
                        style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {childSubtasks.length > 0 ? (
                  <div className="mt-4 space-y-1.5 rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
                    {childSubtasks.map((child) => (
                      <div key={child.id} className="flex items-start gap-2 text-right text-xs font-bold text-slate-700">
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${child.status === "done" ? "bg-emerald-400" : child.status === "started" ? "bg-cyan-400" : "bg-slate-300"}`} />
                        <span className={child.status === "done" ? "line-through decoration-rose-400 text-slate-400" : ""}>
                          {child.title}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-3 gap-2">
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
                    className="rounded-2xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-800 ring-1 ring-sky-100"
                    onClick={() => onJumpToTask(item.taskId)}
                  >
                    פתח
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
          })}
        </section>
      )}
    </div>
  );
}
