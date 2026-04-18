import { NextResponse } from 'next/server';
import { parseCharacterAllData } from '@/lib/character-parser';
import { fetchDatalistJson, DATA_CACHE_HEADERS } from '@/lib/data-source';

// `parseCharacterAllData` expects the `characters_all.json` shape; we keep this
// loose here so the route can type-guard before handing it off.
type CharactersAllPayload = Parameters<typeof parseCharacterAllData>[0];

function extractCharacterFaceCode(value: unknown): string {
  if (Array.isArray(value)) {
    if (typeof value[0] === 'string') return value[0];
    if (Array.isArray(value[0]) && typeof value[0][0] === 'string') return value[0][0];
  }
  return '';
}

function buildFaceCodeToIdMap(characterPayload: unknown): Record<string, string> {
  if (!characterPayload || typeof characterPayload !== 'object') return {};
  const rows = characterPayload as Record<string, unknown>;
  const lookup: Record<string, string> = {};
  for (const [id, raw] of Object.entries(rows)) {
    const faceCode = extractCharacterFaceCode(raw).trim();
    if (!faceCode) continue;
    // Preserve first discovered ID for stable mapping.
    if (!lookup[faceCode]) {
      lookup[faceCode] = id;
    }
  }
  return lookup;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'both';

    const [characterData, characterIndexData] = await Promise.all([
      fetchDatalistJson<CharactersAllPayload>('characters_all.json'),
      fetchDatalistJson<Record<string, unknown>>('character.json'),
    ]);

    const faceCodeToId = buildFaceCodeToIdMap(characterIndexData);
    const characters = parseCharacterAllData(characterData, faceCodeToId);

    return NextResponse.json(
      { characters, lang, count: characters.length },
      { headers: DATA_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error loading character data:', error);
    return NextResponse.json({ error: 'Failed to load character data' }, { status: 500 });
  }
}
