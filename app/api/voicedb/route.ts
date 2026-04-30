import { NextResponse } from 'next/server';
import { DATA_CACHE_HEADERS, fetchDatalistJson } from '@/lib/data-source';

type JsonRecord = Record<string, unknown>;

type CharactersAllEntry = {
  DevNicknames?: string;
  ENName?: string;
  JPName?: string;
  Attribute?: string;
  Role?: string;
  Race?: string;
  Rarity?: number;
  va?: string;
};

type CharactersAllFile = {
  chars?: CharactersAllEntry[];
};

type VoiceDbCharacter = {
  id: string;
  faceCode: string;
  nameEN: string;
  nameJP: string;
  titleEN: string;
  titleJP: string;
  attribute: string;
  role: string;
  race: string;
  rarity: number;
  iconUrl: string;
};

type VoiceDbActor = {
  id: string;
  name: string;
  jpName: string;
  characterCount: number;
  attributes: string[];
  rarities: number[];
  characters: VoiceDbCharacter[];
};

const ASSET_ROOT = 'https://wfjukebox.b-cdn.net/wfjukebox';

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function normalizeRow(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  if (Array.isArray(value[0])) return value[0] as unknown[];
  return value;
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const text = String(value).trim();
  if (!text || text === '(None)' || text.toLowerCase() === 'none') return '';
  return text;
}

function parseEnName(enName: string): { title: string; name: string } {
  if (!enName) return { title: '', name: '' };
  const parts = enName.split('\n').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) return { title: '', name: parts[0] };
  return {
    title: parts[0].replace(/^\[/, '').replace(/\]$/, '').trim(),
    name: parts.slice(1).join(' ').trim(),
  };
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stableActorId(name: string): string {
  const normalized = name.normalize('NFKC').trim().toLowerCase();
  if (!normalized) return 'unknown';

  const slug = normalized
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

  if (slug) return slug;
  return `actor-${hashText(normalized)}`;
}

async function loadVoiceDb() {
  const [
    charactersAll,
    characterMapEN,
    characterTextEN,
    characterTextJP,
  ] = await Promise.all([
    fetchDatalistJson<CharactersAllFile>('characters_all_withjp.json').catch(() => fetchDatalistJson<CharactersAllFile>('characters_all.json')),
    fetchDatalistJson<JsonRecord>('datalist_en/character/character.json'),
    fetchDatalistJson<JsonRecord>('datalist_en/character/character_text.json'),
    fetchDatalistJson<JsonRecord>('datalist/character/character_text.json'),
  ]);

  const idByFaceCode = new Map<string, string>();
  for (const [id, rawRow] of Object.entries(asRecord(characterMapEN))) {
    const row = normalizeRow(rawRow);
    const primary = cleanText(row[0]);
    const artCode = cleanText(row[8]);
    if (primary) idByFaceCode.set(primary, id);
    if (artCode) idByFaceCode.set(artCode, id);
  }

  const actors = new Map<string, VoiceDbActor>();
  const missingVoiceActors: VoiceDbCharacter[] = [];

  for (const entry of charactersAll.chars || []) {
    const faceCode = cleanText(entry.DevNicknames);
    if (!faceCode) continue;

    const characterId = idByFaceCode.get(faceCode) || '';
    const textEN = characterId ? normalizeRow(characterTextEN[characterId]) : [];
    const textJP = characterId ? normalizeRow(characterTextJP[characterId]) : [];
    const parsedEN = parseEnName(cleanText(entry.ENName));
    const jpName = cleanText(entry.JPName) || cleanText(textJP[0]);
    const voiceActorName = cleanText(entry.va) || cleanText(textEN[9]) || cleanText(textJP[9]);
    const voiceActorJP = cleanText(textJP[9]);
    const character: VoiceDbCharacter = {
      id: characterId,
      faceCode,
      nameEN: cleanText(textEN[0]) || parsedEN.name || faceCode,
      nameJP: jpName,
      titleEN: parsedEN.title || cleanText(textEN[3]),
      titleJP: cleanText(textJP[3]),
      attribute: cleanText(entry.Attribute),
      role: cleanText(entry.Role),
      race: cleanText(entry.Race),
      rarity: Number(entry.Rarity) || 0,
      iconUrl: `${ASSET_ROOT}/character/character_art/${faceCode}/ui/square_0.png`,
    };

    if (!voiceActorName) {
      missingVoiceActors.push(character);
      continue;
    }

    const key = voiceActorName.toLowerCase();
    const current = actors.get(key) || {
      id: stableActorId(voiceActorName),
      name: voiceActorName,
      jpName: voiceActorJP,
      characterCount: 0,
      attributes: [],
      rarities: [],
      characters: [],
    };

    current.characterCount += 1;
    current.characters.push(character);
    if (voiceActorJP && !current.jpName) current.jpName = voiceActorJP;
    if (character.attribute && !current.attributes.includes(character.attribute)) current.attributes.push(character.attribute);
    if (character.rarity && !current.rarities.includes(character.rarity)) current.rarities.push(character.rarity);
    actors.set(key, current);
  }

  const actorList = Array.from(actors.values())
    .map((actor) => ({
      ...actor,
      characters: actor.characters.sort((a, b) => (
        b.rarity - a.rarity ||
        a.nameEN.localeCompare(b.nameEN)
      )),
      rarities: actor.rarities.sort((a, b) => b - a),
      attributes: actor.attributes.sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => b.characterCount - a.characterCount || a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    source: {
      local: [
        'characters_all_withjp.json',
        'datalist_en/character/character.json',
        'datalist_en/character/character_text.json',
        'datalist/character/character_text.json',
      ],
      external: [
        'Wikidata, MyAnimeList via Jikan, Anime News Network, and guarded X recent-search enrichment is available per actor from /api/voicedb/actor.',
      ],
    },
    totals: {
      actors: actorList.length,
      voicedCharacters: actorList.reduce((sum, actor) => sum + actor.characterCount, 0),
      missingVoiceActors: missingVoiceActors.length,
      characters: (charactersAll.chars || []).length,
    },
    actors: actorList,
    missingVoiceActors,
  };
}

export async function GET() {
  try {
    const payload = await loadVoiceDb();
    return NextResponse.json(payload, { headers: DATA_CACHE_HEADERS });
  } catch (error) {
    console.error('Failed to build VoiceDB:', error);
    return NextResponse.json({ error: 'Failed to build VoiceDB' }, { status: 500 });
  }
}
