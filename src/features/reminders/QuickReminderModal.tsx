import { useEffect, useRef, useState } from 'react';
import {
  getSpeechRecognitionCtor,
  getDateFromHebrewText,
  stripTemporalWords,
  cleanTaskText,
  type SpeechRecognitionLike,
} from '../create/createTaskUtils';
import { requestNotificationPermission } from './useReminderChecker';

interface QuickReminderModalProps {
  todayISO: string;
  isSaving?: boolean;
  onSave: (input: { title: string; date: string; time: string; note?: string }) => Promise<void> | void;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTomorrowISO(todayISO: string): string {
  const d = new Date(`${todayISO}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Extract HH:MM time from natural Hebrew/English text */
function extractTimeFromText(text: string): string {
  // Explicit HH:MM or H:MM
  const explicit = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (explicit) {
    const h = parseInt(explicit[1], 10);
    const m = parseInt(explicit[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59)
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Hebrew time words
  if (/בבוקר|בצפרא/.test(text)) return '09:00';
  if (/בצהריים|בצהרי/.test(text)) return '12:30';
  if (/אחה"צ|אחרי הצהריים|אחה״צ/.test(text)) return '15:00';
  if (/ערב|בערב/.test(text)) return '19:00';
  if (/לילה|בלילה/.test(text)) return '21:00';

  // "ב-N" or "בשעה N" — e.g. "בשעה שלוש", "ב-14"
  const hebrewNums: Record<string, number> = {
    'אחת': 13, 'שתיים': 14, 'שלוש': 15, 'ארבע': 16,
    'חמש': 17, 'שש': 18, 'שבע': 19, 'שמונה': 20,
    'תשע': 21, 'עשר': 10, 'אחד עשר': 11, 'שתים עשרה': 12,
  };
  for (const [word, hour] of Object.entries(hebrewNums)) {
    if (text.includes(word)) return `${String(hour).padStart(2, '0')}:00`;
  }

  // Simple digit: "ב-14" or "בשעה 14"
  const numMatch = text.match(/(?:בשעה\s+|ב[-–]?)(\d{1,2})(?!\s*:)/);
  if (numMatch) {
    const h = parseInt(numMatch[1], 10);
    if (h >= 6 && h <= 23) return `${String(h).padStart(2, '0')}:00`;
  }

  return '10:00'; // sensible default
}

/** Strip time phrases so they don't end up in the title */
function stripTimePhrases(text: string): string {
  return text
    .replace(/\b\d{1,2}:\d{2}\b/, '')
    .replace(/בבוקר|בצהריים|אחרי הצהריים|אחה"צ|בערב|בלילה|בצפרא|אחה״צ/, '')
    .replace(/בשעה\s+\S+/, '')
    .replace(/ב[-–]\d{1,2}(?!\s*:)/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseReminderText(
  text: string,
  todayISO: string,
): { title: string; date: string; time: string } {
  const { date } = getDateFromHebrewText(text, todayISO);
  const time = extractTimeFromText(text);
  const cleaned = stripTimePhrases(stripTemporalWords(cleanTaskText(text)));
  const title = cleaned || text.trim();
  return { title: title.length > 100 ? title.slice(0, 100) : title, date, time };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickReminderModal({ todayISO, isSaving = false, onSave, onClose }: QuickReminderModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [rawText, setRawText] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayISO);
  const [time, setTime] = useState('10:00');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const [parsed, setParsed] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef('');

  const tomorrowISO = getTomorrowISO(todayISO);

  // Escape key closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const applyParsed = (text: string) => {
    if (!text.trim()) return;
    const result = parseReminderText(text, todayISO);
    setTitle(result.title);
    setDate(result.date);
    setTime(result.time);
    setParsed(true);
    setStatus('');
  };

  const startListening = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) { setStatus('הדפדפן לא תומך בהכתבה קולית'); return; }

    const recognition = new Ctor();
    recognition.lang = 'he-IL';
    recognition.continuous = false;
    recognition.interimResults = true;

    baseTextRef.current = rawText;
    recognitionRef.current = recognition;
    setIsListening(true);
    setStatus('מאזין...');

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (!res) continue;
        const transcript = res[0]?.transcript ?? '';
        if (res.isFinal) final += transcript;
        else interim += transcript;
      }
      const combined = (baseTextRef.current + ' ' + (final || interim)).trim();
      setRawText(combined);
      if (final) {
        baseTextRef.current = combined;
        applyParsed(combined);
      }
    };

    recognition.onerror = (e) => {
      setStatus(e.error === 'no-speech' ? 'לא זוהה דיבור — נסה שוב' : `שגיאה: ${e.error ?? 'לא ידוע'}`);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  };

  const handleSave = async () => {
    const finalTitle = title.trim() || rawText.trim();
    if (!finalTitle) { setStatus('נא להזין כותרת לתזכורת'); return; }
    if (!date || !time) { setStatus('נא לבחור תאריך ושעה'); return; }
    await requestNotificationPermission();
    await onSave({ title: finalTitle, date, time, note: note.trim() || undefined });
    onClose();
  };

  const handleRawChange = (v: string) => {
    setRawText(v);
    if (v.trim()) applyParsed(v);
    else { setTitle(''); setParsed(false); }
  };

  return (
    <div
      className="fixed inset-x-0 top-0 h-dvh z-[80] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl ring-1 ring-amber-200 sm:rounded-[2rem]"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-amber-100 px-5 py-4">
          <div>
            <p className="text-xs font-black text-amber-700">🔔 תזכורת מהירה</p>
            <h2 className="text-xl font-black text-slate-950">תזכורת חדשה</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-100 text-sm font-black text-slate-600 hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        <div className="grid gap-4 px-5 py-5">
          {/* Voice button */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`grid h-20 w-20 place-items-center rounded-full text-3xl shadow-lg ring-4 transition-all ${
                isListening
                  ? 'animate-pulse bg-rose-500 ring-rose-200 text-white'
                  : 'bg-amber-400 ring-amber-200 text-white hover:bg-amber-500'
              }`}
              aria-label={isListening ? 'עצור הקלטה' : 'התחל הקלטה'}
            >
              {isListening ? '■' : '🎙️'}
            </button>
            {status ? (
              <p className="text-center text-xs font-bold text-slate-500">{status}</p>
            ) : (
              <p className="text-center text-xs font-bold text-slate-400">
                {isListening ? 'מדבר אל המיקרופון...' : 'לחץ ודבר — "מחר להתקשר לסבתא ב-17:00"'}
              </p>
            )}
          </div>

          {/* Raw text / editable */}
          {(rawText || parsed) ? (
            <label className="field-compact">
              <span>מה שמעתי</span>
              <textarea
                rows={2}
                value={rawText}
                onChange={(e) => handleRawChange(e.target.value)}
                placeholder="או הקלד ישירות..."
                className="text-xs"
              />
            </label>
          ) : (
            <label className="field-compact">
              <span>או כתוב ישירות</span>
              <textarea
                rows={2}
                value={rawText}
                onChange={(e) => handleRawChange(e.target.value)}
                placeholder={"מחר להתקשר לסבתא ב-17:00\nהשבוע לשלוח הצעת מחיר"}
                className="text-xs"
              />
            </label>
          )}

          {/* Parsed / editable fields */}
          {parsed || title ? (
            <div className="grid gap-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100">
              <p className="text-[11px] font-black text-amber-700">✓ זוהה אוטומטית — ניתן לערוך</p>

              <label className="field-compact">
                <span>כותרת</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="כותרת התזכורת" />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="field-compact">
                  <span>תאריך</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="field-compact">
                  <span>שעה</span>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'בוקר', value: '09:00' },
                  { label: 'צהריים', value: '13:00' },
                  { label: 'ערב', value: '18:00' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTime(option.value)}
                    className={`rounded-2xl px-3 py-1.5 text-xs font-black ring-1 ${
                      time === option.value
                        ? 'bg-slate-950 text-white ring-slate-950'
                        : 'bg-white text-slate-700 ring-slate-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setDate(todayISO)}
                  className={`rounded-2xl px-3 py-1.5 text-xs font-black ring-1 ${date === todayISO ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-700 ring-slate-200'}`}>
                  היום
                </button>
                <button type="button" onClick={() => setDate(tomorrowISO)}
                  className={`rounded-2xl px-3 py-1.5 text-xs font-black ring-1 ${date === tomorrowISO ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-700 ring-slate-200'}`}>
                  מחר
                </button>
              </div>

              <label className="field-compact">
                <span>הערה (אופציונלי)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="פרטים נוספים..." />
              </label>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-amber-100 px-5 py-4">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || (!title.trim() && !rawText.trim())}
            className="flex-1 rounded-2xl bg-amber-500 py-3 text-sm font-black text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-40"
          >
            {isSaving ? 'שומר...' : '🔔 שמור תזכורת'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
