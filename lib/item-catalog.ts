import fs from 'node:fs';
import path from 'node:path';

export type CatalogEntryType = 'item' | 'equipment';

export interface ItemCatalogEntry {
  id: string;
  devname: string;
  name: string;
  description: string;
  icon: string;
  rarity: number;
  category: string;
  type: CatalogEntryType;
  flavorText?: string;
  thumbnail?: string;
}

type ItemData = string[];
type DataMap = Record<string, ItemData>;
type Scalar = string | number | boolean | null;
type RelationGroup = 'drops' | 'shops' | 'usage' | 'enhancement' | 'references';

export interface ItemRelationReference {
  sourcePath: string;
  sourceLabel: string;
  group: RelationGroup;
  entryId: string;
  matchPath: string;
  summary: string;
}

export interface ItemDetailData {
  entry: ItemCatalogEntry;
  imageCandidates: string[];
  enhancementOptions: number[];
  hasEnhancementData: boolean;
  relationReferences: ItemRelationReference[];
  equipmentStats: EquipmentStatPoint[];
  equipmentAbilityProfile: EquipmentAbilityProfile | null;
  equipmentAbilities: EquipmentAbilityDetail[];
  equipmentCatalogEntry: EquipmentCatalogEntry | null;
}

type RelationSourceConfig = {
  path: string;
  label: string;
  group: RelationGroup;
  maxEntries?: number;
};

const DATA_FALLBACK_BASE = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';
const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const MAX_RELATION_REFERENCES = 64;
const MAX_MATCHES_PER_ENTRY = 3;
const EQUIPMENT_DEVNAME_CATEGORY_MAP: Record<string, string> = {
  sword: 'Sword',
  axe: 'Axe',
  spear: 'Spear',
  bow: 'Bow',
  staff: 'Staff',
  fist: 'Fist',
  shield: 'Shield',
  acce: 'Accessory',
  gun: 'Gun',
  orb: 'Orb',
  book: 'Book',
};

const RELATION_SOURCES: RelationSourceConfig[] = [
  { path: 'datalist_en/reward/clear_reward.json', label: 'Clear Rewards', group: 'drops', maxEntries: 18 },
  { path: 'datalist_en/reward/periodic_reward.json', label: 'Periodic Rewards', group: 'drops', maxEntries: 12 },
  { path: 'datalist_en/reward/periodic_reward_point.json', label: 'Periodic Reward Points', group: 'drops', maxEntries: 12 },
  { path: 'datalist_en/reward/rare_score_reward.json', label: 'Rare Score Rewards', group: 'drops', maxEntries: 12 },
  { path: 'datalist_en/reward/score_reward.json', label: 'Score Rewards', group: 'drops', maxEntries: 12 },
  { path: 'datalist_en/shop/general_shop.json', label: 'General Shop', group: 'shops', maxEntries: 16 },
  { path: 'datalist_en/shop/boss_coin_shop.json', label: 'Boss Coin Shop', group: 'shops', maxEntries: 16 },
  { path: 'datalist_en/shop/event_item_shop.json', label: 'Event Item Shop', group: 'shops', maxEntries: 16 },
  { path: 'datalist_en/shop/star_grain_shop.json', label: 'Star Grain Shop', group: 'shops', maxEntries: 16 },
  { path: 'datalist_en/shop/star_crumb_exchange.json', label: 'Star Crumb Exchange', group: 'shops', maxEntries: 16 },
  {
    path: 'datalist_en/equipment_enhancement/equipment_enhancement_shop.json',
    label: 'Equipment Enhancement Shop',
    group: 'usage',
    maxEntries: 16,
  },
  {
    path: 'datalist_en/equipment_enhancement/equipment_enhancement_config.json',
    label: 'Equipment Enhancement Config',
    group: 'usage',
    maxEntries: 16,
  },
  { path: 'datalist_en/mana_board/mana_node.json', label: 'Mana Board Node Costs', group: 'usage', maxEntries: 16 },
  { path: 'datalist_en/item/equipment_status.json', label: 'Equipment Status', group: 'references', maxEntries: 12 },
];

