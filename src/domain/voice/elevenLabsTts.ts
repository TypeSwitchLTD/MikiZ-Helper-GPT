import type { AppSettings } from '../settings/settingsTypes';

export interface ElevenLabsPlaybackResult {
  ok: boolean;
  audioUrl?: string;
  error?: string;
  usedProxy: boolean;
  requestUrl?: string;
  fallbackUsed?: boolean;
}

export interface ElevenLabsConfigStatus {
  ok: boolean;
  message: string;
  mode: 'proxy' | 'local-dev-proxy' | 'cloudflare-proxy' | 'direct' | 'missing';
}

const memoryAudioCache = new Map<string, Blob>();
const MAX_MEMORY_AUDIO_CACHE_ITEMS = 3;

function getVoice(settings: AppSettings | null) {
  return settings?.voice ?? null;
}

function hasLocalViteProxy(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === '127.0.0.1' || host === 'localhost';
}

export function getElevenLabsConfigStatus(settings: AppSettings | null): ElevenLabsConfigStatus {
  const voice = getVoice(settings);

  if (!voice || voice.engine !== 'elevenlabs') {
    return { ok: false, message: 'נבחר קול דפדפן.', mode: 'missing' };
  }

  const voiceId = voice.elevenLabsVoiceId?.trim();
  const apiKey = voice.elevenLabsApiKey?.trim();
  const proxyUrl = voice.elevenLabsProxyUrl?.trim();

  if (!voiceId) return { ok: false, message: 'חסר Voice ID של ElevenLabs.', mode: 'missing' };
  if (proxyUrl) return { ok: true, message: 'ElevenLabs מוכן דרך Proxy חיצוני.', mode: 'proxy' };
  if (apiKey && hasLocalViteProxy()) return { ok: true, message: 'ElevenLabs מוכן דרך Proxy מקומי של Vite.', mode: 'local-dev-proxy' };
  // On deployed origin (Cloudflare Pages etc.) we route through /api/tts to avoid CORS.
  if (apiKey) return { ok: true, message: 'ElevenLabs מוכן דרך Cloudflare Proxy.', mode: 'cloudflare-proxy' };
  return { ok: false, message: 'חסר API Key או Proxy URL.', mode: 'missing' };
}

export function isElevenLabsConfigured(settings: AppSettings | null): boolean {
  return getElevenLabsConfigStatus(settings).ok;
}

function buildRequestUrl(
  settings: AppSettings | null,
  voiceId: string,
  outputFormat: string,
): { url: string; usedProxy: boolean; needsApiHeader: boolean; useProxyBody: boolean } {
  const voice = getVoice(settings);
  const explicitProxy = voice?.elevenLabsProxyUrl?.trim();

  // Explicit proxy URL configured by user takes top priority.
  if (explicitProxy) {
    return { url: explicitProxy, usedProxy: true, needsApiHeader: false, useProxyBody: true };
  }

  // Local Vite dev: route through vite.config.ts proxy to avoid browser CORS.
  if (hasLocalViteProxy()) {
    return {
      url: `/elevenlabs-api/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`,
      usedProxy: true,
      needsApiHeader: true,
      useProxyBody: false,
    };
  }

  // Deployed (Cloudflare Pages or any non-localhost origin): use the built-in /api/tts
  // Cloudflare Function as a proxy. This avoids CORS and keeps the API key out of
  // request headers that browsers expose in network logs.
  return {
    url: `/api/tts`,
    usedProxy: true,
    needsApiHeader: false,
    useProxyBody: true,
  };
}

function resolveElevenLabsModelId(settings: AppSettings | null): string {
  const configuredModelId = settings?.voice?.elevenLabsModelId?.trim();

  // Older saved settings may still contain eleven_multilingual_v2.
  // For Hebrew playback we force Eleven v3 and do NOT send language_code.
  if (!configuredModelId || configuredModelId === 'eleven_multilingual_v2') {
    return 'eleven_v3';
  }

  return configuredModelId;
}

