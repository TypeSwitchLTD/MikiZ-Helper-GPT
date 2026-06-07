import { useMemo, useState } from "react";
import { LinkifiedText } from "../../components/ui/LinkifiedText";
import type { AppSettings } from "../../domain/settings/settingsTypes";
import { getTaskProgress } from "../../domain/tasks/taskProgress";
import type { Subtask, Task } from "../../domain/tasks/taskTypes";

interface ProcessesTabProps {
  tasks: Task[];
  subtasks: Subtask[];
  settings: AppSettings | null;
  isSaving?: boolean;
  onAddSubtaskToTask: (input: {
    taskId: string;
    title: string;
    notes?: string;
    aiConversationUrl?: string | null;
  }) => Promise<void> | void;
  onChangeSubtaskStatus: (subtaskId: string, status: Subtask["status"]) => Promise<void> | void;
  onAddSubtaskToFocus?: (taskId: string, subtaskId: string) => Promise<void> | void;
  onJumpToTask: (taskId: string) => void;
}

function isProcessTask(task: Task, taskSubtasks: Subtask[]): boolean {
  const tags = (task.tags ?? []).map((tag) => tag.toLowerCase());
  return (
    tags.some((tag) => ["process", "long", "project", "תהליך"].includes(tag)) ||
    taskSubtasks.filter((subtask) => !subtask.deletedAt && subtask.status !== "cancelled").length >= 4 ||
    (task.effort === "deep" && taskSubtasks.length >= 2)
  );
}

function getProjectName(settings: AppSettings | null, task: Task): string {
  return settings?.projects.find((project) => project.id === task.projectId)?.name ?? task.projectId ?? "";
}

function getDomainName(settings: AppSettings | null, task: Task): string {
  return settings?.domains.find((domain) => domain.id === task.domainId)?.name ?? task.domainId ?? "";
}

function sortSubtasks(a: Subtask, b: Subtask): number {
  return (a.sortOrder || 0) - (b.sortOrder || 0) || a.title.localeCompare(b.title);
}

function getNextSubtask(subtasks: Subtask[]): Subtask | null {
  return (
    subtasks.find((subtask) => subtask.status === "started") ??
    subtasks.find((subtask) => subtask.status === "not_started") ??
    null
  );
}