const jsonCache = new Map<string, Promise<unknown>>();
let catalogPromise: Promise<ItemCatalogEntry[]> | null = null;

export interface EquipmentStatPoint {
  level: number;
  hp: number;
  atk: number;
}

export interface EquipmentAbilityProfile {
  internalKey: string;
  effectToken: string;
  effectVariantToken: string;
  linkedAbilityIds: string[];
  element: string;
  valueMin: number | null;
  valueMax: number | null;
}

export interface EquipmentAbilityDetail {
  abilityId: string;
  internalKey: string;
  effectToken: string;
  element: string;
  valueMin: number | null;
  valueMax: number | null;
}

export interface EquipmentCatalogEntry {
  devNickname: string;
  rarity: number | null;
  maxHp: number | null;
  maxAtk: number | null;
  categoryHint: string;
  jpName: string;
}

const truncate = (value: string, max = 140): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trim()}...`;
};

const hasImageExtension = (value: string) => /\.(png|jpe?g|webp|gif|svg)$/i.test(value);

const toCdnAssetUrl = (value: string): string => {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const normalized = value.replace(/^\/+/, '');
  if (!normalized) return '';
  return `${CDN_ROOT}/${hasImageExtension(normalized) ? normalized : `${normalized}.png`}`;
};

const parseInteger = (value?: string): number | null => {
  if (value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseNumberLike = (value?: string): number | null => {
  if (value === undefined) return null;
  const token = value.trim();
  if (!token || token === '(None)') return null;
  const parsed = Number.parseInt(token, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const inferEquipmentCategoryFromDevname = (devname: string): string => {
  const prefix = devname.split('_')[0]?.toLowerCase().trim() || '';
  return EQUIPMENT_DEVNAME_CATEGORY_MAP[prefix] || 'Other';
};

const resolveItemCategory = (categoryCode: string, subcategoryCode: string): string => {
  switch (categoryCode) {
    case '0':
      return 'Consumables';
    case '1':
      return 'Currency';
    case '2':
      if (subcategoryCode === '9') return 'Elements';
      if (subcategoryCode === '8') return 'Skill Materials';
      return 'Materials';
    case '3':
      return 'Event Items';
    case '4':
      return 'Tickets';
    case '5':
      return 'Orb Cores';
    case '6':
      return 'Boss Coins';
    case '7':
      return 'Wrightpieces';
    case '8':
      return 'Star Speck';
    case '9':
      return 'Enhancement Stones';
    default:
      return 'Other';
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readLocalJson = (relativePath: string): unknown | null => {
  const localPath = path.join(process.cwd(), 'public', 'data', ...relativePath.split('/'));
  if (!fs.existsSync(localPath)) return null;
  return JSON.parse(fs.readFileSync(localPath, 'utf-8')) as unknown;
};

const fetchRemoteJson = async (relativePath: string): Promise<unknown> => {
  const remoteUrl = `${DATA_FALLBACK_BASE}/${relativePath}`;
  const response = await fetch(remoteUrl, { next: { revalidate: 3600 } });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${remoteUrl} (${response.status})`);
  }
  return (await response.json()) as unknown;
};

const loadJson = async (relativePath: string): Promise<unknown> => {
  const cached = jsonCache.get(relativePath);
  if (cached) return cached;

  const loadPromise = (async () => {
    const local = readLocalJson(relativePath);
    if (local !== null) return local;
    return fetchRemoteJson(relativePath);
  })();

  jsonCache.set(relativePath, loadPromise);
  return loadPromise;
};

const loadDataMap = async (relativePath: string): Promise<DataMap> => {
  const payload = await loadJson(relativePath);
  if (!isRecord(payload)) return {};

  const next: DataMap = {};
  for (const [id, value] of Object.entries(payload)) {
    if (Array.isArray(value)) {
      next[id] = value.map((entry) => (entry === null || entry === undefined ? '' : String(entry)));
    }
  }
  return next;
};

