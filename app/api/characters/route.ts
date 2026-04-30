import { NextResponse } from 'next/server';
import { parseCharacterAllData } from '@/lib/character-parser';
import { fetchDatalistJson } from '@/lib/data-source';

// `parseCharacterAllData` expects the `characters_all.json` shape; we keep this
// loose here so the route can type-guard before handing it off.
type CharactersAllPayload = Parameters<typeof parseCharacterAllData>[0];
type CharacterDatalistPayload = Record<string, unknown>;
const CHARACTER_CACHE_HEADERS = { 'Cache-Control': 'no-store' } as const;

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

function buildFaceCodeSet(characterPayload: unknown): Set<string> {
  if (!characterPayload || typeof characterPayload !== 'object') return new Set();
  const rows = characterPayload as Record<string, unknown>;
  const faceCodes = new Set<string>();
  for (const raw of Object.values(rows)) {
    const faceCode = extractCharacterFaceCode(raw).trim();
    if (faceCode) faceCodes.add(faceCode);
  }
  return faceCodes;
}

function buildCharacterAllFaceCodeSet(characterPayload: CharactersAllPayload): Set<string> {
  return new Set(characterPayload.chars.map((character) => character.DevNicknames).filter(Boolean));
}

function buildJpExclusiveFaceCodeSet(
  jpCharacterPayload: unknown,
  enCharacterPayload: unknown,
  characterPayload: CharactersAllPayload
): Set<string> {
  const jpFaceCodes = buildFaceCodeSet(jpCharacterPayload);
  for (const faceCode of buildCharacterAllFaceCodeSet(characterPayload)) {
    jpFaceCodes.add(faceCode);
  }
  const enFaceCodes = buildFaceCodeSet(enCharacterPayload);
  return new Set([...jpFaceCodes].filter((faceCode) => !enFaceCodes.has(faceCode)));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'both';

    const [characterData, characterIndexData, enCharacterData] = await Promise.all([
      fetchDatalistJson<CharactersAllPayload>('characters_all.json'),
      fetchDatalistJson<Record<string, unknown>>('character.json'),
      fetchDatalistJson<CharacterDatalistPayload>('datalist_en/character/character.json'),
    ]);

    const faceCodeToId = buildFaceCodeToIdMap(characterIndexData);
    // `character.json` is the JP/full character index; datalist_en is the EN
    // release index. JP-exclusive means the face code exists in JP but not EN.
    const jpExclusiveFaceCodes = buildJpExclusiveFaceCodeSet(characterIndexData, enCharacterData, characterData);
    const characters = parseCharacterAllData(characterData, faceCodeToId, jpExclusiveFaceCodes);

    return NextResponse.json(
      { characters, lang, count: characters.length, jpExclusiveCount: jpExclusiveFaceCodes.size },
      { headers: CHARACTER_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error loading character data:', error);
    return NextResponse.json({ error: 'Failed to load character data' }, { status: 500 });
  }
}
