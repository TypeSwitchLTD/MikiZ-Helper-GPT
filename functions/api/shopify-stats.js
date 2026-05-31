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

function readBearer(request) {
  const auth = request.headers.get('authorization') || '';
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

function normalizeShopDomain(value) {
  const raw = String(value || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!raw) return '';
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(raw)) return '';
  return raw.toLowerCase();
}

function todayWindow() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 864e5);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function shopifyFetch(shopDomain, token, path) {
  const response = await fetch(`https://${shopDomain}/admin/api/2026-04/${path}`, {
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.errors || data?.error || `Shopify request failed (${response.status})`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }
  return data;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return json({});
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const expectedToken = (env.MORNING_BRIEFING_TOKEN || '').trim();
  const mcToken = readBearer(request);
  if (!expectedToken || mcToken !== expectedToken) return json({ ok: false, error: 'Unauthorized' }, 401);

  const body = await request.json().catch(() => ({}));
  const shopDomain = normalizeShopDomain(body.shopDomain);
  const adminAccessToken = String(body.adminAccessToken || '').trim();
  if (!shopDomain) return json({ ok: false, error: 'Invalid or missing shopDomain' }, 400);
  if (!adminAccessToken) return json({ ok: false, error: 'Missing adminAccessToken' }, 400);

  const { start, end } = todayWindow();
  const createdMin = encodeURIComponent(start);
  const createdMax = encodeURIComponent(end);

  try {
    const [todayOrders, openOrders, customers, recent] = await Promise.all([
      shopifyFetch(shopDomain, adminAccessToken, `orders/count.json?status=any&created_at_min=${createdMin}&created_at_max=${createdMax}`),
      shopifyFetch(shopDomain, adminAccessToken, 'orders/count.json?status=open'),
      shopifyFetch(shopDomain, adminAccessToken, `customers/count.json?created_at_min=${createdMin}&created_at_max=${createdMax}`),
      shopifyFetch(
        shopDomain,
        adminAccessToken,
        'orders.json?status=any&limit=10&order=created_at%20desc&fields=id,name,email,total_price,currency,created_at,financial_status,fulfillment_status,customer,line_items',
      ),
    ]);

    const orders = Array.isArray(recent?.orders) ? recent.orders : [];
    const recentOrders = orders.map((order) => ({
      id: order.id,
      name: order.name,
      email: order.email || order.customer?.email || '',
      customerName: [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' '),
      totalPrice: Number(order.total_price || 0),
      currency: order.currency || '',
      createdAt: order.created_at,
      financialStatus: order.financial_status || '',
      fulfillmentStatus: order.fulfillment_status || 'unfulfilled',
      itemsCount: Array.isArray(order.line_items) ? order.line_items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0,
    }));

    const revenueToday = recentOrders
      .filter((order) => {
        const time = new Date(order.createdAt).getTime();
        return time >= new Date(start).getTime() && time < new Date(end).getTime();
      })
      .reduce((sum, order) => sum + order.totalPrice, 0);

    return json({
      ok: true,
      shopDomain,
      checkedAt: new Date().toISOString(),
      metrics: {
        ordersToday: Number(todayOrders?.count || 0),
        openOrders: Number(openOrders?.count || 0),
        customersToday: Number(customers?.count || 0),
        revenueToday,
      },
      recentOrders,
    });
  } catch (error) {
    return json({ ok: false, error: error?.message || 'Shopify request failed' }, 502);
  }
}