const parseItemCatalog = async (): Promise<ItemCatalogEntry[]> => {
  const [itemsData, equipmentData] = await Promise.all([
    loadDataMap('datalist_en/item/item.json'),
    loadDataMap('datalist_en/item/equipment.json'),
  ]);

  const entries: ItemCatalogEntry[] = [];

  for (const [id, data] of Object.entries(itemsData)) {
    const categoryCode = data[13] || data[14] || '';
    const subcategoryCode = data[14] || data[15] || '';
    const rarityPrimary = parseInteger(data[16]);
    const rarityFallback = parseInteger(data[17]);
    const rarityValue =
      (rarityPrimary !== null && rarityPrimary >= 1 && rarityPrimary <= 5 && rarityPrimary) ||
      (rarityFallback !== null && rarityFallback >= 1 && rarityFallback <= 5 && rarityFallback) ||
      1;

    entries.push({
      id,
      devname: data[0] || '',
      name: data[1] || 'Unknown',
      description: data[4] || '',
      icon: data[2] || '',
      rarity: rarityValue,
      category: resolveItemCategory(categoryCode, subcategoryCode),
      type: 'item',
    });
  }

  for (const [id, data] of Object.entries(equipmentData)) {
    entries.push({
      id,
      devname: data[0] || '',
      name: data[1] || 'Unknown',
      description: data[7] || '',
      flavorText: data[5] || '',
      icon: data[6] || data[3] || '',
      thumbnail: data[4] || '',
      rarity: parseInteger(data[11]) || 5,
      category: 'Equipment',
      type: 'equipment',
    });
  }

  return entries;
};

const getCatalogEntries = async (): Promise<ItemCatalogEntry[]> => {
  if (!catalogPromise) {
    catalogPromise = parseItemCatalog();
  }
  return catalogPromise;
};

const getEnhancementOptionsByEquipmentId = async (): Promise<Record<string, number[]>> => {
  const parseFromPayload = (payload: unknown): Record<string, number[]> => {
    if (!isRecord(payload)) return {};

    const next: Record<string, number[]> = {};
    for (const [equipmentId, rawStatuses] of Object.entries(payload)) {
      if (!isRecord(rawStatuses)) continue;
      const options = Object.keys(rawStatuses)
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => a - b);
      if (options.length > 0) {
        next[equipmentId] = options;
      }
    }
    return next;
  };

  try {
    const datalistPayload = await loadJson('datalist/equipment_enhancement/equipment_enhancement_status.json');
    const parsed = parseFromPayload(datalistPayload);
    if (Object.keys(parsed).length > 0) return parsed;
  } catch {
    // Fallback below.
  }

  const fallbackPayload = await loadJson('datalist_en/equipment_enhancement/equipment_enhancement_status.json');
  return parseFromPayload(fallbackPayload);
};

const getEquipmentStatusMap = async (): Promise<Record<string, unknown>> => {
  const payload = await loadJson('datalist_en/item/equipment_status.json');
  return isRecord(payload) ? payload : {};
};

const getAbilitySoulMap = async (): Promise<Record<string, string[]>> => {
  const payload = await loadJson('datalist_en/ability/ability_soul.json');
  if (!isRecord(payload)) return {};

  const next: Record<string, string[]> = {};
  for (const [id, value] of Object.entries(payload)) {
    if (!Array.isArray(value)) continue;
    next[id] = value.map((entry) => (entry === null || entry === undefined ? '' : String(entry)));
  }
  return next;
};

const getAbilityDataMap = async (): Promise<Record<string, string[]>> => {
  return loadDataMap('datalist_en/ability/ability.json');
};

const getEquipmentCatalogMap = async (): Promise<Record<string, EquipmentCatalogEntry>> => {
  let payload: unknown = readLocalJson('equips.json');
  if (payload === null) {
    try {
      payload = await loadJson('equips.json');
    } catch {
      return {};
    }
  }

  if (!Array.isArray(payload)) return {};

  const next: Record<string, EquipmentCatalogEntry> = {};
  for (const rawRow of payload) {
    if (!isRecord(rawRow)) continue;

    const devNickname = String(rawRow.DevNicknames || '').trim();
    if (!devNickname) continue;

    next[devNickname] = {
      devNickname,
      rarity: parseNumberLike(String(rawRow.Rarity || '')),
      maxHp: parseNumberLike(String(rawRow.MaxHP || '')),
      maxAtk: parseNumberLike(String(rawRow.MaxATK || '')),
      categoryHint: inferEquipmentCategoryFromDevname(devNickname),
      jpName: String(rawRow.JPName || '').trim(),
    };
  }

  return next;
};