export function ProcessesTab({
  tasks,
  subtasks,
  settings,
  isSaving,
  onAddSubtaskToTask,
  onChangeSubtaskStatus,
  onAddSubtaskToFocus,
  onJumpToTask,
}: ProcessesTabProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [expandedDone, setExpandedDone] = useState<Record<string, boolean>>({});
  const [actionStatus, setActionStatus] = useState("");

  const processes = useMemo(() => {
    return tasks
      .filter((task) => !task.deletedAt && task.statusOverride !== "cancelled")
      .map((task) => {
        const taskSubtasks = subtasks
          .filter((subtask) => subtask.taskId === task.id && !subtask.deletedAt)
          .sort(sortSubtasks);
        return {
          task,
          subtasks: taskSubtasks,
          progress: getTaskProgress(task, taskSubtasks),
          nextSubtask: getNextSubtask(taskSubtasks.filter((subtask) => subtask.status !== "done" && subtask.status !== "cancelled")),
        };
      })
      .filter(({ task, subtasks: taskSubtasks }) => isProcessTask(task, taskSubtasks))
      .sort((a, b) => {
        if (a.progress.status === "done" && b.progress.status !== "done") return 1;
        if (a.progress.status !== "done" && b.progress.status === "done") return -1;
        return (Date.parse(b.task.updatedAt) || 0) - (Date.parse(a.task.updatedAt) || 0);
      });
  }, [tasks, subtasks]);

  const activeCount = processes.filter((process) => process.progress.status !== "done").length;
  const waitingCount = processes.filter((process) => process.task.backlogGroup === "waiting").length;
  const totalOpenSteps = processes.reduce(
    (sum, process) => sum + process.subtasks.filter((subtask) => subtask.status !== "done" && subtask.status !== "cancelled").length,
    0,
  );
  const nextStepQueue = processes
    .filter((process) => process.progress.status !== "done" && process.nextSubtask)
    .slice(0, 5);

  const handleAddSteps = async (taskId: string) => {
    const lines = (drafts[taskId] ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;
    setActionStatus("");
    for (const title of lines) {
      await onAddSubtaskToTask({ taskId, title });
    }
    setDrafts((current) => ({ ...current, [taskId]: "" }));
    setActionStatus(`נוספו ${lines.length} צעדים לתהליך.`);
  };

  return (
    <div dir="rtl" className="space-y-4">
      <section className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-sky-100 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-black text-cyan-700">Long processes</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 sm:text-4xl">תהליכים ארוכים</h2>
            <p className="mt-2 max-w-3xl text-sm font-bold text-slate-500">
              משימות על עם הרבה צעדים, עבודה שנמשכת ימים, ומעקב שצריך להישאר נקי גם אחרי שחלק מהצעדים כבר בוצעו.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
              <p className="text-[11px] font-black text-sky-700">פעילים</p>
              <p className="mt-1 text-2xl font-black text-sky-950">{activeCount}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
              <p className="text-[11px] font-black text-amber-700">ממתינים</p>
              <p className="mt-1 text-2xl font-black text-amber-950">{waitingCount}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
              <p className="text-[11px] font-black text-emerald-700">צעדים פתוחים</p>
              <p className="mt-1 text-2xl font-black text-emerald-950">{totalOpenSteps}</p>
            </div>
          </div>
        </div>
      </section>

      {actionStatus ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
          {actionStatus}
        </p>
      ) : null}

      {nextStepQueue.length > 0 ? (
        <section className="rounded-3xl bg-slate-950 p-4 text-white shadow-soft sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-cyan-200">Process queue</p>
              <h3 className="mt-1 text-2xl font-black">הצעדים הבאים</h3>
            </div>
            <p className="text-xs font-bold text-slate-300">תור קצר מתוך התהליכים הפתוחים</p>
          </div>
          <div className="mt-4 grid gap-2 lg:grid-cols-5">
            {nextStepQueue.map((process) => {
              const next = process.nextSubtask!;
              return (
                <div key={next.id} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                  <p className="mobile-clamp-2 text-xs font-black text-white">
                    <LinkifiedText text={next.title} />
                  </p>
                  <p className="mt-1 truncate text-[11px] font-bold text-slate-300">{process.task.title}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded-xl bg-emerald-400 px-2 py-1.5 text-[11px] font-black text-slate-950 disabled:opacity-50"
                      disabled={isSaving}
                      onClick={() => void onChangeSubtaskStatus(next.id, "done")}
                    >
                      סיים
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-white/10 px-2 py-1.5 text-[11px] font-black text-white ring-1 ring-white/15 disabled:opacity-50"
                      disabled={isSaving || !onAddSubtaskToFocus}
                      onClick={() => void onAddSubtaskToFocus?.(process.task.id, next.id)}
                    >
                      פוקוס
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {processes.length === 0 ? (
        <section className="rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-lg font-black text-slate-950">אין עדיין תהליכים ארוכים.</p>
          <p className="mt-2 text-sm font-bold text-slate-500">
            משימה עם 4 תתי־משימות ומעלה תופיע כאן אוטומטית. אפשר גם להוסיף לה תגית process.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {processes.map(({ task, subtasks: taskSubtasks, progress, nextSubtask }) => {
            const openSubtasks = taskSubtasks.filter((subtask) => subtask.status !== "done" && subtask.status !== "cancelled");
            const doneSubtasks = taskSubtasks.filter((subtask) => subtask.status === "done");
            const cancelledSubtasks = taskSubtasks.filter((subtask) => subtask.status === "cancelled");
            const doneOpen = Boolean(expandedDone[task.id]);
            const visibleDone = doneOpen ? doneSubtasks : doneSubtasks.slice(-2);
            const draft = drafts[task.id] ?? "";
            const draftCount = draft.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;

            return (
              <article key={task.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-slate-400">
                      {[getProjectName(settings, task), getDomainName(settings, task)].filter(Boolean).join(" · ") || "תהליך"}
                    </p>
                    <h3 className="mt-1 mobile-clamp-2 text-xl font-black leading-tight text-slate-950">
                      <LinkifiedText text={task.title} />
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white"
                    onClick={() => onJumpToTask(task.id)}
                  >
                    פתח
                  </button>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-black text-slate-500">
                    <span>{progress.percent}%</span>
                    <span>{progress.doneCount}/{progress.totalCount || taskSubtasks.length}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-cyan-400"
                      style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
                    />
                  </div>
                </div>

                {nextSubtask ? (
                  <section className="mt-4 rounded-2xl bg-cyan-50 p-3 ring-1 ring-cyan-100">
                    <p className="text-[11px] font-black text-cyan-700">הצעד הבא</p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      <LinkifiedText text={nextSubtask.title} />
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                        disabled={isSaving}
                        onClick={() => void onChangeSubtaskStatus(nextSubtask.id, nextSubtask.status === "done" ? "started" : "done")}
                      >
                        סיים צעד
                      </button>
                      <button
                        type="button"
                        className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-cyan-800 ring-1 ring-cyan-100 disabled:opacity-50"
                        disabled={isSaving || !onAddSubtaskToFocus}
                        onClick={() => void onAddSubtaskToFocus?.(task.id, nextSubtask.id)}
                      >
                        + פוקוס
                      </button>
                    </div>
                  </section>
                ) : null}

                <section className="mt-4 space-y-2">
                  <p className="text-xs font-black text-slate-500">פתוחים</p>
                  {openSubtasks.length ? (
                    openSubtasks.slice(0, 8).map((subtask) => (
                      <div key={subtask.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                        <input
                          type="checkbox"
                          checked={subtask.status === "done"}
                          disabled={isSaving}
                          onChange={(event) => void onChangeSubtaskStatus(subtask.id, event.target.checked ? "done" : "started")}
                        />
                        <span className="min-w-0 text-sm font-bold text-slate-800">
                          <LinkifiedText text={subtask.title} />
                        </span>
                        <button
                          type="button"
                          className="rounded-xl bg-white px-2 py-1 text-[11px] font-black text-cyan-800 ring-1 ring-cyan-100 disabled:opacity-40"
                          disabled={isSaving || !onAddSubtaskToFocus}
                          onClick={() => void onAddSubtaskToFocus?.(task.id, subtask.id)}
                        >
                          פוקוס
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
                      אין צעדים פתוחים כרגע.
                    </p>
                  )}
                </section>

                {doneSubtasks.length > 0 ? (
                  <section className="mt-4 rounded-2xl bg-rose-50/70 p-3 ring-1 ring-rose-100">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-right text-xs font-black text-rose-700"
                      onClick={() => setExpandedDone((current) => ({ ...current, [task.id]: !current[task.id] }))}
                    >
                      <span>בוצעו ({doneSubtasks.length})</span>
                      <span>{doneOpen ? "סגור" : "פתח"}</span>
                    </button>
                    <div className="mt-2 space-y-1.5">
                      {visibleDone.map((subtask) => (
                        <p key={subtask.id} className="text-xs font-bold text-rose-900/60 line-through decoration-rose-400">
                          {subtask.title}
                        </p>
                      ))}
                    </div>
                  </section>
                ) : null}

                {cancelledSubtasks.length > 0 ? (
                  <p className="mt-3 text-xs font-bold text-slate-400">
                    {cancelledSubtasks.length} צעדים מבוטלים מוסתרים.
                  </p>
                ) : null}

                <section className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                  <label className="text-xs font-black text-slate-500">
                    הוסף צעדים חדשים
                    <textarea
                      rows={3}
                      className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-cyan-200 focus:ring-2 focus:ring-cyan-100"
                      value={draft}
                      onChange={(event) => setDrafts((current) => ({ ...current, [task.id]: event.target.value }))}
                      placeholder={"כל שורה = צעד חדש\nלדוגמה: לקבל הצעת מחיר\nלוודא זמן אספקה"}
                    />
                  </label>
                  <button
                    type="button"
                    className="mt-2 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                    disabled={isSaving || draftCount === 0}
                    onClick={() => void handleAddSteps(task.id)}
                  >
                    {draftCount > 1 ? `הוסף ${draftCount} צעדים` : "הוסף צעד"}
                  </button>
                </section>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
