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

function firstText(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function firstNumber(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizeLead(row, tableConfig) {
  const title =
    firstText(row, ['title', 'subject', 'name', 'full_name', 'company', 'email', 'phone', 'message']) ||
    `${tableConfig.label} lead`;
  const person = firstText(row, ['full_name', 'name', 'contact_name', 'first_name']);
  const company = firstText(row, ['company', 'company_name', 'organization', 'account']);
  const email = firstText(row, ['email', 'mail', 'contact_email']);
  const phone = firstText(row, ['phone', 'mobile', 'whatsapp', 'contact_phone']);
  const status = firstText(row, ['status', 'stage', 'pipeline_stage', 'lead_status']);
  const sourceUrl = firstText(row, ['url', 'source_url', 'link', 'profile_url', 'website']);
  const occurredAt = firstText(row, [tableConfig.dateColumn, 'created_at', 'updated_at']);
  const id = firstText(row, ['id', 'uuid', 'lead_id']) || `${tableConfig.table}-${occurredAt}-${title}`;

  return {
    id: String(id).slice(0, 160),
    source: 'supabase',
    sourceLabel: tableConfig.label,
    tableId: tableConfig.id,
    table: tableConfig.table,
    project: tableConfig.project,
    title: String(title).slice(0, 180),
    person: person || null,
    email: email || null,
    phone: phone || null,
    company: company || null,
    status: status || null,
    value: firstNumber(row, ['value', 'amount', 'deal_value', 'price', 'total']),
    sourceUrl: sourceUrl || null,
    occurredAt: occurredAt || null,
    raw: row,
  };
}

async function fetchRows(config, tableConfig) {
  const limit = Math.max(1, Math.min(Number(tableConfig.limit || 25), 50));
  const table = tableConfig.table.trim();
  const dateColumn = tableConfig.dateColumn.trim() || 'created_at';
  const url =
    `${config.supabaseUrl}/rest/v1/${table}` +
    `?select=*&order=${encodeURIComponent(dateColumn)}.desc&limit=${limit}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Supabase feed failed (${response.status})`);
  }
  return response.json();
}

async function handle(request, env) {
  const config = readConfig(env);
  if (!config.ok) return json({ ok: false, error: config.error }, 500);

  const body = await request.json().catch(() => ({}));
  const incomingToken = authToken(request, body);
  if (!incomingToken || incomingToken !== config.token) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const tables = Array.isArray(body.tables) ? body.tables.slice(0, 8) : [];
  const results = [];
  const items = [];

  for (const item of tables) {
    const tableConfig = {
      id: String(item?.id || item?.table || '').slice(0, 80),
      label: String(item?.label || item?.table || 'Supabase').slice(0, 120),
      project: String(item?.project || '').slice(0, 80),
      table: String(item?.table || '').trim(),
      dateColumn: String(item?.dateColumn || 'created_at').trim(),
      limit: item?.limit,
    };

    if (!tableConfig.table) {
      results.push({ ...tableConfig, ok: false, skipped: true, error: 'missing_table_name' });
      continue;
    }
    if (!safeIdent(tableConfig.table) || !safeIdent(tableConfig.dateColumn)) {
      results.push({ ...tableConfig, ok: false, error: 'invalid_table_or_date_column' });
      continue;
    }

    try {
      const rows = await fetchRows(config, tableConfig);
      const normalized = Array.isArray(rows) ? rows.map((row) => normalizeLead(row, tableConfig)) : [];
      items.push(...normalized);
      results.push({ ...tableConfig, ok: true, count: normalized.length });
    } catch (error) {
      results.push({ ...tableConfig, ok: false, error: error?.message || 'unknown_error' });
    }
  }

  items.sort((a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime());
  return json({ ok: true, checkedAt: new Date().toISOString(), results, items: items.slice(0, 80) });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-store',
      },
    });
  }
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  return handle(request, env);
}
