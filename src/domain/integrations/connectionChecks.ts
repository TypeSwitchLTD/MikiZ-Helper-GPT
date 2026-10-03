import type { AppSettings } from '../settings/settingsTypes';

export type ConnectionState = 'empty' | 'checking' | 'ok' | 'error';

export interface ConnectionResult {
  id: string;
  label: string;
  state: ConnectionState;
  detail?: string;
  checkedAt?: string;
}

export type ConnectionId =
  | 'cloud'
  | 'elevenlabs'
  | 'instantly'
  | 'meta_token'
  | 'meta_ads'
  | 'meta_pixel'
  | 'shopify'
  | 'analytics';

function cloudToken(settings: AppSettings | null): string {
  return settings?.morningBriefing?.androidPublishToken?.trim() ?? '';
}

async function postJson(url: string, token: string, body: unknown, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    return { httpOk: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url: string, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { 'Cache-Control': 'no-store' }, signal: controller.signal });
    const data = await response.json().catch(() => null);
    return { httpOk: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

const empty = (id: ConnectionId, label: string, detail = 'לא הוגדר'): ConnectionResult =>
  ({ id, label, state: 'empty', detail });

/**
 * A 200 with no JSON body means the Worker never ran — in dev Vite answers
 * every unknown path with index.html. Saying "error 200" helps nobody.
 */
function describeFailure(data: unknown, status: number): string {
  const payload = data as { error?: string } | null;
  if (payload?.error) return payload.error;
  if (data === null) return status === 200 ? 'ה-API לא זמין (אין Worker)' : `שגיאה ${status}`;
  return `שגיאה ${status}`;
}

const ok = (id: ConnectionId, label: string, detail: string): ConnectionResult =>
  ({ id, label, state: 'ok', detail, checkedAt: new Date().toISOString() });

const fail = (id: ConnectionId, label: string, detail: string): ConnectionResult =>
  ({ id, label, state: 'error', detail, checkedAt: new Date().toISOString() });

/**
 * Each check hits the real service. A filled-in field is never reported green
 * on its own — the call has to come back clean.
 */
export async function checkConnection(id: ConnectionId, settings: AppSettings | null): Promise<ConnectionResult> {
  const token = cloudToken(settings);

  try {
    switch (id) {
      case 'cloud': {
        if (!token) return empty('cloud', 'Cloud Sync', 'חסר Token');
        const { httpOk, data, status } = await getJson(`/api/sync-state?token=${encodeURIComponent(token)}`);
        if (!httpOk || !data?.ok) return fail('cloud', 'Cloud Sync', describeFailure(data, status));
        const tasks = data?.counts?.tasks ?? 0;
        return ok('cloud', 'Cloud Sync', `מחובר · ${tasks} משימות בענן`);
      }

      case 'elevenlabs': {
        const key = settings?.voice?.elevenLabsApiKey?.trim() ?? '';
        if (!key) return empty('elevenlabs', 'ElevenLabs');
        if (!token) return fail('elevenlabs', 'ElevenLabs', 'חסר Cloud Token לבדיקה');
        const { httpOk, data, status } = await postJson('/api/tts', token, { action: 'voices' });
        if (!httpOk || data?.ok === false) return fail('elevenlabs', 'ElevenLabs', describeFailure(data, status));
        return ok('elevenlabs', 'ElevenLabs', 'מפתח תקין');
      }

      case 'instantly': {
        const key = settings?.instantly?.apiKey?.trim() ?? '';
        if (!key) return empty('instantly', 'Instantly.AI');
        if (!token) return fail('instantly', 'Instantly.AI', 'חסר Cloud Token לבדיקה');
        const { httpOk, data, status } = await postJson('/api/instantly-stats', token, { apiKey: key });
        if (!httpOk || data?.ok === false) return fail('instantly', 'Instantly.AI', describeFailure(data, status));
        return ok('instantly', 'Instantly.AI', 'מחובר');
      }

      case 'meta_token': {
        const accessToken = settings?.meta?.accessToken?.trim() ?? '';
        if (!accessToken) return empty('meta_token', 'Meta — חיבור');
        if (!token) return fail('meta_token', 'Meta — חיבור', 'חסר Cloud Token לבדיקה');
        const { httpOk, data, status } = await postJson('/api/meta-proxy', token, { action: 'token_debug', accessToken });
        if (!httpOk || !data?.ok) return fail('meta_token', 'Meta — חיבור', describeFailure(data, status));
        if (!data.valid) return fail('meta_token', 'Meta — חיבור', 'הטוקן פג — צריך לחבר מחדש');
        const expiry = data.expiresAt ? ` · עד ${String(data.expiresAt).slice(0, 10)}` : '';
        if (!data.hasAdsRead) return fail('meta_token', 'Meta — חיבור', `חסרה הרשאת ads_read${expiry}`);
        return ok('meta_token', 'Meta — חיבור', `תקין · ads_read${expiry}`);
      }

      case 'meta_ads': {
        const accessToken = settings?.meta?.accessToken?.trim() ?? '';
        const adAccountId = settings?.meta?.adAccountId?.trim() ?? '';
        if (!adAccountId) return empty('meta_ads', 'Meta Ads', 'חסר Ad Account ID');
        if (!accessToken) return fail('meta_ads', 'Meta Ads', 'אין טוקן מטא');
        if (!token) return fail('meta_ads', 'Meta Ads', 'חסר Cloud Token לבדיקה');
        const { httpOk, data, status } = await postJson('/api/meta-proxy', token, {
          action: 'ads_insights', accessToken, adAccountId, datePreset: 'last_7d',
        });
        if (!httpOk || !data?.ok) return fail('meta_ads', 'Meta Ads', describeFailure(data, status));
        return ok('meta_ads', 'Meta Ads', `${data.rows?.length ?? 0} קמפיינים ב-7 ימים`);
      }

      case 'meta_pixel': {
        const accessToken = settings?.meta?.accessToken?.trim() ?? '';
        const pixelId = settings?.meta?.pixelId?.trim() ?? '';
        if (!pixelId) return empty('meta_pixel', 'Meta Pixel', 'חסר Pixel ID');
        if (!accessToken) return fail('meta_pixel', 'Meta Pixel', 'אין טוקן מטא');
        if (!token) return fail('meta_pixel', 'Meta Pixel', 'חסר Cloud Token לבדיקה');
        const { httpOk, data, status } = await postJson('/api/meta-proxy', token, { action: 'pixel_stats', accessToken, pixelId });
        if (!httpOk || !data?.ok) return fail('meta_pixel', 'Meta Pixel', describeFailure(data, status));
        if (data.pixel?.unavailable) return fail('meta_pixel', 'Meta Pixel', 'הפיקסל לא זמין');
        const last = data.pixel?.lastFiredTime ? String(data.pixel.lastFiredTime).slice(0, 10) : null;
        return ok('meta_pixel', 'Meta Pixel', last ? `אירוע אחרון ${last}` : 'מחובר');
      }

      case 'shopify': {
        const domain = settings?.shopify?.shopDomain?.trim() ?? '';
        const adminToken = settings?.shopify?.adminAccessToken?.trim() ?? '';
        if (!domain && !adminToken) return empty('shopify', 'Shopify');
        if (!domain || !adminToken) return fail('shopify', 'Shopify', 'חסר דומיין או Token');
        if (!token) return fail('shopify', 'Shopify', 'חסר Cloud Token לבדיקה');
        const { httpOk, data, status } = await postJson('/api/shopify-stats', token, { shopDomain: domain, adminAccessToken: adminToken });
        if (!httpOk || data?.ok === false) return fail('shopify', 'Shopify', describeFailure(data, status));
        return ok('shopify', 'Shopify', 'מחובר');
      }

      case 'analytics': {
        const ga = settings?.googleAnalytics;
        const propertyId = ga?.propertyId?.trim() ?? '';
        if (!propertyId) return empty('analytics', 'Google Analytics');
        if (!token) return fail('analytics', 'Google Analytics', 'חסר Cloud Token לבדיקה');
        const { httpOk, data, status } = await postJson('/api/google-analytics-stats', token, { propertyId });
        if (!httpOk || data?.ok === false) return fail('analytics', 'Google Analytics', describeFailure(data, status));
        return ok('analytics', 'Google Analytics', 'מחובר');
      }

      default:
        return fail(id, id, 'בדיקה לא מוכרת');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה לא ידועה';
    return fail(id, id, message.includes('abort') ? 'timeout' : message);
  }
}

export const ALL_CONNECTIONS: ConnectionId[] = [
  'cloud',
  'meta_token',
  'meta_ads',
  'meta_pixel',
  'instantly',
  'elevenlabs',
  'shopify',
  'analytics',
];

export async function checkAllConnections(settings: AppSettings | null): Promise<ConnectionResult[]> {
  return Promise.all(ALL_CONNECTIONS.map((id) => checkConnection(id, settings)));
}
