import { SectionCard } from '../../../components/layout/SectionCard';
import type { SettingsFormState, UpdateFieldFn } from '../settingsFormTypes';

interface AutomationSectionProps {
  form: SettingsFormState;
  updateField: UpdateFieldFn;
}

export function AutomationSection({ form, updateField }: AutomationSectionProps) {
  return (
    <SectionCard title="תזכורות, גיבוי ואוטומציה" description="הגדרות בסיסיות בלבד.">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="checkbox-card">
          <input type="checkbox" checked={form.warnOnRestWindowConflict} onChange={(e) => updateField('warnOnRestWindowConflict', e.target.checked)} />
          <span>להזהיר כשמשימה נופלת על חלון מנוחה</span>
        </label>
        <label className="checkbox-card">
          <input type="checkbox" checked={form.autoAddRecurringToToday} onChange={(e) => updateField('autoAddRecurringToToday', e.target.checked)} />
          <span>להוסיף משימות חוזרות להיום אוטומטית</span>
        </label>
        <label className="checkbox-card">
          <input type="checkbox" checked={form.autoBackupEnabled} onChange={(e) => updateField('autoBackupEnabled', e.target.checked)} />
          <span>גיבוי אוטומטי פעיל</span>
        </label>
        <label className="checkbox-card">
          <input type="checkbox" checked={form.fileBackupEnabled} onChange={(e) => updateField('fileBackupEnabled', e.target.checked)} />
          <span>גיבוי לקובץ כשכרום מאפשר</span>
        </label>
        <label className="field-card lg:col-span-2">
          <span>מרווח גיבוי בדקות</span>
          <input type="number" min={5} value={form.backupIntervalMinutes} onChange={(e) => updateField('backupIntervalMinutes', Number(e.target.value))} />
        </label>
      </div>
    </SectionCard>
  );
}
