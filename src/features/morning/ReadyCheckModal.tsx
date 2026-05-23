import { formatHebrewCalendarDateLetters } from '../../domain/morning/morningBriefing';
import type { WeatherBrief } from '../../domain/morning/weather';

interface ReadyCheckModalProps {
  todayISO: string;
  appVersion: string;
  activeTaskCount: number;
  openSubtaskCount: number;
  pendingRemindersCount: number;
  topTasksCount: number;
  morningWeather: WeatherBrief | null;
  voiceStatus: string;
  cloudSyncStatus: string;
  locationLabel: string;
  onSpeakMorningBriefing: () => void;
  onOpenFocusTimer: () => void;
  onClose: () => void;
}

function MiniReminder({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/85 px-3 py-2 text-xs font-black ring-1 ring-sky-100">
      <span className="text-slate-800">{label}</span>
      <span className="text-slate-500">{value}</span>
    </div>
  );
}

export function ReadyCheckModal({
  todayISO,
  appVersion,
  activeTaskCount,
  openSubtaskCount,
  pendingRemindersCount,
  topTasksCount,
  morningWeather,
  voiceStatus,
  cloudSyncStatus,
  locationLabel,
  onSpeakMorningBriefing,
  onOpenFocusTimer,
  onClose,
}: ReadyCheckModalProps) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-emerald-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-bl from-emerald-50 via-cyan-50 to-sky-50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black text-emerald-700">Morning readiness</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">מוכן לבוקר?</h2>
              <p className="mt-2 max-w-xl text-sm font-bold text-slate-600">
                בדיקת מצב מהירה לפני שמתחילים: משימות, תתי־משימות, קול, תזכורות ומיקום.
              </p>
            </div>
            <button
              type="button"
              className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200"
              onClick={onClose}
            >
              סגור
            </button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.5rem] bg-white/85 p-4 text-center shadow-soft ring-1 ring-emerald-100">
              <p className="text-4xl font-black text-emerald-700">{activeTaskCount}</p>
              <p className="mt-1 text-xs font-black text-slate-500">משימות פתוחות</p>
            </div>
            <div className="rounded-[1.5rem] bg-white/85 p-4 text-center shadow-soft ring-1 ring-sky-100">
              <p className="text-4xl font-black text-sky-700">{openSubtaskCount}</p>
              <p className="mt-1 text-xs font-black text-slate-500">תתי־משימות פתוחות</p>
            </div>
            <div className="rounded-[1.5rem] bg-white/85 p-4 text-center shadow-soft ring-1 ring-cyan-100">
              <p className="text-4xl font-black text-cyan-700">{pendingRemindersCount}</p>
              <p className="mt-1 text-xs font-black text-slate-500">תזכורות פעילות</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 text-sm font-bold text-slate-700 sm:grid-cols-2">
          <MiniReminder label="חשובות לבוקר" value={`${topTasksCount}/3`} />
          <MiniReminder
            label={morningWeather?.shabbatLabel || 'שקיעה'}
            value={morningWeather?.shabbatTime || 'טוען'}
          />
          <MiniReminder label="קול" value={voiceStatus} />
          <MiniReminder
            label="תאריך עברי"
            value={formatHebrewCalendarDateLetters(todayISO) || 'לא זמין'}
          />
          <MiniReminder label="מיקום" value={locationLabel || 'לא הוגדר'} />
          <MiniReminder label="Cloud" value={cloudSyncStatus || 'מוכן לסנכרון'} />
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button
            type="button"
            className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-800 ring-1 ring-orange-100"
            onClick={onOpenFocusTimer}
          >
            פתח טיימר
          </button>
          <button
            type="button"
            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white"
            onClick={onSpeakMorningBriefing}
          >
            התחל נאום בוקר
          </button>
        </div>
      </section>
    </div>
  );
}
