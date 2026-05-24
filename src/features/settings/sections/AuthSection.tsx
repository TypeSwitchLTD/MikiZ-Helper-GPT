import { useState } from 'react';
import { SectionCard } from '../../../components/layout/SectionCard';
import type { SettingsFormState, UpdateFieldFn } from '../settingsFormTypes';
import { isBiometricSupported, registerBiometric } from '../../auth/useBiometricAuth';

interface AuthSectionProps {
  form: SettingsFormState;
  updateField: UpdateFieldFn;
  hasPinHash: boolean;
}

export function AuthSection({ form, updateField, hasPinHash }: AuthSectionProps) {
  const [biometricStatus, setBiometricStatus] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleRegisterBiometric = async () => {
    setIsRegistering(true);
    setBiometricStatus('');
    const credId = await registerBiometric();
    setIsRegistering(false);
    if (credId) {
      updateField('passkeyCredentialId', credId);
      setBiometricStatus('✓ טביעת אצבע / Face ID נרשמה בהצלחה');
    } else {
      setBiometricStatus('הרישום נכשל — הדפדפן אינו תומך או הגישה נדחתה');
    }
  };

  const handleRemoveBiometric = () => {
    updateField('passkeyCredentialId', null);
    setBiometricStatus('טביעת האצבע הוסרה');
  };

  const hasBiometric = Boolean(form.passkeyCredentialId);
  const browserSupports = isBiometricSupported();

  return (
    <SectionCard title="כניסה ואבטחה" description="PIN 6 ספרות + טביעת אצבע / Face ID. נעילה מקומית.">
      <div className="grid gap-4 lg:grid-cols-2">

        {/* PIN */}
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
          <small className="text-xs font-bold text-slate-500">6 ספרות — כניסה אוטומטית בלי Enter.</small>
        </label>

        {/* Biometric */}
        <div className="lg:col-span-2 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-900">טביעת אצבע / Face ID</p>
              <p className="mt-0.5 text-xs font-bold text-slate-500">
                {!browserSupports
                  ? 'הדפדפן הנוכחי אינו תומך ב-WebAuthn'
                  : hasBiometric
                  ? 'רשום ופעיל — כפתור יופיע במסך הכניסה'
                  : 'לא רשום עדיין'}
              </p>
            </div>
            {browserSupports && (
              <div className="flex gap-2 shrink-0">
                {hasBiometric && (
                  <button
                    type="button"
                    onClick={handleRemoveBiometric}
                    className="rounded-2xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100"
                  >
                    הסר
                  </button>
                )}
                <button
                  type="button"
                  disabled={isRegistering}
                  onClick={() => void handleRegisterBiometric()}
                  className="rounded-2xl bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  {isRegistering ? 'מגיש...' : hasBiometric ? 'רשום מחדש' : 'רשום טביעת אצבע'}
                </button>
              </div>
            )}
          </div>
          {biometricStatus && (
            <p className={`mt-3 rounded-2xl px-3 py-2 text-xs font-black ring-1 ${biometricStatus.startsWith('✓') ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
              {biometricStatus}
            </p>
          )}
        </div>

      </div>
    </SectionCard>
  );
}
