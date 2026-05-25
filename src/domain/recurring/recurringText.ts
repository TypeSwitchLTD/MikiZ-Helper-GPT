export function looksLikeCorruptedText(value: string | null | undefined): boolean {
  const text = (value ?? '').trim();
  if (!text) return true;

  const replacementChars = (text.match(/�/g) ?? []).length;
  if (replacementChars > 0) return true;

  const hebrewChars = (text.match(/[\u0590-\u05ff]/g) ?? []).length;
  const latinOrDigits = (text.match(/[a-z0-9]/gi) ?? []).length;
  const mojibakeMarkers = (text.match(/[ÃÂÐÑØÙ×]/g) ?? []).length;
  const usefulChars = hebrewChars + latinOrDigits;

  if (mojibakeMarkers >= 2 && hebrewChars === 0) return true;
  if (usefulChars === 0 && text.length > 3) return true;

  return false;
}

export function cleanReadableText(value: string | null | undefined): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return looksLikeCorruptedText(text) ? '' : text;
}
