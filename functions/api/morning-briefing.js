const json = (body, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

const cleanEnv = (env, name) => {
  const value = env?.[name];
  return typeof value === 'string' ? value.trim() : '';
};

const requireConfig = (env) => {
  const supabaseUrl = cleanEnv(env, 'SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = cleanEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const token = cleanEnv(env, 'MORNING_BRIEFING_TOKEN');
  const workspaceId = cleanEnv(env, 'MISSION_CONTROL_WORKSPACE_ID') || 'miki';
  if (!supabaseUrl || !serviceKey || !token) {
    return { ok: false, error: 'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / MORNING_BRIEFING_TOKEN' };
  }
  return { ok: true, supabaseUrl, serviceKey, token, workspaceId };
};

const verifyToken = (expected, received) => Boolean(received && expected && received === expected);

const supabaseHeaders = (serviceKey) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation,resolution=merge-duplicates',
});

const getAndroidUrl = (request, env, token) => {
  const explicit = cleanEnv(env, 'PUBLIC_APP_URL');
  const base = explicit || new URL(request.url).origin;
  return `${base.replace(/\/$/, '')}/api/morning-briefing?token=${encodeURIComponent(token)}`;
};

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

  const urlObj = new URL(request.url);
  const token = urlObj.searchParams.get('token');
  if (!verifyToken(config.token, token)) return json({ ok: false, error: 'Unauthorized' }, 401);

  const date = urlObj.searchParams.get('date');
  const filters = [`workspace_id=eq.${encodeURIComponent(config.workspaceId)}`];
  if (date) filters.push(`date=eq.${encodeURIComponent(date)}`);
  const url = `${config.supabaseUrl}/rest/v1/morning_briefings?${filters.join('&')}&select=date,text,alarm_time,ringtone_url,created_at,updated_at&order=date.desc,updated_at.desc&limit=1`;

  const response = await fetch(url, { headers: supabaseHeaders(config.serviceKey) });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return json({ ok: false, error: rows?.message || 'Supabase read failed' }, response.status);

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return json({ ok: false, error: 'No morning briefing found' }, 404);

  return json({
    ok: true,
    date: row.date,
    alarmTime: row.alarm_time,
    ringtoneUrl: row.ringtone_url,
    text: row.text,
    updatedAt: row.updated_at,
  });
}

export async function onRequestPost({ request, env }) {
  const config = requireConfig(env);
  if (!config.ok) return json({ ok: false, error: config.error }, 500);

  const body = await request.json().catch(() => ({}));
  const auth = request.headers.get('authorization') || '';
  const headerToken = auth.replace(/^Bearer\s+/i, '');
  const suppliedToken = body?.token || headerToken;
  if (!verifyToken(config.token, suppliedToken)) return json({ ok: false, error: 'Unauthorized' }, 401);

  const text = String(body?.text || '').trim();
  if (!text) return json({ ok: false, error: 'Missing briefing text' }, 400);

  const date = String(body?.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const alarmTime = String(body?.alarmTime || '07:00').slice(0, 5);
  const ringtoneUrl = String(body?.ringtoneUrl || '').trim();

  const payload = [{
    workspace_id: config.workspaceId,
    date,
    text,
    alarm_time: alarmTime,
    ringtone_url: ringtoneUrl,
    status: 'published',
    source: body?.source || 'mission-control',
    app_version: body?.appVersion || null,
    updated_at: new Date().toISOString(),
  }];

  const supabaseUrl = `${config.supabaseUrl}/rest/v1/morning_briefings?on_conflict=workspace_id,date`;
  const response = await fetch(supabaseUrl, {
    method: 'POST',
    headers: supabaseHeaders(config.serviceKey),
    body: JSON.stringify(payload),
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return json({ ok: false, error: rows?.message || 'Supabase write failed' }, response.status);

  return json({
    ok: true,
    date,
    alarmTime,
    ringtoneUrl,
    url: getAndroidUrl(request, env, config.token),
    row: Array.isArray(rows) ? rows[0] : rows,
  });
}
