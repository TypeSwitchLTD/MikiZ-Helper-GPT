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

const GRAPH = 'https://graph.facebook.com/v19.0';

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

  const action = body.action || '';

  // ── Exchange auth code for access token ───────────────────────────────────
  if (action === 'exchange_code') {
    const { code, redirectUri } = body;
    const appId = env.FACEBOOK_APP_ID || '';
    const appSecret = env.FACEBOOK_APP_SECRET || '';
    if (!appId || !appSecret) {
      return json({ ok: false, error: 'FACEBOOK_APP_ID / FACEBOOK_APP_SECRET not configured in Worker env.' }, 500);
    }
    if (!code || !redirectUri) {
      return json({ ok: false, error: 'Missing code or redirectUri' }, 400);
    }
    const tokenUrl = `${GRAPH}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json().catch(() => null);
    if (!tokenRes.ok || tokenData?.error) {
      return json({ ok: false, error: tokenData?.error?.message ?? 'Token exchange failed' }, 502);
    }

    // Exchange short-lived → long-lived (60 days)
    const longUrl = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`;
    const longRes = await fetch(longUrl);
    const longData = await longRes.json().catch(() => null);
    const finalToken = longData?.access_token ?? tokenData.access_token;
    const expiresIn = longData?.expires_in ?? tokenData.expires_in ?? 5184000;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Fetch Instagram account ID linked to this FB token
    const pagesRes = await fetch(`${GRAPH}/me/accounts?access_token=${finalToken}`);
    const pagesData = await pagesRes.json().catch(() => null);
    const page = pagesData?.data?.[0];
    let instagramUserId = null;
    let facebookPageId = page?.id ?? null;

    if (page?.id) {
      const igRes = await fetch(`${GRAPH}/${page.id}?fields=instagram_business_account&access_token=${finalToken}`);
      const igData = await igRes.json().catch(() => null);
      instagramUserId = igData?.instagram_business_account?.id ?? null;
    }

    return json({ ok: true, accessToken: finalToken, expiresAt, instagramUserId, facebookPageId });
  }

  // ── Fetch Instagram stats ─────────────────────────────────────────────────
  if (action === 'instagram_stats') {
    const { accessToken, instagramUserId } = body;
    if (!accessToken || !instagramUserId) {
      return json({ ok: false, error: 'Missing accessToken or instagramUserId' }, 400);
    }

    const [profileRes, mediaRes] = await Promise.all([
      fetch(`${GRAPH}/${instagramUserId}?fields=id,username,followers_count,media_count,profile_picture_url&access_token=${accessToken}`),
      fetch(`${GRAPH}/${instagramUserId}/media?fields=id,caption,media_type,thumbnail_url,media_url,timestamp,like_count,comments_count&limit=5&access_token=${accessToken}`),
    ]);

    const profile = profileRes.ok ? await profileRes.json().catch(() => null) : null;
    const media = mediaRes.ok ? await mediaRes.json().catch(() => null) : null;

    if (profile?.error) return json({ ok: false, error: profile.error.message }, 502);

    // 30-day insights
    const since = Math.floor((Date.now() - 30 * 864e5) / 1000);
    const until = Math.floor(Date.now() / 1000);
    const insightsRes = await fetch(
      `${GRAPH}/${instagramUserId}/insights?metric=reach,impressions,profile_views&period=day&since=${since}&until=${until}&access_token=${accessToken}`,
    );
    const insights = insightsRes.ok ? await insightsRes.json().catch(() => null) : null;

    const reach30 = insights?.data?.find((m) => m.name === 'reach')?.values
      ?.reduce((sum, v) => sum + (v.value ?? 0), 0) ?? null;
    const impressions30 = insights?.data?.find((m) => m.name === 'impressions')?.values
      ?.reduce((sum, v) => sum + (v.value ?? 0), 0) ?? null;

    return json({
      ok: true,
      profile: {
        username: profile?.username ?? '',
        followersCount: profile?.followers_count ?? 0,
        mediaCount: profile?.media_count ?? 0,
        profilePictureUrl: profile?.profile_picture_url ?? null,
      },
      recentMedia: (media?.data ?? []).slice(0, 5).map((m) => ({
        id: m.id,
        type: m.media_type,
        caption: (m.caption ?? '').slice(0, 80),
        imageUrl: m.media_url ?? m.thumbnail_url ?? null,
        timestamp: m.timestamp,
        likes: m.like_count ?? 0,
        comments: m.comments_count ?? 0,
      })),
      insights: { reach30, impressions30 },
      checkedAt: new Date().toISOString(),
    });
  }

  // ── Token health + granted scopes ─────────────────────────────────────────
  // Backs the connection indicator: a token can exist and still be useless
  // if it lacks ads_read or has expired.
  if (action === 'token_debug') {
    const { accessToken } = body;
    if (!accessToken) return json({ ok: false, error: 'Missing accessToken' }, 400);

    const appId = env.FACEBOOK_APP_ID || '';
    const appSecret = env.FACEBOOK_APP_SECRET || '';
    const appToken = appId && appSecret ? `${appId}|${appSecret}` : accessToken;

    const res = await fetch(`${GRAPH}/debug_token?input_token=${accessToken}&access_token=${appToken}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.error) {
      return json({ ok: false, error: data?.error?.message ?? 'Token debug failed' }, 502);
    }
    const info = data?.data ?? {};
    const scopes = info.scopes ?? [];
    return json({
      ok: true,
      valid: Boolean(info.is_valid),
      scopes,
      hasAdsRead: scopes.includes('ads_read'),
      expiresAt: info.expires_at ? new Date(info.expires_at * 1000).toISOString() : null,
      checkedAt: new Date().toISOString(),
    });
  }

  // ── List ad accounts reachable with this token ────────────────────────────
  if (action === 'ad_accounts') {
    const { accessToken } = body;
    if (!accessToken) return json({ ok: false, error: 'Missing accessToken' }, 400);

    const res = await fetch(
      `${GRAPH}/me/adaccounts?fields=id,account_id,name,currency,account_status&limit=50&access_token=${accessToken}`,
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.error) {
      return json({ ok: false, error: data?.error?.message ?? 'Could not list ad accounts' }, 502);
    }
    return json({
      ok: true,
      accounts: (data?.data ?? []).map((a) => ({
        id: a.id,
        accountId: a.account_id,
        name: a.name,
        currency: a.currency,
        active: a.account_status === 1,
      })),
    });
  }

  // ── Campaign-level spend, efficiency and conversions ──────────────────────
  if (action === 'ads_insights') {
    const { accessToken, adAccountId, datePreset = 'last_7d', level = 'campaign' } = body;
    if (!accessToken || !adAccountId) {
      return json({ ok: false, error: 'Missing accessToken or adAccountId' }, 400);
    }
    const account = String(adAccountId).startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    const fields = [
      'campaign_id', 'campaign_name', 'adset_name', 'ad_name',
      'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'reach', 'frequency',
      'actions', 'action_values', 'cost_per_action_type',
    ].join(',');

    const url = `${GRAPH}/${account}/insights?level=${level}&date_preset=${datePreset}`
      + `&fields=${fields}&limit=200&access_token=${accessToken}`;

    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.error) {
      return json({
        ok: false,
        error: data?.error?.message ?? 'Insights request failed',
        code: data?.error?.code ?? null,
      }, 502);
    }

    // Meta returns conversions as an untyped bag of action types. Pull the
    // few that matter and leave the rest alone.
    const pickAction = (list, type) =>
      Number((list ?? []).find((a) => a.action_type === type)?.value ?? 0);

    const rows = (data?.data ?? []).map((row) => {
      const purchases = pickAction(row.actions, 'purchase')
        || pickAction(row.actions, 'omni_purchase')
        || pickAction(row.actions, 'offsite_conversion.fb_pixel_purchase');
      const leads = pickAction(row.actions, 'lead')
        || pickAction(row.actions, 'offsite_conversion.fb_pixel_lead');
      const revenue = Number((row.action_values ?? []).find((a) =>
        a.action_type === 'purchase' || a.action_type === 'omni_purchase'
        || a.action_type === 'offsite_conversion.fb_pixel_purchase')?.value ?? 0);
      const spend = Number(row.spend ?? 0);

      return {
        campaignId: row.campaign_id ?? null,
        campaignName: row.campaign_name ?? row.adset_name ?? row.ad_name ?? '—',
        adsetName: row.adset_name ?? null,
        adName: row.ad_name ?? null,
        spend,
        impressions: Number(row.impressions ?? 0),
        clicks: Number(row.clicks ?? 0),
        reach: Number(row.reach ?? 0),
        frequency: Number(row.frequency ?? 0),
        ctr: Number(row.ctr ?? 0),
        cpc: Number(row.cpc ?? 0),
        cpm: Number(row.cpm ?? 0),
        purchases,
        leads,
        revenue,
        roas: spend > 0 && revenue > 0 ? revenue / spend : null,
        costPerPurchase: purchases > 0 ? spend / purchases : null,
        costPerLead: leads > 0 ? spend / leads : null,
      };
    });

    return json({ ok: true, datePreset, level, rows, checkedAt: new Date().toISOString() });
  }

  // ── Pixel health: is it actually receiving events? ────────────────────────
  if (action === 'pixel_stats') {
    const { accessToken, pixelId } = body;
    if (!accessToken || !pixelId) {
      return json({ ok: false, error: 'Missing accessToken or pixelId' }, 400);
    }

    const [infoRes, statsRes] = await Promise.all([
      fetch(`${GRAPH}/${pixelId}?fields=id,name,last_fired_time,is_unavailable&access_token=${accessToken}`),
      fetch(`${GRAPH}/${pixelId}/stats?aggregation=event&access_token=${accessToken}`),
    ]);

    const info = await infoRes.json().catch(() => null);
    if (!infoRes.ok || info?.error) {
      return json({ ok: false, error: info?.error?.message ?? 'Pixel lookup failed' }, 502);
    }
    const stats = statsRes.ok ? await statsRes.json().catch(() => null) : null;

    const events = {};
    for (const entry of stats?.data ?? []) {
      for (const point of entry?.data ?? []) {
        const name = point.value ?? point.event ?? 'unknown';
        events[name] = (events[name] ?? 0) + Number(point.count ?? 0);
      }
    }

    return json({
      ok: true,
      pixel: {
        id: info?.id ?? pixelId,
        name: info?.name ?? '',
        lastFiredTime: info?.last_fired_time ?? null,
        unavailable: Boolean(info?.is_unavailable),
      },
      events,
      checkedAt: new Date().toISOString(),
    });
  }

  return json({ ok: false, error: `Unknown action: ${action}` }, 400);
}
