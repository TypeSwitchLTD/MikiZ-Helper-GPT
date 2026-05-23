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

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return json({});

  const authHeader = request.headers.get('authorization') || '';
  const mcToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const expectedToken = (env.MORNING_BRIEFING_TOKEN || '').trim();
  if (!expectedToken || mcToken !== expectedToken) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  let body = {};
  try { body = await request.json(); } catch { /* empty body ok */ }

  const instantlyKey = body.instantlyApiKey || '';
  if (!instantlyKey) return json({ ok: false, error: 'Missing instantlyApiKey' }, 400);

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

  const headers = {
    Authorization: `Bearer ${instantlyKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const [campaignsRes, analyticsRes] = await Promise.all([
      fetch('https://api.instantly.ai/api/v2/campaigns?limit=20&status=active', { headers }),
      fetch(`https://api.instantly.ai/api/v2/analytics/overview?start_date=${weekAgo}&end_date=${today}`, { headers }),
    ]);

    const campaigns = campaignsRes.ok ? await campaignsRes.json().catch(() => null) : null;
    const analytics = analyticsRes.ok ? await analyticsRes.json().catch(() => null) : null;

    // Also fetch today-only analytics
    const todayRes = await fetch(
      `https://api.instantly.ai/api/v2/analytics/overview?start_date=${today}&end_date=${today}`,
      { headers },
    );
    const todayAnalytics = todayRes.ok ? await todayRes.json().catch(() => null) : null;

    return json({
      ok: true,
      campaigns: {
        total: campaigns?.total ?? campaigns?.data?.length ?? 0,
        active: campaigns?.data?.length ?? 0,
        list: (campaigns?.data ?? []).slice(0, 5).map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
        })),
      },
      analytics: {
        sent: analytics?.data?.emails_sent_count ?? 0,
        opened: analytics?.data?.open_count ?? 0,
        replied: analytics?.data?.reply_count ?? 0,
        openRate: analytics?.data?.open_rate ?? 0,
        replyRate: analytics?.data?.reply_rate ?? 0,
      },
      today: {
        sent: todayAnalytics?.data?.emails_sent_count ?? 0,
        opened: todayAnalytics?.data?.open_count ?? 0,
        replied: todayAnalytics?.data?.reply_count ?? 0,
        newLeads: todayAnalytics?.data?.new_leads_contacted_count ?? 0,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return json({ ok: false, error: error?.message ?? 'Instantly.AI request failed' }, 502);
  }
}
