import type { CommandBlock, UseMorningBriefingReturn } from './useMorningBriefing';

interface CommandCenterModalProps
  extends Pick<
    UseMorningBriefingReturn,
    | 'morningCommandPlan'
    | 'commandBlocks'
    | 'commandStatus'
    | 'updateCommandBlock'
    | 'saveMorningCommandPlan'
  > {
  isSaving: boolean;
  onClose: () => void;
}

export function CommandCenterModal({
  morningCommandPlan,
  commandBlocks,
  commandStatus,
  updateCommandBlock,
  saveMorningCommandPlan,
  isSaving,
  onClose,
}: CommandCenterModalProps) {
  const blocks: CommandBlock[] = commandBlocks.length
    ? commandBlocks
    : morningCommandPlan.planBlocks;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="mission-scroll max-h-[88vh] w-full max-w-4xl overflow-auto rounded-[2rem] bg-white p-5 shadow-2xl ring-1 ring-violet-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-violet-700">Morning Command Center</p>
            <h2 className="text-2xl font-black text-slate-950">תכנון יום מתקדם</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              בחירה מקומית לפי עדיפות, משימות שהתחילו, משימות שנדחו, לידים ו־Quick Wins. בעתיד
              ה־AI ישפר את הסידור.
            </p>
          </div>
          <button
            type="button"
            className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700"
            onClick={onClose}
          >
            סגור
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-3xl bg-sky-50 p-4 ring-1 ring-sky-100">
            <h3 className="font-black text-sky-950">3 משימות חשובות</h3>
            <div className="mt-3 space-y-2">
              {morningCommandPlan.topTasks.length ? (
                morningCommandPlan.topTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-800 ring-1 ring-sky-100"
                  >
                    {index + 1}. {task.title}
                  </div>
                ))
              ) : (
                <p className="text-sm font-bold text-slate-500">
                  אין עדיין מספיק משימות להיום.
                </p>
              )}
            </div>
          </div>
          <div className="rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
            <h3 className="font-black text-emerald-950">2 פתיחות קלות</h3>
            <div className="mt-3 space-y-2">
              {morningCommandPlan.quickOpeners.length ? (
                morningCommandPlan.quickOpeners.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-800 ring-1 ring-emerald-100"
                  >
                    {task.title}
                  </div>
                ))
              ) : (
                <p className="text-sm font-bold text-slate-500">לא נמצאו Quick Wins להיום.</p>
              )}
            </div>
          </div>
          <div className="rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-100">
            <h3 className="font-black text-amber-950">לא לדחות שוב</h3>
            <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-800 ring-1 ring-amber-100">
              {morningCommandPlan.doNotDelayTask?.title || 'אין משימה קריטית שמזוהה כרגע.'}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <h3 className="font-black text-slate-950">בלוקים מוצעים ליום</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {blocks.map((block, index) => (
              <div
                key={`${index}-${block.time}-${block.title}`}
                className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"
              >
                <div className="grid gap-2 sm:grid-cols-[92px_minmax(0,1fr)]">
                  <label className="text-xs font-black text-slate-500">
                    שעה
                    <input
                      className="mt-1 w-full rounded-xl px-2 py-1 text-xs"
                      value={block.time}
                      onChange={(e) => updateCommandBlock(index, { time: e.target.value })}
                    />
                  </label>
                  <label className="text-xs font-black text-slate-500">
                    כותרת
                    <input
                      className="mt-1 w-full rounded-xl px-2 py-1 text-xs"
                      value={block.title}
                      onChange={(e) => updateCommandBlock(index, { title: e.target.value })}
                    />
                  </label>
                </div>
                <label className="mt-2 block text-xs font-black text-slate-500">
                  פירוט
                  <textarea
                    className="mt-1 min-h-[64px] rounded-xl px-2 py-1 text-xs"
                    value={block.description}
                    onChange={(e) => updateCommandBlock(index, { description: e.target.value })}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        {commandStatus ? (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
            {commandStatus}
          </p>
        ) : null}
        <button
          type="button"
          className="mt-4 w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white"
          onClick={() => void saveMorningCommandPlan()}
          disabled={isSaving}
        >
          {isSaving ? 'שומר...' : 'אשר ושמור תוכנית יום'}
        </button>
      </section>
    </div>
  );
}
