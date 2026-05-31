const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  },
});

const cleanEnv = (env, name) => {
  const value = env?.[name];
  return typeof value === 'string' ? value.trim() : '';
};

const requireConfig = (env) => {
  const supabaseUrl = cleanEnv(env, 'SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = cleanEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const token = cleanEnv(env, 'MORNING_BRIEFING_TOKEN');
  const workspaceId = cleanEnv(env, 'MISSION_CONTROL_WORKSPACE_ID') || 'miki';
  const publicKey = cleanEnv(env, 'WEB_PUSH_PUBLIC_KEY');
  const privateKey = cleanEnv(env, 'WEB_PUSH_PRIVATE_KEY');
  const subject = cleanEnv(env, 'WEB_PUSH_SUBJECT') || 'mailto:admin@mission-control.local';

  if (!supabaseUrl || !serviceKey || !token) {
    return { ok: false, error: 'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / MORNING_BRIEFING_TOKEN' };
  }

  return { ok: true, supabaseUrl, serviceKey, token, workspaceId, publicKey, privateKey, subject };
};

const verifyToken = (expected, received) => Boolean(received && expected && received === expected);

const supabaseHeaders = (serviceKey, prefer = 'return=representation,resolution=merge-duplicates') => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: prefer,
});

const base64UrlToBytes = (value) => {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from([...binary].map((char) => char.charCodeAt(0)));
};

const bytesToBase64Url = (bytes) => {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

async function restFetch(config, path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || body?.error || `Supabase request failed: ${response.status}`);
  }
  return body;
}

async function readSettings(config) {
  const rows = await restFetch(
    config,
    `app_settings?workspace_id=eq.${encodeURIComponent(config.workspaceId)}&id=eq.default&select=settings&limit=1`,
    { headers: supabaseHeaders(config.serviceKey) },
  );
  return Array.isArray(rows) ? rows[0]?.settings || null : null;
}

async function writeSettings(config, settings) {
  await restFetch(config, 'app_settings?on_conflict=id', {
    method: 'POST',
    headers: supabaseHeaders(config.serviceKey, 'return=minimal,resolution=merge-duplicates'),
    body: JSON.stringify([{ id: 'default', workspace_id: config.workspaceId, settings, updated_at: new Date().toISOString() }]),
  });
}

function normalizeSubscription(subscription, device = {}) {
  const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint : '';
  if (!endpoint) return null;
  const keys = subscription.keys && typeof subscription.keys === 'object' ? subscription.keys : {};
  const now = new Date().toISOString();
  return {
    endpoint,
    keys: {
      p256dh: typeof keys.p256dh === 'string' ? keys.p256dh : '',
      auth: typeof keys.auth === 'string' ? keys.auth : '',
    },
    deviceLabel: typeof device.label === 'string' ? device.label.slice(0, 120) : 'Android PWA',
    userAgent: typeof device.userAgent === 'string' ? device.userAgent.slice(0, 500) : '',
    createdAt: now,
    updatedAt: now,
  };
}

function mergeSubscription(settings, subscription) {
  const current = Array.isArray(settings?.pushSubscriptions) ? settings.pushSubscriptions : [];
  const existing = current.find((item) => item.endpoint === subscription.endpoint);
  const nextSubscription = existing
    ? { ...existing, ...subscription, createdAt: existing.createdAt || subscription.createdAt, updatedAt: subscription.updatedAt }
    : subscription;
  const next = [
    nextSubscription,
    ...current.filter((item) => item.endpoint && item.endpoint !== subscription.endpoint),
  ].slice(0, 10);
  return { ...settings, pushSubscriptions: next };
}

function getAudience(endpoint) {
  const url = new URL(endpoint);
  return `${url.protocol}//${url.host}`;
}

