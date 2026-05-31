import { useEffect, useMemo, useState } from 'react';
import { SectionCard } from '../../components/layout/SectionCard';
import type { AppSettings } from '../../domain/settings/settingsTypes';
import {
  countPushSubscriptions,
  enablePushNotifications,
  fetchPushConfig,
  getCurrentPushSubscription,
  getPushCapabilityStatus,
  sendTestPushNotification,
} from '../../domain/push/webPush';

interface PushNotificationsSectionProps {
  settings: AppSettings;
  onSaveSettings: (patch: { pushSubscriptions?: AppSettings['pushSubscriptions'] }) => Promise<void>;
}

function permissionLabel(permission: string): string {
  if (permission === 'granted') return 'מאושר';
  if (permission === 'denied') return 'חסום בדפדפן';
  if (permission === 'default') return 'עוד לא נשאל';
  return 'לא נתמך';
}

export function PushNotificationsSection({ settings, onSaveSettings }: PushNotificationsSectionProps) {
  const [status, setStatus] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [hasLocalSubscription, setHasLocalSubscription] = useState(false);
  const capability = useMemo(() => getPushCapabilityStatus(), []);
  const registeredCount = countPushSubscriptions(settings);

  useEffect(() => {
    let alive = true;
    getCurrentPushSubscription()
      .then((subscription) => {
        if (alive) setHasLocalSubscription(Boolean(subscription?.endpoint));
      })
      .catch(() => {
        if (alive) setHasLocalSubscription(false);
      });
    return () => {
      alive = false;
    };
  }, [settings.pushSubscriptions]);

  const handleCheckConfig = async () => {
    setIsBusy(true);
    setStatus('בודק הגדרת Web Push...');
    try {
      const result = await fetchPushConfig(settings);
      if (!result.ok) {
        setStatus(result.error || 'בדיקת Web Push נכשלה.');
        return;
      }
      setStatus(result.configured
        ? `Web Push מוכן. מכשירים רשומים בענן: ${result.subscriptionCount ?? registeredCount}.`
        : 'חסרים WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY ב-Cloudflare.'
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'בדיקת Web Push נכשלה.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleEnable = async () => {
    setIsBusy(true);
    setStatus('מבקש הרשאה ורושם את המכשיר...');
    try {
      const result = await enablePushNotifications(settings);
      setHasLocalSubscription(Boolean(result.subscription?.endpoint));
      if (result.ok && result.subscription?.endpoint) {
        const now = new Date().toISOString();
        const current = settings.pushSubscriptions ?? [];
        const record = {
          endpoint: result.subscription.endpoint,
          keys: {
            p256dh: result.subscription.keys?.p256dh,
            auth: result.subscription.keys?.auth,
          },
          deviceLabel: 'Android PWA',
          userAgent: navigator.userAgent,
          createdAt: current.find((item) => item.endpoint === result.subscription?.endpoint)?.createdAt ?? now,
          updatedAt: now,
        };
        await onSaveSettings({
          pushSubscriptions: [
            record,
            ...current.filter((item) => item.endpoint && item.endpoint !== record.endpoint),
          ].slice(0, 10),
        });
      }
      setStatus(result.ok ? 'המכשיר נרשם להתראות. עכשיו אפשר לשלוח בדיקה.' : (result.error || 'הרשמת המכשיר נכשלה.'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'הרשמת המכשיר נכשלה.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleTest = async () => {
    setIsBusy(true);
    setStatus('שולח התראת בדיקה לטלפון...');
    try {
      const result = await sendTestPushNotification(settings);
      setStatus(result.ok ? 'נשלחה התראת בדיקה. אם לא ראית אותה, בדוק הרשאות התראה של Chrome / האפליקציה.' : (result.error || 'שליחת בדיקה נכשלה.'));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'שליחת בדיקה נכשלה.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <SectionCard
      title="התראות בטלפון"
      description="Web Push לאנדרואיד דרך ה-PWA. השלב הראשון רושם את המכשיר ושולח בדיקת Push אמיתית."
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-xs font-bold text-slate-500">תמיכה במכשיר</p>
          <p className="mt-1 text-lg font-black text-slate-950">{capability.supported ? 'נתמך' : 'לא נתמך'}</p>
          {capability.reason ? <p className="mt-1 text-xs font-bold text-rose-700">{capability.reason}</p> : null}
        </div>
        <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100">
          <p className="text-xs font-bold text-sky-700">הרשאת דפדפן</p>
          <p className="mt-1 text-lg font-black text-sky-950">{permissionLabel(capability.permission)}</p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
          <p className="text-xs font-bold text-emerald-700">מכשירים רשומים</p>
          <p className="mt-1 text-lg font-black text-emerald-950">{registeredCount}</p>
          <p className="mt-1 text-xs font-bold text-emerald-700">{hasLocalSubscription ? 'המכשיר הזה רשום' : 'המכשיר הזה עוד לא רשום'}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={isBusy} className="rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-slate-800 ring-1 ring-slate-200 disabled:opacity-50" onClick={handleCheckConfig}>
          בדוק הגדרה
        </button>
        <button type="button" disabled={isBusy || !capability.supported} className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" onClick={handleEnable}>
          הפעל התראות בטלפון
        </button>
        <button type="button" disabled={isBusy || !hasLocalSubscription} className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" onClick={handleTest}>
          שלח בדיקת Push
        </button>
      </div>

      {status ? (
        <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200">
          {status}
        </p>
      ) : null}
    </SectionCard>
  );
}
