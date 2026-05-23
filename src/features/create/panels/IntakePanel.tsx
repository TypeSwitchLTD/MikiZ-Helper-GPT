import type { SpeechInputLanguage } from '../createTaskTypes';

interface IntakePanelProps {
  rawIntake: string;
  onRawIntakeChange: (value: string) => void;
  isSpeechInputActive: boolean;
  speechInputStatus: string;
  speechInputLanguage: SpeechInputLanguage;
  onToggleSpeech: () => void;
  onSpeechLanguageChange: (lang: SpeechInputLanguage) => void;
  onFillFromIntake: () => void;
}

export function IntakePanel({
  rawIntake,
  onRawIntakeChange,
  isSpeechInputActive,
  speechInputStatus,
  speechInputLanguage,
  onToggleSpeech,
  onSpeechLanguageChange,
  onFillFromIntake,
}: IntakePanelProps) {
  return (
    <div className="space-y-4">
      {/* ── Mic hero ─────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onToggleSpeech}
          aria-pressed={isSpeechInputActive}
          className={`relative grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full text-3xl shadow-lg ring-4 transition-all duration-200 ${
            isSpeechInputActive
              ? 'animate-pulse bg-rose-500 ring-rose-200 text-white scale-110'
              : 'bg-white text-slate-700 ring-sky-200 hover:ring-sky-400 hover:scale-105'
          }`}
        >
          {isSpeechInputActive ? '■' : '🎙️'}
        </button>

        {/* Status / hint */}
        <p className="min-h-[1.25rem] text-center text-xs font-bold text-slate-400">
          {isSpeechInputActive
            ? (speechInputStatus || 'מאזין... דבר בחופשיות')
            : (speechInputStatus || 'לחץ להכתבה קולית')}
        </p>

        {/* Language chips */}
        <div className="flex gap-1.5">
          {(['he-IL', 'en-US'] as SpeechInputLanguage[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => onSpeechLanguageChange(lang)}
              className={`rounded-xl px-3 py-1 text-[11px] font-black ring-1 transition ${
                speechInputLanguage === lang
                  ? 'bg-slate-950 text-white ring-slate-950'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {lang === 'he-IL' ? 'עברית' : 'English'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Free-text area ───────────────────────────────── */}
      <div className="rounded-2xl bg-slate-50 p-1 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-sky-400 transition">
        <textarea
          rows={4}
          value={rawIntake}
          onChange={(e) => onRawIntakeChange(e.target.value)}
          placeholder={
            'לדוגמה:\nלהתקשר למשה מחר ב-16:00\nלבדוק אם Jack שלח timeline\nלהכין פוסט קצר על TimerAligner'
          }
          className="w-full resize-none bg-transparent px-3 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none"
        />
      </div>

      {/* ── Parse CTA ────────────────────────────────────── */}
      <button
        type="button"
        onClick={onFillFromIntake}
        className="w-full rounded-2xl bg-slate-950 py-3.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
      >
        ✦ סדר לי למשימות
      </button>

      <p className="text-center text-[11px] font-bold text-slate-400">
        מפרק לפריטים · בודק כפילויות · ממליץ שיוך לפני שמירה
      </p>
    </div>
  );
}
