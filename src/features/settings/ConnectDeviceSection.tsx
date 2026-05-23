import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { AppSettings } from '../../domain/settings/settingsTypes';

interface ConnectDeviceSectionProps {
  settings: AppSettings | null;
}

function buildBootstrapUrl(settings: AppSettings | null): string | null {
  const token = settings?.morningBriefing?.androidPublishToken?.trim();
  const endpoint = settings?.morningBriefing?.androidPublishEndpoint?.trim();
  if (!token) return null;

  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({ token });
  if (endpoint) params.set('endpoint', endpoint);
  return `${base}/?${params.toString()}`;
}

export function ConnectDeviceSection({ settings }: ConnectDeviceSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState('');

  const bootstrapUrl = buildBootstrapUrl(settings);

  useEffect(() => {
    if (!bootstrapUrl || !canvasRef.current) return;
    setQrError('');
    QRCode.toCanvas(canvasRef.current, bootstrapUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#020617', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch((err: unknown) => {
      setQrError(err instanceof Error ? err.message : 'שגיאה ביצירת QR');
    });
  }, [bootstrapUrl]);

  const handleCopy = async () => {
    if (!bootstrapUrl) return;
    try {
      await navigator.clipboard.writeText(bootstrapUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the input
    }
  };

  if (!settings?.morningBriefing?.androidPublishToken?.trim()) {
    return (
      <div className="rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200">
        <p className="text-sm font-black text-amber-900">חסר Token לחיבור מכשיר</p>
        <p className="mt-1 text-xs font-bold text-amber-700">
          כדי לחבר מכשיר נוסף, קודם צריך להגדיר Token בסנכרון, ענן ואבטחה.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">

      {/* Explanation */}
      <div className="rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
        <p className="text-sm font-black text-emerald-900">חיבור חד-פעמי — סרוק פעם אחת ונגמר</p>
        <p className="mt-1 text-xs font-bold text-emerald-700">
          אחרי הסריקה, הטלפון ישמור את ההגדרות וימשוך את כל המשימות מהענן. מהיום הוא יסנכרן אוטומטית בכל פתיחה.
        </p>
      </div>

      {/* QR code */}
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-[1.75rem] bg-white p-4 shadow-soft ring-1 ring-slate-200">
          {qrError ? (
            <div className="grid h-[220px] w-[220px] place-items-center rounded-2xl bg-red-50 text-center">
              <p className="text-xs font-bold text-red-700">{qrError}</p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="block rounded-xl"
              style={{ imageRendering: 'pixelated' }}
            />
          )}
        </div>

        <p className="text-center text-xs font-bold text-slate-500">
          פתח את הטלפון → סרוק את הקוד → נכנס לאפליקציה
        </p>
      </div>

      {/* URL copy */}
      <div className="space-y-2">
        <p className="text-xs font-black text-slate-500">או שלח לינק</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={bootstrapUrl ?? ''}
            className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 ltr"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={() => void handleCopy()}
            className={`shrink-0 rounded-2xl px-4 py-2.5 text-xs font-black transition ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-950 text-white hover:bg-slate-800'
            }`}
          >
            {copied ? '✓ הועתק' : 'העתק'}
          </button>
        </div>
      </div>

      {/* Warning */}
      <div className="rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
        <p className="text-xs font-bold text-amber-800">
          שמור על הלינק — מי שיש לו אותו יכול לגשת לכל הדאטה שלך.
        </p>
      </div>

    </div>
  );
}
