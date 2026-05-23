/**
 * Cloudflare Pages Function — /api/tts
 *
 * Server-side proxy for ElevenLabs TTS.
 * Accepts the same voice_settings shape that elevenLabsTts.ts sends and
 * forwards the request to ElevenLabs, returning the raw audio blob.
 *
 * Priority for the API key:
 *   1. ELEVENLABS_API_KEY Cloudflare secret (set in Pages > Settings > Variables)
 *   2. api_key field in the request body (sent by the client from IndexedDB settings)
 *
 * Supported body fields:
 *   text          string  — text to synthesise (required)
 *   voice_id      string  — ElevenLabs voice ID (required)
 *   model_id      string  — defaults to eleven_v3
 *   voice_settings object — stability / similarity_boost / style / use_speaker_boost
 *   output_format string  — defaults to mp3_44100_128
 *   api_key       string  — fallback API key when no env secret is set
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

const jsonError = (message, status = 400) =>
  new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body');
  }

  const { text, voice_id, model_id, voice_settings, output_format, api_key } = body ?? {};

  // Resolve API key — env secret takes priority over client-supplied key.
  const cleanEnv = (name) => (typeof env?.[name] === 'string' ? env[name].trim() : '');
  const apiKey = cleanEnv('ELEVENLABS_API_KEY') || (typeof api_key === 'string' ? api_key.trim() : '');

  if (!text || typeof text !== 'string' || !text.trim()) return jsonError('Missing text');
  if (!voice_id || typeof voice_id !== 'string' || !voice_id.trim()) return jsonError('Missing voice_id');
  if (!apiKey) return jsonError('Missing ElevenLabs API key', 401);

  // Always use eleven_v3 for Hebrew; guard against stale saved settings.
  const resolvedModelId =
    !model_id || model_id === 'eleven_multilingual_v2' ? 'eleven_v3' : model_id;

  const format = typeof output_format === 'string' && output_format.trim()
    ? output_format.trim()
    : 'mp3_44100_128';

  const elevenUrl = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice_id.trim())}?output_format=${encodeURIComponent(format)}`;

  const elevenBody = {
    text: text.trim(),
    model_id: resolvedModelId,
    ...(voice_settings && typeof voice_settings === 'object' ? { voice_settings } : {}),
  };

  let elevenResponse;
  try {
    elevenResponse = await fetch(elevenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify(elevenBody),
    });
  } catch (err) {
    return jsonError(`Network error reaching ElevenLabs: ${err?.message ?? 'unknown'}`, 502);
  }

  if (!elevenResponse.ok) {
    let errorMsg = `ElevenLabs error ${elevenResponse.status}`;
    try {
      const json = await elevenResponse.json();
      errorMsg = json?.detail?.message || json?.detail || json?.error || errorMsg;
    } catch {
      try {
        const raw = await elevenResponse.text();
        if (raw) errorMsg = raw.slice(0, 200);
      } catch { /* keep generic message */ }
    }
    return jsonError(errorMsg, elevenResponse.status);
  }

  const audioData = await elevenResponse.arrayBuffer();
  if (!audioData || audioData.byteLength === 0) {
    return jsonError('ElevenLabs returned empty audio', 502);
  }

  const contentType = elevenResponse.headers.get('Content-Type') || 'audio/mpeg';
  return new Response(audioData, {
    status: 200,
    headers: { 'Content-Type': contentType, ...CORS_HEADERS },
  });
}
