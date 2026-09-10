const CACHE_KEY = 'mc-usd-ils-rate';
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000; // once a week
const FALLBACK_RATE = 3.7;

export interface ExchangeRate {
  rate: number;
  fetchedAt: string;
  source: 'frankfurter' | 'er-api' | 'cache' | 'fallback';
}

interface CachedRate {
  rate: number;
  fetchedAt: string;
  source: ExchangeRate['source'];
}

function readCache(): CachedRate | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRate;
    return Number.isFinite(parsed.rate) && parsed.rate > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(entry: CachedRate) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* storage can be unavailable in private mode — the rate still works in memory */
  }
}

/** exchangerate-api free tier — no key, updates daily */
async function fetchFromErApi(signal: AbortSignal): Promise<number | null> {
  const response = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store', signal });
  if (!response.ok) return null;
  const body = await response.json();
  const rate = Number(body?.rates?.ILS);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** ECB data via frankfurter. Note: api.frankfurter.app 301-redirects — use .dev directly */
async function fetchFromFrankfurter(signal: AbortSignal): Promise<number | null> {
  const response = await fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=ILS', { cache: 'no-store', signal });
  if (!response.ok) return null;
  const body = await response.json();
  const rate = Number(body?.rates?.ILS);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * USD to ILS. Refreshes at most once a week and falls back to the last
 * cached value, so a dead network never blocks the profitability view.
 */
export async function getUsdToIlsRate(force = false): Promise<ExchangeRate> {
  const cached = readCache();
  const isFresh = cached && Date.now() - Date.parse(cached.fetchedAt) < REFRESH_MS;
  if (cached && isFresh && !force) {
    return { rate: cached.rate, fetchedAt: cached.fetchedAt, source: 'cache' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let source: ExchangeRate['source'] = 'er-api';
    let rate = await fetchFromErApi(controller.signal).catch(() => null);
    if (!rate) {
      rate = await fetchFromFrankfurter(controller.signal).catch(() => null);
      source = 'frankfurter';
    }

    if (rate) {
      const entry: CachedRate = { rate, fetchedAt: new Date().toISOString(), source };
      writeCache(entry);
      return { ...entry };
    }
  } catch {
    /* fall through to the cached or default rate */
  } finally {
    clearTimeout(timeout);
  }

  if (cached) return { rate: cached.rate, fetchedAt: cached.fetchedAt, source: 'cache' };
  return { rate: FALLBACK_RATE, fetchedAt: new Date().toISOString(), source: 'fallback' };
}

export function toIls(usd: number, rate: number): number {
  return usd * rate;
}
