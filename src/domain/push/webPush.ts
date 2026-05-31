import type { AppSettings, PushSubscriptionRecord } from '../settings/settingsTypes';

interface PushConfigResponse {
  ok: boolean;
  configured?: boolean;
  publicKey?: string;
  subscriptionCount?: number;
  error?: string;
}

interface PushActionResponse {
  ok: boolean;
  status?: number;
  statusText?: string;
  subscriptionCount?: number;
  error?: string;
}

export interface PushCapabilityStatus {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  reason?: string;
}

function getPushEndpoint(settings: AppSettings | null | undefined): string {
  const base = settings?.morningBriefing?.androidPublishEndpoint?.trim() || '/api/morning-briefing';
  if (base.includes('/api/morning-briefing')) return base.replace('/api/morning-briefing', '/api/push-subscriptions');
  if (base.includes('/api/sync-state')) return base.replace('/api/sync-state', '/api/push-subscriptions');
  if (base.includes('/api/push-subscriptions')) return base;
  return '/api/push-subscriptions';
}

function getToken(settings: AppSettings | null | undefined): string {
  return settings?.morningBriefing?.androidPublishToken?.trim() || '';
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function getDeviceLabel(): string {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ? 'PWA' : 'Browser';
  const platform = navigator.userAgent.includes('Android') ? 'Android' : navigator.platform || 'Device';
  return `${platform} ${standalone}`;
}

async function postPushAction(
  settings: AppSettings,
  action: 'subscribe' | 'test',
  subscription?: PushSubscriptionJSON,
): Promise<PushActionResponse> {
  const token = getToken(settings);
  if (!token) return { ok: false, error: 'חסר Token בהגדרות Cloud / Android.' };

  const response = await fetch(getPushEndpoint(settings), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      token,
      action,
      subscription,
      device: {
        label: getDeviceLabel(),
        userAgent: navigator.userAgent,
      },
    }),
  });
  const body = await response.json().catch(() => null) as PushActionResponse | null;
  return body ?? { ok: response.ok, status: response.status, statusText: response.statusText };
}

export function getPushCapabilityStatus(): PushCapabilityStatus {
  if (typeof window === 'undefined') return { supported: false, permission: 'unsupported', reason: 'אין סביבת דפדפן.' };
  if (!('Notification' in window)) return { supported: false, permission: 'unsupported', reason: 'הדפדפן לא תומך Notifications.' };
  if (!('serviceWorker' in navigator)) return { supported: false, permission: Notification.permission, reason: 'אין Service Worker.' };
  if (!('PushManager' in window)) return { supported: false, permission: Notification.permission, reason: 'אין PushManager בדפדפן הזה.' };
  return { supported: true, permission: Notification.permission };
}

export async function fetchPushConfig(settings: AppSettings): Promise<PushConfigResponse> {
  const token = getToken(settings);
  if (!token) return { ok: false, configured: false, error: 'חסר Token בהגדרות Cloud / Android.' };
  const endpoint = getPushEndpoint(settings);
  const separator = endpoint.includes('?') ? '&' : '?';
  const response = await fetch(`${endpoint}${separator}token=${encodeURIComponent(token)}`, { cache: 'no-store' });
  const body = await response.json().catch(() => null) as PushConfigResponse | null;
  return body ?? { ok: false, configured: false, error: `Push API החזיר ${response.status}` };
}

export async function getCurrentPushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription?.toJSON() ?? null;
}

export async function enablePushNotifications(settings: AppSettings): Promise<PushActionResponse & { subscription?: PushSubscriptionJSON }> {
  const capability = getPushCapabilityStatus();
  if (!capability.supported) return { ok: false, error: capability.reason || 'Push לא נתמך במכשיר הזה.' };

  const config = await fetchPushConfig(settings);
  if (!config.ok || !config.configured || !config.publicKey) {
    return { ok: false, error: config.error || 'חסרים WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY ב-Cloudflare.' };
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, error: 'לא ניתנה הרשאה להתראות במכשיר.' };

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(config.publicKey),
  });

  const json = subscription.toJSON();
  const result = await postPushAction(settings, 'subscribe', json);
  return { ...result, subscription: json };
}

export async function sendTestPushNotification(settings: AppSettings): Promise<PushActionResponse> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription?.endpoint) return { ok: false, error: 'המכשיר עדיין לא רשום להתראות. לחץ קודם הפעל התראות.' };
  return postPushAction(settings, 'test', subscription);
}

export function countPushSubscriptions(settings: AppSettings | null | undefined): number {
  return settings?.pushSubscriptions?.filter((item: PushSubscriptionRecord) => item.endpoint).length ?? 0;
}
