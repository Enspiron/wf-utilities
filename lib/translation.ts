export const MAX_TRANSLATION_TEXT_LENGTH = 1200;

const JAPANESE_CHARACTER_RE =
  /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\u3000-\u303f\uff00-\uffef]/u;

export function containsJapaneseText(value: string): boolean {
  return JAPANESE_CHARACTER_RE.test(value);
}

export function normalizeSelectionTextForTranslation(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function extractGoogleTranslatedText(payload: unknown): string | null {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return null;

  const segments = payload[0]
    .map((segment) => (Array.isArray(segment) ? segment[0] : null))
    .filter((segment): segment is string => typeof segment === 'string' && segment.trim().length > 0);

  if (segments.length === 0) return null;

  const translated = segments.join('').trim();
  return translated || null;
}