async function sha256Text(value: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    return hash.toString(16);
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function buildAudioCachePayload(text: string, settings: AppSettings | null): string {
  const voice = getVoice(settings);
  return JSON.stringify({
    text: text.replace(/\s+/g, ' ').trim(),
    voiceId: voice?.elevenLabsVoiceId?.trim() ?? '',
    modelId: resolveElevenLabsModelId(settings),
    outputFormat: voice?.elevenLabsOutputFormat?.trim() || 'mp3_44100_128',
    stability: voice?.stability ?? 0.45,
    similarityBoost: voice?.similarityBoost ?? 0.82,
    style: voice?.style ?? 0.2,
    useSpeakerBoost: voice?.useSpeakerBoost ?? true,
  });
}

async function getCachedAudioUrl(cacheKey: string): Promise<string | null> {
  const memoryBlob = memoryAudioCache.get(cacheKey);
  if (memoryBlob && memoryBlob.size > 0) {
    return URL.createObjectURL(memoryBlob);
  }
  if (typeof caches === 'undefined') return null;
  const cache = await caches.open('mission-control-elevenlabs-v1');
  const cached = await cache.match(cacheKey);
  if (!cached) return null;
  const blob = await cached.blob();
  if (blob.size > 0) {
    memoryAudioCache.set(cacheKey, blob);
  }
  return blob.size > 0 ? URL.createObjectURL(blob) : null;
}

async function putCachedAudio(cacheKey: string, blob: Blob): Promise<void> {
  if (blob.size === 0) return;
  memoryAudioCache.set(cacheKey, blob);
  while (memoryAudioCache.size > MAX_MEMORY_AUDIO_CACHE_ITEMS) {
    const oldestKey = memoryAudioCache.keys().next().value;
    if (!oldestKey) break;
    memoryAudioCache.delete(oldestKey);
  }
  if (typeof caches === 'undefined') return;
  const cache = await caches.open('mission-control-elevenlabs-v1');
  await cache.put(cacheKey, new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/mpeg' } }));
}

export async function createElevenLabsAudioUrl(text: string, settings: AppSettings | null): Promise<ElevenLabsPlaybackResult> {
  const voice = getVoice(settings);
  const status = getElevenLabsConfigStatus(settings);

  if (!voice || voice.engine !== 'elevenlabs') {
    return { ok: false, usedProxy: false, error: 'ElevenLabs לא מוגדר כמנוע הקראה.' };
  }

  const voiceId = voice.elevenLabsVoiceId?.trim();
  const apiKey = voice.elevenLabsApiKey?.trim();
  const modelId = resolveElevenLabsModelId(settings);
  const outputFormat = voice.elevenLabsOutputFormat?.trim() || 'mp3_44100_128';

  if (!voiceId) return { ok: false, usedProxy: false, error: 'חסר Voice ID של ElevenLabs.' };
  if (!status.ok) return { ok: false, usedProxy: false, error: status.message };

  const cacheKey = `/mission-control-elevenlabs-cache/${await sha256Text(buildAudioCachePayload(text, settings))}.mp3`;
  const cachedAudioUrl = await getCachedAudioUrl(cacheKey).catch(() => null);
  if (cachedAudioUrl) {
    return { ok: true, usedProxy: true, requestUrl: cacheKey, audioUrl: cachedAudioUrl };
  }

  const body = {
    text,
    model_id: modelId,
    voice_settings: {
      stability: typeof voice.stability === 'number' ? voice.stability : 0.45,
      similarity_boost: typeof voice.similarityBoost === 'number' ? voice.similarityBoost : 0.82,
      style: typeof voice.style === 'number' ? voice.style : 0.2,
      use_speaker_boost: voice.useSpeakerBoost ?? true,
    },
  };

  const request = buildRequestUrl(settings, voiceId, outputFormat);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (request.needsApiHeader && apiKey) headers['xi-api-key'] = apiKey;

  // Proxy-style body includes voice_id, output_format and api_key so the server-side
  // handler can forward the request without needing a pre-configured secret.
  const requestBody = request.useProxyBody
    ? JSON.stringify({ ...body, voice_id: voiceId, output_format: outputFormat, api_key: apiKey || undefined })
    : JSON.stringify(body);

  try {
    const response = await fetch(request.url, {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if (!response.ok) {
      let message = `ElevenLabs החזיר שגיאה ${response.status}`;
      try {
        const json = await response.json();
        message = json?.detail?.message || json?.detail || json?.error || message;
      } catch {
        try {
          const raw = await response.text();
          if (raw) message = raw.slice(0, 180);
        } catch {
          // keep generic message
        }
      }
      return { ok: false, usedProxy: request.usedProxy, requestUrl: request.url, error: message };
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      return { ok: false, usedProxy: request.usedProxy, requestUrl: request.url, error: 'ElevenLabs החזיר קובץ אודיו ריק.' };
    }

    await putCachedAudio(cacheKey, blob).catch(() => undefined);
    return { ok: true, usedProxy: request.usedProxy, requestUrl: request.url, audioUrl: URL.createObjectURL(blob) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה לא ידועה ביצירת קול ElevenLabs.';
    return {
      ok: false,
      usedProxy: request.usedProxy,
      requestUrl: request.url,
      error: request.usedProxy ? message : `${message}. ייתכן שמדובר ב־CORS; בהרצה מקומית השתמש ב־npm.cmd run dev או Proxy.`,
    };
  }
}