const buildEquipmentStats = (equipmentId: string, equipmentStatusMap: Record<string, unknown>): EquipmentStatPoint[] => {
  const rawStatus = equipmentStatusMap[equipmentId];
  if (!isRecord(rawStatus)) return [];

  const points: EquipmentStatPoint[] = [];
  for (const [levelToken, rawValues] of Object.entries(rawStatus)) {
    const level = Number.parseInt(levelToken, 10);
    if (!Number.isFinite(level) || level <= 0) continue;
    if (!Array.isArray(rawValues)) continue;

    const hp = parseNumberLike(String(rawValues[0] ?? ''));
    const atk = parseNumberLike(String(rawValues[1] ?? ''));
    if (hp === null && atk === null) continue;

    points.push({
      level,
      hp: hp ?? 0,
      atk: atk ?? 0,
    });
  }

  return points.sort((a, b) => a.level - b.level);
};

const buildEquipmentAbilityProfile = (abilitySoulRow: string[] | undefined): EquipmentAbilityProfile | null => {
  if (!abilitySoulRow || abilitySoulRow.length === 0) return null;

  const internalKey = abilitySoulRow[0]?.trim() || '';
  const effectToken = abilitySoulRow[2]?.trim() || '';
  const effectVariantToken = abilitySoulRow[3]?.trim() || '';
  const linkedAbilityIds = [abilitySoulRow[6], abilitySoulRow[7]]
    .map((value) => (value || '').trim())
    .filter((value) => /^\d+$/.test(value) && value !== '0');
  const element = (abilitySoulRow[46] || abilitySoulRow[8] || '').trim();

  const primaryValueMin = parseNumberLike(abilitySoulRow[48]);
  const primaryValueMax = parseNumberLike(abilitySoulRow[49]);
  const fallbackValueMin = parseNumberLike(abilitySoulRow[95]);
  const fallbackValueMax = parseNumberLike(abilitySoulRow[96]);

  const valueMin = primaryValueMin ?? fallbackValueMin;
  const valueMax = primaryValueMax ?? fallbackValueMax;

  if (!internalKey && !effectToken && linkedAbilityIds.length === 0 && element === '' && valueMin === null && valueMax === null) {
    return null;
  }

  return {
    internalKey,
    effectToken,
    effectVariantToken,
    linkedAbilityIds,
    element,
    valueMin,
    valueMax,
  };
};

const buildEquipmentAbilities = (
  abilitySoulRow: string[] | undefined,
  abilityDataMap: Record<string, string[]>
): EquipmentAbilityDetail[] => {
  if (!abilitySoulRow || abilitySoulRow.length === 0) return [];

  // Common columns in ability_soul that reference ability.json IDs.
  const candidateIndices = [44, 161, 278, 24, 141, 395, 91, 148, 31, 258, 224, 225, 265, 45, 49, 208];
  const ids = new Set<string>();

  const tryAdd = (token: string | undefined) => {
    if (!token) return;
    const normalized = token.trim();
    if (!/^\d+$/.test(normalized)) return;
    if (normalized === '0') return;
    if (Object.prototype.hasOwnProperty.call(abilityDataMap, normalized)) {
      ids.add(normalized);
    }
  };

  candidateIndices.forEach((index) => tryAdd(abilitySoulRow[index]));

  // Fallback for unusual rows where IDs appear in different slots.
  if (ids.size === 0) {
    for (const token of abilitySoulRow) {
      if (ids.size >= 6) break;
      tryAdd(token);
    }
  }

  return [...ids]
    .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
    .map((abilityId) => {
      const row = abilityDataMap[abilityId] || [];
      return {
        abilityId,
        internalKey: (row[0] || '').trim(),
        effectToken: (row[2] || '').trim(),
        element: (row[46] || '').trim(),
        valueMin: parseNumberLike(row[48]),
        valueMax: parseNumberLike(row[49]),
      };
    });
};

