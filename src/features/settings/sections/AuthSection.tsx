import { SectionCard } from '../../../components/layout/SectionCard';
import type { SettingsFormState, UpdateFieldFn } from '../settingsFormTypes';

interface AuthSectionProps {
  form: SettingsFormState;
  updateField: UpdateFieldFn;
  hasPinHash: boolean;
}

export function AuthSection({ form, updateField, hasPinHash }: AuthSectionProps) {
  return (
    <SectionCard title="כניסה בסיסית" description="נעילת אפליקציה עם קוד 6 ספרות. הגנה מקומית פשוטה.">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="checkbox-card lg:col-span-2">
          <input type="checkbox" checked={form.pinEnabled} onChange={(e) => updateField('pinEnabled', e.target.checked)} />
          <span>להפעיל כניסה עם PIN</span>
        </label>
        <label className="field-card lg:col-span-2">
          <span>קוד חדש בן 6 ספרות</span>
          <input
            className="ltr text-left"
            inputMode="numeric"
            maxLength={6}
            value={form.authPinCode}
            onChange={(e) => updateField('authPinCode', e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={hasPinHash ? 'השאר ריק כדי לא לשנות' : '123456'}
          />
          <small className="text-xs font-bold text-slate-500">6 ספרות במסך הכניסה — נכנסים בלי Enter.</small>
        </label>
      </div>
    </SectionCard>
  );
}
