import type { UseMorningBriefingReturn } from './useMorningBriefing';

interface MorningBriefingModalProps
  extends Pick<
    UseMorningBriefingReturn,
    | 'morningBriefingText'
    | 'isMorningLoading'
    | 'isGeneratingVoice'
    | 'isSpeaking'
    | 'voiceError'
    | 'morningPublishStatus'
    | 'voiceStatus'
    | 'availableVoices'
    | 'selectedVoiceName'
    | 'setSelectedVoiceName'
    | 'speakMorningBriefing'
    | 'stopMorningBriefing'
    | 'downloadMorningBriefing'
    | 'publishMorningBriefingForAndroid'
  > {
  onClose: () => void;
}

export function MorningBriefingModal({
  morningBriefingText,
  isMorningLoading,
  isGeneratingVoice,
  isSpeaking,
  voiceError,
  morningPublishStatus,
  voiceStatus,
  availableVoices,
  selectedVoiceName,
  setSelectedVoiceName,
  speakMorningBriefing,
  stopMorningBriefing,
  downloadMorningBriefing,
  publishMorningBriefingForAndroid,
  onClose,
}: MorningBriefingModalProps) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      onClick={() => { stopMorningBriefing(); onClose(); }}
    >
      <section
        className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-[2rem] bg-white p-5 shadow-2xl ring-1 ring-sky-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black text-emerald-700">Morning Briefing · מקומי</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">פתיחת בוקר מדברת</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              מבוסס על המשימות המקומיות. לחיצה נוספת על Play עוצרת. אם ElevenLabs פעיל יכול להיות
              עיכוב כי קודם נוצר קובץ אודיו בענן; קול דפדפן מתחיל מהר יותר.
            </p>
            <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-black text-slate-600 ring-1 ring-slate-100">
              מנוע קול: {voiceStatus}
            </div>
            <label className="mt-3 block max-w-xl text-xs font-black text-slate-500">
              קול דפדפן לגיבוי
              <select
                className="mt-1 w-full rounded-2xl border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                value={selectedVoiceName}
                onChange={(e) => setSelectedVoiceName(e.target.value)}
              >
                <option value="">בחירה אוטומטית של קול עברי</option>
                {availableVoices.map((voice) => (
                  <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                    {voice.name} · {voice.lang}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-2xl px-4 py-2 text-sm font-black text-white ${isGeneratingVoice || isSpeaking ? 'bg-rose-600' : 'bg-emerald-600'}`}
              onClick={() => void speakMorningBriefing()}
            >
              {isGeneratingVoice ? 'מייצר קול...' : isSpeaking ? '■ עצור' : '▶ הקריא'}
            </button>
            <button
              type="button"
              className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 ring-1 ring-rose-100"
              onClick={stopMorningBriefing}
            >
              עצור
            </button>
            <button
              type="button"
              className="rounded-2xl bg-sky-50 px-4 py-2 text-sm font-black text-sky-700 ring-1 ring-sky-100"
              onClick={downloadMorningBriefing}
            >
              ייצא נאום
            </button>
            <button
              type="button"
              className="rounded-2xl bg-violet-600 px-4 py-2 text-sm font-black text-white"
              onClick={() => void publishMorningBriefingForAndroid()}
            >
              פרסם לאנדרואיד
            </button>
            <button
              type="button"
              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700"
              onClick={() => { stopMorningBriefing(); onClose(); }}
            >
              סגור
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-3xl bg-white p-4 ring-1 ring-sky-100">
          {isMorningLoading ? (
            <p className="text-base font-black text-sky-700">טוען מזג אוויר ומכין נאום בוקר...</p>
          ) : (
            <pre className="whitespace-pre-wrap text-lg font-bold leading-9 text-slate-800">
              {morningBriefingText}
            </pre>
          )}
        </div>

        <p className="mt-3 text-xs font-bold text-slate-500">
          הערה: ElevenLabs הוא היעד לקול אנושי. אם הוא לא מוגדר או נחסם, המערכת נופלת לקול דפדפן.
        </p>
        {voiceError ? (
          <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-black text-amber-800 ring-1 ring-amber-100">
            {voiceError}
          </p>
        ) : null}
        {morningPublishStatus ? (
          <p className="mt-3 rounded-2xl bg-violet-50 px-4 py-3 text-xs font-black text-violet-800 ring-1 ring-violet-100">
            {morningPublishStatus}
          </p>
        ) : null}
      </section>
    </div>
  );
}
