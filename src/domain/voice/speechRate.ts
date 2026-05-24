export const MIN_SPEECH_RATE = 0.65;
export const MAX_SPEECH_RATE = 2;
export const DEFAULT_SPEECH_RATE = 0.86;

export function normalizeSpeechRate(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SPEECH_RATE;
  return Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, value));
}
