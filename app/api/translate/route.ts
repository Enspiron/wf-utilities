import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasNvidiaRivaConfig, translateWithNvidiaRiva } from '@/lib/nvidia-riva';
import {
  containsJapaneseText,
  extractGoogleTranslatedText,
  MAX_TRANSLATION_TEXT_LENGTH,
  normalizeSelectionTextForTranslation,
} from '@/lib/translation';

export const runtime = 'nodejs';

const translateRequestSchema = z.object({
  text: z.string().min(1).max(MAX_TRANSLATION_TEXT_LENGTH),
});

async function translateWithGoogle(text: string): Promise<string | null> {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'ja',
    tl: 'en',
    dt: 't',
    q: text,
  });

  const response = await fetch(
    `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
    {
      cache: 'no-store',
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Google translation failed with status ${response.status}.`);
  }

  const rawPayload = await response.text();
  const payload = JSON.parse(rawPayload) as unknown;
  return extractGoogleTranslatedText(payload);
}

export async function POST(request: NextRequest) {
  try {
    const body = translateRequestSchema.parse(await request.json());
    const text = normalizeSelectionTextForTranslation(body.text);

    if (!text) {
      return NextResponse.json({ error: 'No text to translate.' }, { status: 400 });
    }

    if (!containsJapaneseText(text)) {
      return NextResponse.json(
        { error: 'The selected text does not contain Japanese characters.' },
        { status: 400 }
      );
    }

    let translatedText: string | null = null;
    let provider = 'google-web';

    if (hasNvidiaRivaConfig()) {
      try {
        translatedText = await translateWithNvidiaRiva(text);
        if (translatedText) {
          provider = 'nvidia-riva';
        }
      } catch (error) {
        console.warn('NVIDIA Riva translation failed, falling back to Google:', error);
      }
    }

    if (!translatedText) {
      translatedText = await translateWithGoogle(text);
    }

    if (!translatedText) {
      return NextResponse.json(
        { error: 'Translation service returned an empty response.' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        originalText: text,
        translatedText,
        provider,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid translation request.' }, { status: 400 });
    }

    console.error('Inline translation failed:', error);
    return NextResponse.json({ error: 'Failed to translate the selected text.' }, { status: 500 });
  }
}