const collectScalarSamples = (value: unknown, bucket: string[], depth = 0): void => {
  if (bucket.length >= 6 || depth > 5) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectScalarSamples(item, bucket, depth + 1);
      if (bucket.length >= 6) return;
    }
    return;
  }

  if (isRecord(value)) {
    for (const nested of Object.values(value)) {
      collectScalarSamples(nested, bucket, depth + 1);
      if (bucket.length >= 6) return;
    }
    return;
  }

  if (value === null || value === undefined) return;
  const text = String(value).trim();
  if (!text || text === '(None)') return;
  if (text.length < 2) return;

  const hasLetters = /[A-Za-z]/.test(text);
  if (!hasLetters && !/^\d+$/.test(text)) return;
  bucket.push(text);
};

const summarizeEntry = (entry: unknown): string => {
  const samples: string[] = [];
  collectScalarSamples(entry, samples);
  if (samples.length === 0) return 'Referenced entry';
  return truncate(samples.join(' | '), 150);
};

const scalarMatchesId = (value: Scalar, targetId: string): boolean => {
  if (typeof value === 'number') {
    return Number.isInteger(value) && String(value) === targetId;
  }
  if (typeof value !== 'string') return false;

  const token = value.trim();
  if (!token || token === '(None)') return false;
  if (token === targetId) return true;

  if (/^\d+(,\d+)+$/.test(token)) {
    return token.split(',').some((part) => part === targetId);
  }

  return false;
};

const collectMatchPaths = (value: unknown, targetId: string, pathParts: string[] = [], depth = 0): string[] => {
  if (depth > 8) return [];

  const matches: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((nested, index) => {
      matches.push(...collectMatchPaths(nested, targetId, [...pathParts, String(index)], depth + 1));
    });
    return matches;
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([key, nested]) => {
      matches.push(...collectMatchPaths(nested, targetId, [...pathParts, key], depth + 1));
    });
    return matches;
  }

  if (scalarMatchesId(value as Scalar, targetId)) {
    matches.push(pathParts.join('.'));
  }

  return matches;
};

const gatherReferencesFromSource = async (
  targetId: string,
  sourceConfig: RelationSourceConfig
): Promise<ItemRelationReference[]> => {
  const payload = await loadJson(sourceConfig.path);
  if (!isRecord(payload)) return [];

  const references: ItemRelationReference[] = [];

  for (const [entryId, entryValue] of Object.entries(payload)) {
    const allMatches = collectMatchPaths(entryValue, targetId);
    if (allMatches.length === 0) continue;

    const matchPaths = [...new Set(allMatches)].slice(0, MAX_MATCHES_PER_ENTRY);
    references.push({
      sourcePath: sourceConfig.path,
      sourceLabel: sourceConfig.label,
      group: sourceConfig.group,
      entryId,
      matchPath: matchPaths.join(', '),
      summary: summarizeEntry(entryValue),
    });

    if (sourceConfig.maxEntries && references.length >= sourceConfig.maxEntries) {
      break;
    }
  }

  return references;
};

const sortReferences = (references: ItemRelationReference[]): ItemRelationReference[] => {
  const groupOrder: Record<RelationGroup, number> = {
    drops: 1,
    shops: 2,
    usage: 3,
    enhancement: 4,
    references: 5,
  };

  return [...references].sort((a, b) => {
    const groupDiff = groupOrder[a.group] - groupOrder[b.group];
    if (groupDiff !== 0) return groupDiff;
    const sourceDiff = a.sourceLabel.localeCompare(b.sourceLabel, undefined, { sensitivity: 'base' });
    if (sourceDiff !== 0) return sourceDiff;
    return a.entryId.localeCompare(b.entryId, undefined, { numeric: true, sensitivity: 'base' });
  });
};

export const getItemImageCandidates = (entry: Pick<ItemCatalogEntry, 'thumbnail' | 'icon'>): string[] => {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const pushCandidate = (raw?: string) => {
    if (!raw || !raw.trim()) return;
    const url = toCdnAssetUrl(raw.trim());
    if (!url || seen.has(url)) return;
    seen.add(url);
    candidates.push(url);
  };

  pushCandidate(entry.thumbnail);
  pushCandidate(entry.icon);
  return candidates;
};

