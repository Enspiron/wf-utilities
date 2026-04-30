import { MAX_TRANSLATION_TEXT_LENGTH, normalizeSelectionTextForTranslation } from '@/lib/translation';

export type TranslateResponse = {
  error?: string;
  originalText?: string;
  provider?: string;
  translatedText?: string;
};

export async function requestEnglishTranslation(rawText: string): Promise<{
  originalText: string;
  provider?: string;
  translatedText: string;
}> {
  const text = normalizeSelectionTextForTranslation(rawText);

  if (!text) {
    throw new Error('No text to translate.');
  }

  if (text.length > MAX_TRANSLATION_TEXT_LENGTH) {
    throw new Error('The selected text is too long to translate at once.');
  }

  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ text }),
  });

  const payload = (await response.json()) as TranslateResponse;
  if (!response.ok || !payload.translatedText) {
    throw new Error(payload.error || 'Translation failed.');
  }

  return {
    originalText: payload.originalText || text,
    provider: payload.provider,
    translatedText: payload.translatedText,
  };
}
