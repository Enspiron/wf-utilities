const ELIYA_COMP_SLOT_COUNT = 12;
const ELIYA_COMP_BLANK_TOKEN = 'blank';

export function normalizeEliyaCompToken(value: string): string {
  return value.trim().toLowerCase();
}

export function extractEliyaCompSlug(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  let candidate = trimmed;
  try {
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(/\/comp\/([^/]+)/i);
    if (match?.[1]) {
      candidate = match[1];
    } else {
      const fallback = parsed.pathname.split('/').filter(Boolean).pop();
      candidate = fallback || '';
    }
  } catch {
    const inlineMatch = trimmed.match(/\/comp\/([^/?#]+)/i);
    if (inlineMatch?.[1]) {
      candidate = inlineMatch[1];
    }
  }

  return candidate.replace(/\.png$/i, '').split('?')[0].split('#')[0].trim();
}

export function parseEliyaCompTokens(input: string): string[] | null {
  const slug = extractEliyaCompSlug(input);
  if (!slug) return null;

  const rawTokens = slug.split('-').map((token) => normalizeEliyaCompToken(token) || ELIYA_COMP_BLANK_TOKEN);
  if (rawTokens.length === 0) return null;

  if (rawTokens.length < ELIYA_COMP_SLOT_COUNT) {
    return [
      ...rawTokens,
      ...Array.from({ length: ELIYA_COMP_SLOT_COUNT - rawTokens.length }, () => ELIYA_COMP_BLANK_TOKEN),
    ];
  }

  return rawTokens.slice(0, ELIYA_COMP_SLOT_COUNT);
}

export function buildEliyaCompLink(tokens: string[]): string {
  const normalized = tokens
    .slice(0, ELIYA_COMP_SLOT_COUNT)
    .map((token) => normalizeEliyaCompToken(token) || ELIYA_COMP_BLANK_TOKEN);
  while (normalized.length < ELIYA_COMP_SLOT_COUNT) {
    normalized.push(ELIYA_COMP_BLANK_TOKEN);
  }
  return `https://eliya-bot.herokuapp.com/comp/${normalized.join('-')}.png`;
}