export const getCatalogEntryByType = async (
  type: CatalogEntryType,
  id: string
): Promise<ItemCatalogEntry | null> => {
  const normalizedId = id.trim();
  if (!normalizedId) return null;

  const entries = await getCatalogEntries();
  return entries.find((entry) => entry.type === type && entry.id === normalizedId) || null;
};

export const getCatalogEntriesForApi = async (): Promise<ItemCatalogEntry[]> => {
  return getCatalogEntries();
};

export const getItemDetailData = async (
  type: CatalogEntryType,
  id: string
): Promise<ItemDetailData | null> => {
  const entry = await getCatalogEntryByType(type, id);
  if (!entry) return null;

  const enhancementOptionsPromise: Promise<Record<string, number[]>> =
    type === 'equipment' ? getEnhancementOptionsByEquipmentId() : Promise.resolve<Record<string, number[]>>({});
  const enhancementRegistryPromise: Promise<unknown> =
    type === 'equipment' ? loadJson('datalist_en/equipment_enhancement/equipment_enhancement.json') : Promise.resolve({});
  const equipmentStatusPromise: Promise<Record<string, unknown>> =
    type === 'equipment' ? getEquipmentStatusMap() : Promise.resolve<Record<string, unknown>>({});
  const abilitySoulPromise: Promise<Record<string, string[]>> =
    type === 'equipment' ? getAbilitySoulMap() : Promise.resolve<Record<string, string[]>>({});
  const abilityDataPromise: Promise<Record<string, string[]>> =
    type === 'equipment' ? getAbilityDataMap() : Promise.resolve<Record<string, string[]>>({});
  const equipmentCatalogPromise: Promise<Record<string, EquipmentCatalogEntry>> =
    type === 'equipment' ? getEquipmentCatalogMap() : Promise.resolve<Record<string, EquipmentCatalogEntry>>({});

  const [
    enhancementOptionsById,
    enhancementTable,
    equipmentStatusMap,
    abilitySoulMap,
    abilityDataMap,
    equipmentCatalogMap,
    ...sourceReferences
  ] = await Promise.all([
    enhancementOptionsPromise,
    enhancementRegistryPromise,
    equipmentStatusPromise,
    abilitySoulPromise,
    abilityDataPromise,
    equipmentCatalogPromise,
    ...RELATION_SOURCES.map((config) => gatherReferencesFromSource(entry.id, config)),
  ]);

  const references = sourceReferences.flat();
  const enhancementOptions = type === 'equipment' ? enhancementOptionsById[entry.id] || [] : [];
  const enhancementTableRecord = isRecord(enhancementTable) ? enhancementTable : {};

  const hasEnhancementData =
    type === 'equipment' &&
    (enhancementOptions.length > 0 || Object.prototype.hasOwnProperty.call(enhancementTableRecord, entry.id));

  if (hasEnhancementData) {
    references.push({
      sourcePath: 'datalist_en/equipment_enhancement/equipment_enhancement.json',
      sourceLabel: 'Enhanceable Equipment Registry',
      group: 'enhancement',
      entryId: entry.id,
      matchPath: '(root)',
      summary: 'Equipment appears in enhancement registry.',
    });
  }

  const equipmentStats = type === 'equipment' ? buildEquipmentStats(entry.id, equipmentStatusMap) : [];
  const abilitySoulRow = type === 'equipment' ? abilitySoulMap[entry.id] : undefined;
  const equipmentAbilityProfile = type === 'equipment' ? buildEquipmentAbilityProfile(abilitySoulRow) : null;
  const equipmentAbilities = type === 'equipment' ? buildEquipmentAbilities(abilitySoulRow, abilityDataMap) : [];
  const equipmentCatalogEntry = type === 'equipment' ? equipmentCatalogMap[entry.devname] || null : null;

  return {
    entry,
    imageCandidates: getItemImageCandidates(entry),
    enhancementOptions,
    hasEnhancementData,
    relationReferences: sortReferences(references).slice(0, MAX_RELATION_REFERENCES),
    equipmentStats,
    equipmentAbilityProfile,
    equipmentAbilities,
    equipmentCatalogEntry,
  };
};
