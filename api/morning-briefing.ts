const json = (res: any, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

const getEnv = (name: string) => {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
};

const readBody = async (req: any): Promise<any> => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => { raw += chunk.toString('utf8'); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
};

const requireConfig = () => {
  const supabaseUrl = getEnv('SUPABASE_URL').replace(/\/$/, '');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const token = getEnv('MORNING_BRIEFING_TOKEN');
  if (!supabaseUrl || !serviceKey || !token) {
    return { ok: false as const, error: 'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / MORNING_BRIEFING_TOKEN' };
  }
  return { ok: true as const, supabaseUrl, serviceKey, token };
};

const verifyToken = (expected: string, received: string | undefined | null) => {
  return Boolean(received && expected && received === expected);
};

const supabaseHeaders = (serviceKey: string) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation,resolution=merge-duplicates',
});

export default async function handler(req: any, res: any) {
  const config = requireConfig();
  if (!config.ok) return json(res, 500, { ok: false, error: config.error });

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === 'GET') {
    const queryToken = req.query?.token;
    const token = Array.isArray(queryToken) ? queryToken[0] : queryToken;
    if (!verifyToken(config.token, token)) return json(res, 401, { ok: false, error: 'Unauthorized' });

    const queryDate = req.query?.date;
    const date = Array.isArray(queryDate) ? queryDate[0] : queryDate;
    const filter = date ? `date=eq.${encodeURIComponent(date)}&` : '';
    const url = `${config.supabaseUrl}/rest/v1/morning_briefings?${filter}select=date,text,alarm_time,ringtone_url,created_at,updated_at&order=date.desc,updated_at.desc&limit=1`;
    const response = await fetch(url, { headers: supabaseHeaders(config.serviceKey) });
    const rows = await response.json().catch(() => []);
    if (!response.ok) return json(res, response.status, { ok: false, error: rows?.message || 'Supabase read failed' });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return json(res, 404, { ok: false, error: 'No morning briefing found' });
    return json(res, 200, {
      ok: true,
      date: row.date,
      alarmTime: row.alarm_time,
      ringtoneUrl: row.ringtone_url,
      text: row.text,
      updatedAt: row.updated_at,
    });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const headerToken = req.headers?.authorization?.replace(/^Bearer\s+/i, '');
    const suppliedToken = body?.token || headerToken;
    if (!verifyToken(config.token, suppliedToken)) return json(res, 401, { ok: false, error: 'Unauthorized' });

    const text = String(body?.text || '').trim();
    if (!text) return json(res, 400, { ok: false, error: 'Missing briefing text' });
    const date = String(body?.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const alarmTime = String(body?.alarmTime || '07:00').slice(0, 5);
    const ringtoneUrl = String(body?.ringtoneUrl || '').trim();

    const payload = [{
      date,
      text,
      alarm_time: alarmTime,
      ringtone_url: ringtoneUrl,
      status: 'published',
      source: body?.source || 'mission-control',
      app_version: body?.appVersion || null,
      updated_at: new Date().toISOString(),
    }];

    const url = `${config.supabaseUrl}/rest/v1/morning_briefings?on_conflict=date`;
    const response = await fetch(url, {
      method: 'POST',
      headers: supabaseHeaders(config.serviceKey),
      body: JSON.stringify(payload),
    });
    const rows = await response.json().catch(() => []);
    if (!response.ok) return json(res, response.status, { ok: false, error: rows?.message || 'Supabase write failed' });

    const baseUrl = getEnv('PUBLIC_APP_URL') || `https://${req.headers.host}`;
    const androidUrl = `${baseUrl.replace(/\/$/, '')}/api/morning-briefing?token=${encodeURIComponent(config.token)}`;
    return json(res, 200, { ok: true, date, alarmTime, ringtoneUrl, url: androidUrl, row: Array.isArray(rows) ? rows[0] : rows });
  }

  return json(res, 405, { ok: false, error: 'Method not allowed' });
}
