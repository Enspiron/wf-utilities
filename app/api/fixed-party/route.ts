import { NextResponse } from 'next/server';
import { parseCharacterAllData } from '@/lib/character-parser';
import { fetchDatalistJson, DATA_CACHE_HEADERS } from '@/lib/data-source';
import { getCatalogEntriesForApi } from '@/lib/item-catalog';

type CharactersAllPayload = Parameters<typeof parseCharacterAllData>[0];
type FixedPartyPayload = Record<string, string[]>;

type CharacterSummary = {
  id: string;
  faceCode: string;
  nameEN: string;
  nameJP: string;
  titleEN: string;
  titleJP: string;
  attribute: string;
  rarity: string;
  weaponType: string;
};

type ItemSummary = {
  id: string;
  type: 'item' | 'equipment';
  name: string;
  icon: string;
  thumbnail?: string;
  category: string;
};

type FixedPartyUnit = {
  position: number;
  characterId: number;
  level: number;
  uncapTier: number;
  rawState: number;
  rawVariant: number;
  note: string;
  manaNodeIds: number[];
  manaNodeCount: number;
  character: CharacterSummary | null;
};

type FixedPartyEquipment = {
  position: number;
  equipmentId: number;
  tier: number;
  item: ItemSummary | null;
};

type FixedPartySoul = {
  position: number;
  soulId: number;
  item: ItemSummary | null;
};

type FixedPartySlot = {
  index: number;
  main: FixedPartyUnit | null;
  unison: FixedPartyUnit | null;
  equipment: FixedPartyEquipment | null;
  soul: FixedPartySoul | null;
};

type FixedPartyEntry = {
  id: string;
  slug: string;
  label: string;
  slots: FixedPartySlot[];
  activeUnitCount: number;
  equipmentCount: number;
  soulCount: number;
};

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
    if (!faceCode || lookup[faceCode]) continue;
    lookup[faceCode] = id;
  }
  return lookup;
}

function cleanText(value: unknown): string {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  return !text || text === '(None)' ? '' : text;
}

function toInt(value: unknown): number {
  const parsed = Number.parseInt(cleanText(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNodeIds(value: unknown): number[] {
  const raw = cleanText(value);
  if (!raw) return [];
  return raw
    .split(',')
    .map((token) => Number.parseInt(token.trim(), 10))
    .filter((token) => Number.isFinite(token) && token > 0);
}

function summarizeCharacter(character: ReturnType<typeof parseCharacterAllData>[number]): CharacterSummary {
  return {
    id: character.id,
    faceCode: character.faceCode,
    nameEN: character.nameEN || '',
    nameJP: character.nameJP || '',
    titleEN: character.titleEN || '',
    titleJP: character.titleJP || '',
    attribute: character.attribute || '',
    rarity: character.rarity || '',
    weaponType: character.weaponType || '',
  };
}

function summarizeItem(item: Awaited<ReturnType<typeof getCatalogEntriesForApi>>[number]): ItemSummary {
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    icon: item.icon,
    thumbnail: item.thumbnail,
    category: item.category,
  };
}

function parseUnit(row: string[], blockIndex: number, characterLookup: Record<string, CharacterSummary>): FixedPartyUnit | null {
  const base = 2 + blockIndex * 7;
  const characterId = toInt(row[base]);
  if (characterId <= 0) return null;

  const manaNodeIds = parseNodeIds(row[base + 6]);

  return {
    position: blockIndex,
    characterId,
    level: toInt(row[base + 1]),
    uncapTier: toInt(row[base + 2]),
    rawState: toInt(row[base + 3]),
    rawVariant: toInt(row[base + 4]),
    note: cleanText(row[base + 5]),
    manaNodeIds,
    manaNodeCount: manaNodeIds.length,
    character: characterLookup[String(characterId)] || null,
  };
}

function parseEquipment(row: string[], position: number, itemLookup: Record<string, ItemSummary>): FixedPartyEquipment | null {
  const equipmentId = toInt(row[44 + position * 2]);
  if (equipmentId <= 0) return null;

  return {
    position,
    equipmentId,
    tier: toInt(row[45 + position * 2]),
    item: itemLookup[String(equipmentId)] || null,
  };
}

function parseSoul(row: string[], position: number, itemLookup: Record<string, ItemSummary>): FixedPartySoul | null {
  const soulId = toInt(row[50 + position]);
  if (soulId <= 0) return null;

  return {
    position,
    soulId,
    item: itemLookup[String(soulId)] || null,
  };
}

async function loadFixedParty() {
  const [fixedPartyData, fixedPartyDataEN, characterData, characterIndexData, items] = await Promise.all([
    fetchDatalistJson<FixedPartyPayload>('datalist/party/fixed_party.json'),
    fetchDatalistJson<FixedPartyPayload>('datalist_en/party/fixed_party.json').catch(() => null),
    fetchDatalistJson<CharactersAllPayload>('characters_all_withjp.json').catch(() => fetchDatalistJson<CharactersAllPayload>('characters_all.json')),
    fetchDatalistJson<Record<string, unknown>>('character.json'),
    getCatalogEntriesForApi(),
  ]);

  const faceCodeToId = buildFaceCodeToIdMap(characterIndexData);
  const characters = parseCharacterAllData(characterData, faceCodeToId);

  const characterLookup: Record<string, CharacterSummary> = {};
  for (const character of characters) {
    characterLookup[character.id] = summarizeCharacter(character);
  }

  const itemLookup: Record<string, ItemSummary> = {};
  for (const item of items) {
    itemLookup[item.id] = summarizeItem(item);
  }

  const entries: FixedPartyEntry[] = Object.entries(fixedPartyData)
    .map(([id, row]) => {
      const localizedRow = fixedPartyDataEN?.[id];
      const units = Array.from({ length: 6 }, (_, blockIndex) => parseUnit(row, blockIndex, characterLookup));
      const slots: FixedPartySlot[] = [0, 1, 2].map((index) => ({
        index,
        main: units[index],
        unison: units[index + 3],
        equipment: parseEquipment(row, index, itemLookup),
        soul: parseSoul(row, index, itemLookup),
      }));

      return {
        id,
        slug: cleanText(localizedRow?.[0]) || cleanText(row[0]) || `fixed-party-${id}`,
        label: cleanText(localizedRow?.[1]) || cleanText(row[1]) || 'Fixed Party',
        slots,
        activeUnitCount: slots.reduce((sum, slot) => sum + (slot.main ? 1 : 0) + (slot.unison ? 1 : 0), 0),
        equipmentCount: slots.reduce((sum, slot) => sum + (slot.equipment ? 1 : 0), 0),
        soulCount: slots.reduce((sum, slot) => sum + (slot.soul ? 1 : 0), 0),
      };
    })
    .sort((a, b) => {
      const numericDiff = toInt(a.id) - toInt(b.id);
      if (numericDiff !== 0) return numericDiff;
      return a.slug.localeCompare(b.slug);
    });

  return {
    generatedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  };
}

export async function GET() {
  try {
    const payload = await loadFixedParty();
    return NextResponse.json(payload, { headers: DATA_CACHE_HEADERS });
  } catch (error) {
    console.error('Failed to build fixed party payload:', error);
    return NextResponse.json({ error: 'Failed to load fixed party data.' }, { status: 500 });
  }
}
