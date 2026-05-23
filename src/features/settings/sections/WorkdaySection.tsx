import { SectionCard } from '../../../components/layout/SectionCard';
import type { SettingsFormState, UpdateFieldFn } from '../settingsFormTypes';

interface CityHint { timezone: string; label?: string }

interface WorkdaySectionProps {
  form: SettingsFormState;
  updateField: UpdateFieldFn;
  onCityChange: (city: string) => void;
  onLocationLabelChange: (label: string) => void;
  cityHint?: CityHint;
}

export function WorkdaySection({ form, updateField, onCityChange, onLocationLabelChange, cityHint }: WorkdaySectionProps) {
  return (
    <SectionCard title="יום עבודה ומיקום" description="שעות, עיר, אזור זמן ושבת.">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="field-card">
          <span>תחילת יום עבודה</span>
          <input type="time" value={form.workdayStartTime} onChange={(e) => updateField('workdayStartTime', e.target.value)} />
        </label>
        <label className="field-card">
          <span>סיום יום עבודה</span>
          <input type="time" value={form.workdayEndTime} onChange={(e) => updateField('workdayEndTime', e.target.value)} />
        </label>
        <label className="field-card">
          <span>תווית מיקום</span>
          <input value={form.locationLabel} onChange={(e) => onLocationLabelChange(e.target.value)} placeholder="למשל: בנגקוק" />
        </label>
        <label className="field-card">
          <span>עיר</span>
          <input value={form.city} onChange={(e) => onCityChange(e.target.value)} placeholder="Bangkok" />
          {cityHint ? <small className="font-medium text-emerald-700">זוהה אוטומטית: {cityHint.timezone}</small> : null}
        </label>
        <label className="field-card">
          <span>מדינה</span>
          <input value={form.country} onChange={(e) => updateField('country', e.target.value)} />
        </label>
        <label className="field-card">
          <span>אזור זמן</span>
          <input className="ltr text-right" value={form.timezone} onChange={(e) => updateField('timezone', e.target.value)} />
        </label>
        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100 lg:col-span-2">
          <p className="text-sm font-bold text-amber-900">שקיעה / שבת</p>
          <p className="mt-1 text-xs text-amber-800">מוצג במסך הראשי לפי מיקום ותאריך.</p>
        </div>
      </div>
    </SectionCard>
  );
}
