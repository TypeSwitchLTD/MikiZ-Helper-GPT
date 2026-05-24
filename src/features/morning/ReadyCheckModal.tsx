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
  onClose: () => void;
}

function StatPill({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className={`rounded-2xl bg-white/90 px-3 py-3 text-center shadow-soft ring-1 ${tone}`}>
      <p className="text-2xl font-black leading-none sm:text-3xl">{value}</p>
      <p className="mt-1 text-[11px] font-black leading-tight text-slate-500">{label}</p>
    </div>
  );
}

function MiniReminder({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-2 rounded-2xl bg-white/85 px-3 py-2 text-xs font-black ring-1 ring-sky-100">
      <span className="text-slate-800">{label}</span>
      <span className="truncate text-left text-slate-500" dir="auto">{value}</span>
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
  onClose,
}: ReadyCheckModalProps) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/35 p-3 pt-6 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <section
        className="w-full max-w-2xl overflow-hidden rounded-[1.5rem] bg-white shadow-2xl ring-1 ring-emerald-100 sm:rounded-[2rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-bl from-emerald-50 via-cyan-50 to-sky-50 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-emerald-700">Morning readiness</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">מוכן לבוקר?</h2>
              <p className="mt-1 max-w-xl text-xs font-bold leading-6 text-slate-600 sm:text-sm">
                בדיקה קצרה לפני שמתחילים: משימות, תזכורות, קול ומיקום.
              </p>
            </div>
            <button
              type="button"
              className="min-h-10 rounded-2xl bg-white px-4 text-sm font-black text-slate-700 ring-1 ring-slate-200"
              onClick={onClose}
            >
              סגור
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            <StatPill label="משימות" value={activeTaskCount} tone="text-emerald-700 ring-emerald-100" />
            <StatPill label="תתי-משימות" value={openSubtaskCount} tone="text-sky-700 ring-sky-100" />
            <StatPill label="תזכורות" value={pendingRemindersCount} tone="text-cyan-700 ring-cyan-100" />
          </div>
        </div>

        <div className="grid gap-2 p-4 text-sm font-bold text-slate-700 sm:grid-cols-2 sm:p-5">
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
          <MiniReminder label="Cloud" value={cloudSyncStatus || `מוכן לסנכרון · ${appVersion}`} />
        </div>

        <div className="border-t border-slate-100 bg-slate-50 p-4">
          <button
            type="button"
            className="min-h-12 w-full rounded-2xl bg-emerald-600 px-5 text-base font-black text-white shadow-soft transition active:scale-[0.99]"
            onClick={onSpeakMorningBriefing}
          >
            התחל נאום בוקר
          </button>
        </div>
      </section>
    </div>
  );
}
