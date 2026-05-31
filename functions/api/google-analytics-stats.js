const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

function readBearer(request) {
  const auth = request.headers.get('authorization') || '';
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

function base64Url(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem) {
  const clean = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function createJwt(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claimSet))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function getAccessToken(env) {
  const clientEmail = String(env.GOOGLE_ANALYTICS_CLIENT_EMAIL || '').trim();
  const privateKey = String(env.GOOGLE_ANALYTICS_PRIVATE_KEY || '').trim();
  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_ANALYTICS_CLIENT_EMAIL / GOOGLE_ANALYTICS_PRIVATE_KEY');
  }
  const assertion = await createJwt(clientEmail, privateKey);
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `Google token request failed (${response.status})`);
  }
  return data.access_token;
}

async function runReport(accessToken, propertyId, payload) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || `GA4 report failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

function metricValue(report, index) {
  const value = report?.rows?.[0]?.metricValues?.[index]?.value;
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function channelRows(report) {
  return (report?.rows || []).slice(0, 8).map((row) => ({
    channel: row.dimensionValues?.[0]?.value || 'Unassigned',
    sessions: Number(row.metricValues?.[0]?.value || 0),
    users: Number(row.metricValues?.[1]?.value || 0),
  }));
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return json({});
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const expectedToken = (env.MORNING_BRIEFING_TOKEN || '').trim();
  const mcToken = readBearer(request);
  if (!expectedToken || mcToken !== expectedToken) return json({ ok: false, error: 'Unauthorized' }, 401);

  const body = await request.json().catch(() => ({}));
  const propertyId = String(body.propertyId || '').trim().replace(/^properties\//, '');
  if (!/^\d+$/.test(propertyId)) return json({ ok: false, error: 'Invalid or missing GA4 propertyId' }, 400);

  try {
    const accessToken = await getAccessToken(env);
    let overview;
    try {
      overview = await runReport(accessToken, propertyId, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
          { name: 'conversions' },
          { name: 'totalRevenue' },
        ],
      });
    } catch {
      overview = await runReport(accessToken, propertyId, {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
        ],
      });
    }

    const today = await runReport(accessToken, propertyId, {
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
    });

    const channels = await runReport(accessToken, propertyId, {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 8,
    });

    return json({
      ok: true,
      propertyId,
      checkedAt: new Date().toISOString(),
      metrics: {
        sessions7d: metricValue(overview, 0),
        users7d: metricValue(overview, 1),
        pageViews7d: metricValue(overview, 2),
        conversions7d: metricValue(overview, 3),
        revenue7d: metricValue(overview, 4),
        sessionsToday: metricValue(today, 0),
        usersToday: metricValue(today, 1),
      },
      channels: channelRows(channels),
    });
  } catch (error) {
    return json({ ok: false, error: error?.message || 'Google Analytics request failed' }, 502);
  }
}
