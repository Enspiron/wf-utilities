import { fetchDatalistJson, fetchOrderedMapJson, IS_PRODUCTION } from '@/lib/data-source';
import { parseCharacterAllData, type Character } from '@/lib/character-parser';
import { getCatalogEntriesForApi } from '@/lib/item-catalog';
import { parseOrderedMapJson, type ParsedItem } from '@/lib/json-parser';
import {
  SEARCH_OPERATOR_HINTS,
  searchDocuments,
  toSearchApiResult,
  type SearchApiResult,
  type SearchDocument,
} from '@/lib/search/core';
import {
  buildAbilitySearchDocument,
  buildAchievementSearchDocument,
  buildCharacterSearchDocument,
  buildItemSearchDocument,
  buildPageSearchDocuments,
  buildQuestSearchDocument,
  rowsFromAbilityOrderedMap,
  rowsFromAchievementOrderedMap,
} from '@/lib/search/documents';

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
    if (!faceCode || lookup[faceCode]) continue;
    lookup[faceCode] = id;
  }
  return lookup;
}

async function loadCharacters(): Promise<Character[]> {
  const [characterData, characterIndexData] = await Promise.all([
    fetchDatalistJson<CharactersAllPayload>('characters_all.json'),
    fetchDatalistJson<Record<string, unknown>>('character.json'),
  ]);

  const faceCodeToId = buildFaceCodeToIdMap(characterIndexData);
  return parseCharacterAllData(characterData, faceCodeToId);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }
  if (typeof value === 'string' && value.length > 0) return [value];
  return [];
}

async function loadQuestFiles(): Promise<string[]> {
  try {
    const manifest = await fetchDatalistJson<{ filesByCategory?: Record<string, unknown> }>('manifest_en.json');
    const files = toStringArray(manifest.filesByCategory?.quest);
    if (files.length > 0) return files;
  } catch {
    // fall through to local walk
  }

  if (IS_PRODUCTION) return [];

  const fs = await import('fs/promises');
  const path = await import('path');
  const baseDir = path.join(process.cwd(), 'public', 'data', 'datalist_en', 'quest');
  const files: string[] = [];

  const walk = async (dir: string, relative = ''): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(fullPath, relativePath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(relativePath.replace(/\.json$/i, ''));
      }
    }
  };

  try {
    await walk(baseDir);
  } catch {
    return [];
  }

  return files;
}

async function loadQuests(): Promise<ParsedItem[]> {
  const files = await loadQuestFiles();
  const payloads = await Promise.all(
    files.map(async (file) => {
      const data = await fetchOrderedMapJson<Record<string, unknown>>(`datalist_en/quest/${file}.json`);
      if (!data) return [];
      const items = parseOrderedMapJson(data, 'quest');
      for (const item of items) {
        item.data._sourceFile = file;
      }
      return items;
    })
  );

  return payloads.flat();
}

async function loadAbilityRows() {
  const sources = ['ability', 'leader_ability', 'ability_soul'] as const;
  const payloads = await Promise.all(
    sources.map((source) => fetchOrderedMapJson<Record<string, unknown>>(`datalist_en/ability/${source}.json`))
  );

  return payloads.flatMap((payload, index) => {
    if (!payload) return [];
    return rowsFromAbilityOrderedMap(payload, sources[index]);
  });
}

async function loadAchievementRows() {
  const payload = await fetchOrderedMapJson<Record<string, unknown>>('datalist_en/degree/degree.json');
  return payload ? rowsFromAchievementOrderedMap(payload) : [];
}

let globalSearchIndexPromise: Promise<SearchDocument[]> | null = null;

async function buildGlobalSearchIndex(): Promise<SearchDocument[]> {
  const [characters, items, quests, abilities, achievements] = await Promise.all([
    loadCharacters(),
    getCatalogEntriesForApi(),
    loadQuests(),
    loadAbilityRows(),
    loadAchievementRows(),
  ]);

  return [
    ...buildPageSearchDocuments(),
    ...characters.map((character) => buildCharacterSearchDocument(character)),
    ...items.map((item) => buildItemSearchDocument(item)),
    ...quests.map((quest) => buildQuestSearchDocument(quest)),
    ...abilities.map((row) => buildAbilitySearchDocument(row)),
    ...achievements.map((row) => buildAchievementSearchDocument(row)),
  ];
}

export async function loadGlobalSearchIndex(): Promise<SearchDocument[]> {
  if (!globalSearchIndexPromise) {
    globalSearchIndexPromise = buildGlobalSearchIndex();
  }
  return globalSearchIndexPromise;
}

export async function searchGlobalIndex(
  query: string,
  limit = 40
): Promise<{ results: SearchApiResult[]; operators: readonly string[] }> {
  const index = await loadGlobalSearchIndex();
  const { query: parsedQuery, results } = searchDocuments(index, query, { limit });

  return {
    results: results.map((result) => toSearchApiResult(result, parsedQuery)),
    operators: SEARCH_OPERATOR_HINTS,
  };
}
