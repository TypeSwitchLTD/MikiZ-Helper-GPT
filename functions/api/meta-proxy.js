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

  return json({ ok: false, error: `Unknown action: ${action}` }, 400);
}
