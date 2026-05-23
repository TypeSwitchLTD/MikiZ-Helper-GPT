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

const cleanEnv = (env, key) => (env && typeof env[key] === 'string' ? env[key].trim() : '');
const safeIdent = (value) => typeof value === 'string' && /^[A-Za-z0-9_]+$/.test(value.trim());

function readConfig(env) {
  const supabaseUrl = cleanEnv(env, 'SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = cleanEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const token = cleanEnv(env, 'MORNING_BRIEFING_TOKEN');
  if (!supabaseUrl || !serviceKey || !token) {
    return { ok: false, error: 'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / MORNING_BRIEFING_TOKEN' };
  }
  return { ok: true, supabaseUrl, serviceKey, token };
}

function authToken(request, body) {
  const auth = request.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const url = new URL(request.url);
  return body?.token || url.searchParams.get('token') || '';
}

const supabaseHeaders = (serviceKey) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  Prefer: 'count=exact',
});

async function countRows(config, table, query) {
  const url = `${config.supabaseUrl}/rest/v1/${table}?select=*&limit=1${query ? `&${query}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: supabaseHeaders(config.serviceKey),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Supabase count failed (${response.status})`);
  }
  const contentRange = response.headers.get('content-range') || '';
  const match = contentRange.match(/\/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function nextISODate(dateISO) {
  const date = new Date(`${dateISO}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function handle(request, env) {
  const config = readConfig(env);
  if (!config.ok) return json({ ok: false, error: config.error }, 500);

  let body = {};
  if (request.method === 'POST') {
    body = await request.json().catch(() => ({}));
  }

  const incomingToken = authToken(request, body);
  if (!incomingToken || incomingToken !== config.token) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const tables = Array.isArray(body.tables) ? body.tables.slice(0, 8) : [];
  const todayISO = typeof body.todayISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.todayISO)
    ? body.todayISO
    : new Date().toISOString().slice(0, 10);
  const checkedAt = new Date().toISOString();
  const tomorrowISO = nextISODate(todayISO);

  const results = [];
  for (const item of tables) {
    const id = String(item?.id || item?.table || '').slice(0, 80);
    const label = String(item?.label || item?.table || 'Supabase table').slice(0, 120);
    const project = String(item?.project || '').slice(0, 80);
    const table = String(item?.table || '').trim();
    const dateColumn = String(item?.dateColumn || 'created_at').trim();
    const lastCheckedAt = typeof item?.lastCheckedAt === 'string' ? item.lastCheckedAt : null;

    if (!table) {
      results.push({ id, label, project, table, dateColumn, ok: false, skipped: true, error: 'missing_table_name' });
      continue;
    }
    if (!safeIdent(table) || !safeIdent(dateColumn)) {
      results.push({ id, label, project, table, dateColumn, ok: false, error: 'invalid_table_or_date_column' });
      continue;
    }

    try {
      const todayQuery = `${dateColumn}=gte.${encodeURIComponent(todayISO)}&${dateColumn}=lt.${encodeURIComponent(tomorrowISO)}`;
      const sinceQuery = lastCheckedAt ? `${dateColumn}=gt.${encodeURIComponent(lastCheckedAt)}` : null;
      const [total, today, sinceLast] = await Promise.all([
        countRows(config, table, ''),
        countRows(config, table, todayQuery),
        sinceQuery ? countRows(config, table, sinceQuery) : Promise.resolve(0),
      ]);
      results.push({
        id,
        label,
        project,
        table,
        dateColumn,
        ok: true,
        total,
        today,
        sinceLast,
        lastCheckedAt,
        checkedAt,
      });
    } catch (error) {
      results.push({
        id,
        label,
        project,
        table,
        dateColumn,
        ok: false,
        error: error?.message || 'unknown_error',
      });
    }
  }

  return json({ ok: true, todayISO, checkedAt, results });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  return handle(request, env);
}
