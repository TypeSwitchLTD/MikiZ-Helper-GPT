interface FocusTimerModalProps {
  focusSeconds: number;
  focusRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onSetMinutes: (minutes: number) => void;
  onClose: () => void;
}

export function FocusTimerModal({
  focusSeconds,
  focusRunning,
  onStart,
  onStop,
  onReset,
  onSetMinutes,
  onClose,
}: FocusTimerModalProps) {
  const mm = Math.floor(focusSeconds / 60).toString().padStart(2, '0');
  const ss = (focusSeconds % 60).toString().padStart(2, '0');

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl ring-1 ring-orange-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-orange-700">Focus Timer</p>
            <h2 className="text-2xl font-black text-slate-950">טיימר פוקוס</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              טיימר פנימי בסגנון התמקדות: עבודה קצרה, צליל, ואז הפסקה.
            </p>
          </div>
          <button
            type="button"
            className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black"
            onClick={onClose}
          >
            סגור
          </button>
        </div>

        <div className="my-6 text-center">
          <p className="text-6xl font-black text-slate-950">
            {mm}:{ss}
          </p>
          <p className="mt-2 text-sm font-bold text-slate-500">
            {focusRunning ? 'רץ עכשיו' : 'מוכן להתחלה'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-40"
            disabled={focusRunning}
            onClick={onStart}
          >
            התחל
          </button>
          <button
            type="button"
            className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-40"
            disabled={!focusRunning}
            onClick={onStop}
          >
            עצור
          </button>
          <button
            type="button"
            className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-800 ring-1 ring-orange-100"
            onClick={onReset}
          >
            איפוס
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[10, 20, 30].map((minutes) => (
            <button
              key={minutes}
              type="button"
              className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200"
              onClick={() => onSetMinutes(minutes)}
            >
              {minutes} דק׳
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