function parsePublicKey(publicKey) {
  const bytes = base64UrlToBytes(publicKey);
  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw new Error('WEB_PUSH_PUBLIC_KEY must be an uncompressed P-256 public key');
  }
  return {
    x: bytesToBase64Url(bytes.slice(1, 33)),
    y: bytesToBase64Url(bytes.slice(33, 65)),
  };
}

function derToJose(signature) {
  const bytes = new Uint8Array(signature);
  if (bytes.length === 64) return bytes;
  if (bytes[0] !== 0x30) throw new Error('Unexpected ECDSA signature format');

  let offset = 2;
  if (bytes[1] & 0x80) offset = 2 + (bytes[1] & 0x7f);
  if (bytes[offset] !== 0x02) throw new Error('Unexpected ECDSA R marker');
  const rLength = bytes[offset + 1];
  let r = bytes.slice(offset + 2, offset + 2 + rLength);
  offset += 2 + rLength;
  if (bytes[offset] !== 0x02) throw new Error('Unexpected ECDSA S marker');
  const sLength = bytes[offset + 1];
  let s = bytes.slice(offset + 2, offset + 2 + sLength);
  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);
  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return out;
}

async function createVapidJwt(config, audience) {
  const { x, y } = parsePublicKey(config.publicKey);
  const privateBytes = base64UrlToBytes(config.privateKey);
  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x,
      y,
      d: bytesToBase64Url(privateBytes),
      ext: false,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: config.subject,
  })));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${bytesToBase64Url(derToJose(signature))}`;
}

async function sendEmptyPush(config, subscription) {
  if (!config.publicKey || !config.privateKey) {
    return { ok: false, error: 'Missing WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY' };
  }
  const jwt = await createVapidJwt(config, getAudience(subscription.endpoint));
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${config.publicKey}`,
      TTL: '60',
      Urgency: 'normal',
    },
  });
  return {
    ok: response.status === 201 || response.status === 202,
    status: response.status,
    statusText: response.statusText,
    error: response.ok ? undefined : await response.text().catch(() => 'Push endpoint rejected request'),
  };
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequestGet({ request, env }) {
  const config = requireConfig(env);
  if (!config.ok) return json({ ok: false, error: config.error }, 500);
  const token = new URL(request.url).searchParams.get('token');
  if (!verifyToken(config.token, token)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const settings = await readSettings(config);
    const subscriptions = Array.isArray(settings?.pushSubscriptions) ? settings.pushSubscriptions : [];
    return json({
      ok: true,
      configured: Boolean(config.publicKey && config.privateKey),
      publicKey: config.publicKey || '',
      subscriptionCount: subscriptions.filter((item) => item?.endpoint).length,
    });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Push config read failed' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const config = requireConfig(env);
  if (!config.ok) return json({ ok: false, error: config.error }, 500);
  const auth = request.headers.get('authorization') || '';
  const headerToken = auth.replace(/^Bearer\s+/i, '');
  const body = await request.json().catch(() => ({}));
  const token = body?.token || headerToken;
  if (!verifyToken(config.token, token)) return json({ ok: false, error: 'Unauthorized' }, 401);

  try {
    const action = body?.action || 'subscribe';
    const subscription = normalizeSubscription(body?.subscription, body?.device);
    if (!subscription) return json({ ok: false, error: 'Missing push subscription' }, 400);

    const settings = await readSettings(config);
    if (!settings) return json({ ok: false, error: 'Settings row not found. Run cloud sync first.' }, 404);
    const nextSettings = mergeSubscription(settings, subscription);
    await writeSettings(config, nextSettings);

    if (action === 'test') {
      const pushResult = await sendEmptyPush(config, subscription);
      return json({
        ...pushResult,
        subscriptionCount: nextSettings.pushSubscriptions.length,
      }, pushResult.ok ? 200 : 502);
    }

    return json({
      ok: true,
      subscriptionCount: nextSettings.pushSubscriptions.length,
      message: 'Push subscription saved',
    });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Push subscription write failed' }, 500);
  }
}
