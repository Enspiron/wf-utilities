import path from 'path';

type JsonRecord = Record<string, unknown>;

const USE_CDN = process.env.VERCEL === '1';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';
const CACHE_TTL_MS = 10 * 60 * 1000;
const NONE_TOKEN = '(None)';

export interface ManaBoardCharacterListItem {
  id: string;
  nameEn: string;
  nameJp: string;
  faceCode: string;
  group: string;
  boards: string[];
  boardNodeCounts: Record<string, number>;
  hasBoard2: boolean;
}

export interface ManaBoardGroupRequirement {
  levelRequirements: number[];
  rawLevelEntries: string[];
  board2ConditionIds: string[];
}

export interface ManaBoardListPayload {
  characters: ManaBoardCharacterListItem[];
  requirementsByGroup: Record<string, ManaBoardGroupRequirement>;
}

export interface ManaBoardMaterialCost {
  itemId: string;
  amount: number;
  name: string;
  iconPath: string | null;
}

export interface ManaBoardNode {
  index: number;
  nodeId: string;
  manaCost: number;
  nodeType: number;
  tier: number | null;
  materials: ManaBoardMaterialCost[];
}

export interface ManaBoardUpskillSlot {
  slot: number;
  key: string | null;
  descriptionEn: string | null;
  descriptionJp: string | null;
}

export interface ManaBoardBoardSummary {
  totalMana: number;
  totalNodes: number;
}

export interface ManaBoardCharacterPayload {
  id: string;
  group: string;
  boards: Record<string, ManaBoardNode[]>;
  boardSummaries: Record<string, ManaBoardBoardSummary>;
  upskills: ManaBoardUpskillSlot[];
  requirement: ManaBoardGroupRequirement | null;
  characterKit: ManaBoardCharacterKit | null;
}

export interface ManaBoardCharacterKit {
  devNickname: string;
  enName: string | null;
  jpName: string | null;
  skill: string | null;
  leaderBuff: string | null;
  abilities: string[];
  skillWait: string | null;
}

interface ManaBoardDatasets {
  manaNode: JsonRecord;
  upskill: JsonRecord;
  upskillText: JsonRecord;
  upskillTextIos: JsonRecord;
  characterData: JsonRecord;
  characterTextEn: JsonRecord;
  characterTextJp: JsonRecord;
  itemData: JsonRecord;
  levelRequired: JsonRecord;
  boardOpenCondition: JsonRecord;
  charactersAll: CharacterAllFile;
}

interface CharacterAllEntry {
  DevNicknames?: string;
  ENName?: string;
  JPName?: string;
  Skill?: string;
  LeaderBuff?: string;
  Ability1?: string;
  Ability2?: string;
  Ability3?: string;
  Ability4?: string;
  Ability5?: string;
  Ability6?: string;
  SkillWait?: string | number;
}

interface CharacterAllFile {
  chars?: CharacterAllEntry[];
}

let datasetsCache: { loadedAt: number; data: ManaBoardDatasets } | null = null;

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as JsonRecord;
}

function normalizeRow(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  if (Array.isArray(value[0])) {
    return Array.isArray(value[0]) ? (value[0] as unknown[]) : [];
  }
  return value;
}

function cleanToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === NONE_TOKEN) return null;
  return trimmed;
}

function toNumber(value: unknown): number | null {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function parseCsvTokens(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token && token !== NONE_TOKEN);
}

function parseCsvNumbers(value: unknown): number[] {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((token) => toNumber(token.trim()))
    .filter((token): token is number => token !== null);
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string') {
    return cleanToken(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const token = cleanToken(entry);
      if (token) return token;
    }
  }
  return null;
}

function humanizeSkillKey(key: string): string {
  const sentenceMap: Record<string, string> = {
    ability_damage_up: 'Increases ability damage.',
    adversity_up: 'Strengthens effects that activate at low HP.',
    barrier_up: 'Increases barrier effectiveness.',
    coffin_reduce: 'Shortens coffin count recovery time.',
    combo_count_up: 'Increases combo count gain.',
    comboboost_up: 'Strengthens combo boost effects.',
    common_attack_up: 'Increases damage.',
    condition_attack_up: 'Strengthens attack-up effects.',
    condition_debuff_resistance_up: 'Strengthens debuff resistance effects.',
    condition_directattack_more: 'Increases direct-attack hit count.',
    condition_directdamage_up: 'Strengthens direct-attack damage-up effects.',
    condition_effect_allelement_up: 'Strengthens all-element resistance down effects on enemies.',
    condition_effect_attack_power_down: 'Strengthens attack down effects on enemies.',
    condition_effect_black_up: 'Strengthens Dark resistance down effects on enemies.',
    condition_effect_blue_up: 'Strengthens Water resistance down effects on enemies.',
    condition_effect_green_up: 'Strengthens Wind resistance down effects on enemies.',
    condition_effect_paralysis_up: 'Strengthens paralysis effects.',
    condition_effect_poison_up: 'Strengthens poison effects.',
    condition_effect_red_up: 'Strengthens Fire resistance down effects on enemies.',
    condition_effect_stun_up: 'Strengthens stun effects.',
    condition_effect_white_up: 'Strengthens Light resistance down effects on enemies.',
    condition_effect_yellow_up: 'Strengthens Thunder resistance down effects on enemies.',
    condition_fever_point_up: 'Increases Fever gauge gain rate.',
    condition_flying_up: 'Strengthens Levitate effects.',
    condition_piercing_up: 'Strengthens Pierce effects.',
    condition_regeneration_up: 'Strengthens regeneration effects.',
    condition_slow: 'Strengthens slow effects.',
    condition_stun_wince: 'Increases bonus damage against stunned enemies.',
    damage_cut_black: 'Strengthens Dark damage cut effects.',
    damage_cut_red: 'Strengthens Fire damage cut effects.',
    heal_up: 'Increases healing amount.',
    invinceble_up: 'Strengthens invincibility effects.',
    multiball_up: 'Strengthens multiball performance.',
    powerflip_damage_up: 'Increases Power Flip damage.',
    resistance_allelement: 'Increases all-element resistance effects.',
    resistance_black: 'Increases Dark resistance effects.',
    resistance_blue: 'Increases Water resistance effects.',
    resistance_green: 'Increases Wind resistance effects.',
    resistance_red: 'Increases Fire resistance effects.',
    resistance_white: 'Increases Light resistance effects.',
    resistance_yellow: 'Increases Thunder resistance effects.',
    skill_damage_up: 'Increases skill damage.',
    skill_gauge_up: 'Increases skill gauge gain.',
    speed_up: 'Increases movement speed effects.',
  };

  const mapped = sentenceMap[key];
  if (mapped) return mapped;

  const fallback = key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `Enhances ${fallback}.`;
}

function compareBoardIds(a: string, b: string): number {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b);
}

async function loadJson(relativePath: string): Promise<unknown> {
  if (USE_CDN) {
    const url = `${GITHUB_RAW_URL}/${relativePath}`;
    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${relativePath}: ${response.status}`);
    }
    return response.json();
  }

  const fs = await import('fs/promises');
  const fullPath = path.join(process.cwd(), 'public', 'data', ...relativePath.split('/'));
  const file = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(file);
}

export async function loadManaBoardDatasets(): Promise<ManaBoardDatasets> {
  if (datasetsCache && Date.now() - datasetsCache.loadedAt < CACHE_TTL_MS) {
    return datasetsCache.data;
  }

  const [
    manaNode,
    upskill,
    upskillText,
    upskillTextIos,
    characterData,
    characterTextEn,
    characterTextJp,
    itemData,
    levelRequired,
    boardOpenCondition,
    charactersAll,
  ] = await Promise.all([
    loadJson('datalist_en/mana_board/mana_node.json'),
    loadJson('datalist_en/mana_board/upskill.json'),
    loadJson('datalist/mana_board/upskill_text.json'),
    loadJson('datalist/mana_board/upskill_text_iosbundled.json'),
    loadJson('datalist_en/character/character.json'),
    loadJson('datalist_en/character/character_text.json'),
    loadJson('datalist/character/character_text.json'),
    loadJson('datalist_en/item/item.json'),
    loadJson('datalist/mana_board/level_required_mana_node.json'),
    loadJson('datalist/mana_board/board_open_condition.json'),
    loadJson('characters_all_withjp.json').catch(() => loadJson('characters_all.json')),
  ]);

  const data: ManaBoardDatasets = {
    manaNode: asRecord(manaNode),
    upskill: asRecord(upskill),
    upskillText: asRecord(upskillText),
    upskillTextIos: asRecord(upskillTextIos),
    characterData: asRecord(characterData),
    characterTextEn: asRecord(characterTextEn),
    characterTextJp: asRecord(characterTextJp),
    itemData: asRecord(itemData),
    levelRequired: asRecord(levelRequired),
    boardOpenCondition: asRecord(boardOpenCondition),
    charactersAll: (charactersAll && typeof charactersAll === 'object' ? (charactersAll as CharacterAllFile) : {}) as CharacterAllFile,
  };

  datasetsCache = { loadedAt: Date.now(), data };
  return data;
}

function parseGroupRequirements(datasets: ManaBoardDatasets): Record<string, ManaBoardGroupRequirement> {
  const output: Record<string, ManaBoardGroupRequirement> = {};

  for (const [group, value] of Object.entries(datasets.levelRequired)) {
    const row = normalizeRow(value);
    const rawLevelEntries = row.map((entry) => String(entry ?? '')).map((entry) => entry.trim());
    const levelRequirements = row
      .map((entry) => toNumber(entry))
      .filter((entry): entry is number => entry !== null);

    const boardConditionRaw = asRecord(datasets.boardOpenCondition[group]);
    const board2ConditionIds = normalizeRow(boardConditionRaw['2'])
      .map((entry) => cleanToken(entry))
      .filter((entry): entry is string => entry !== null);

    output[group] = {
      levelRequirements,
      rawLevelEntries,
      board2ConditionIds,
    };
  }

  return output;
}

function normalizeLookupToken(value: string): string {
  return value.trim().toLowerCase();
}

function findCharacterKitByDevNickname(
  faceCode: string,
  charactersAll: CharacterAllFile,
): CharacterAllEntry | null {
  const chars = Array.isArray(charactersAll.chars) ? charactersAll.chars : [];
  if (!faceCode || chars.length === 0) return null;

  const lookup = normalizeLookupToken(faceCode);
  let fallback: CharacterAllEntry | null = null;

  for (const entry of chars) {
    const dev = cleanToken(entry.DevNicknames);
    if (!dev) continue;
    const normalizedDev = normalizeLookupToken(dev);

    if (normalizedDev === lookup) {
      return entry;
    }

    // Fallback if one side has variant suffixes, e.g. "_1", "_anv", etc.
    if (!fallback && (normalizedDev.startsWith(lookup) || lookup.startsWith(normalizedDev))) {
      fallback = entry;
    }
  }

  return fallback;
}

function parseCharacterKit(entry: CharacterAllEntry | null, faceCode: string): ManaBoardCharacterKit | null {
  if (!entry) return null;

  const abilities = [entry.Ability1, entry.Ability2, entry.Ability3, entry.Ability4, entry.Ability5, entry.Ability6]
    .map((value) => cleanToken(value))
    .filter((value): value is string => value !== null);

  const waitRaw = typeof entry.SkillWait === 'number' ? String(entry.SkillWait) : cleanToken(entry.SkillWait);

  return {
    devNickname: cleanToken(entry.DevNicknames) ?? faceCode,
    enName: cleanToken(entry.ENName),
    jpName: cleanToken(entry.JPName),
    skill: cleanToken(entry.Skill),
    leaderBuff: cleanToken(entry.LeaderBuff),
    abilities,
    skillWait: waitRaw,
  };
}

function parseFallbackCharacterKitFromText(
  id: string,
  datasets: ManaBoardDatasets,
  faceCode: string,
): ManaBoardCharacterKit | null {
  const textEn = normalizeRow(datasets.characterTextEn[id]);
  const textJp = normalizeRow(datasets.characterTextJp[id]);

  const skillName = cleanToken(textEn[4]) ?? cleanToken(textJp[4]);
  const skillDesc = cleanToken(textEn[5]) ?? cleanToken(textJp[5]);
  const leaderName = cleanToken(textEn[8]) ?? cleanToken(textJp[8]);
  const enName = cleanToken(textEn[0]) ?? cleanToken(textJp[0]);
  const jpName = cleanToken(textJp[0]) ?? cleanToken(textEn[0]);

  const skill = skillName && skillDesc ? `[${skillName}]\n${skillDesc}` : skillDesc ?? skillName;
  const leaderBuff = leaderName ? `[${leaderName}]` : null;

  if (!skill && !leaderBuff) return null;

  return {
    devNickname: faceCode,
    enName,
    jpName,
    skill,
    leaderBuff,
    abilities: [],
    skillWait: null,
  };
}

export function buildManaBoardListPayload(datasets: ManaBoardDatasets): ManaBoardListPayload {
  const characters: ManaBoardCharacterListItem[] = [];

  for (const [id, value] of Object.entries(datasets.manaNode)) {
    const boardRecord = asRecord(value);
    const boardIds = Object.keys(boardRecord).sort(compareBoardIds);

    const boardNodeCounts: Record<string, number> = {};
    for (const boardId of boardIds) {
      const nodeRecord = asRecord(boardRecord[boardId]);
      boardNodeCounts[boardId] = Object.keys(nodeRecord).length;
    }

    const charRow = normalizeRow(datasets.characterData[id]);
    const enText = normalizeRow(datasets.characterTextEn[id]);
    const jpText = normalizeRow(datasets.characterTextJp[id]);

    const nameEn = cleanToken(enText[0]) ?? cleanToken(jpText[0]) ?? id;
    const nameJp = cleanToken(jpText[0]) ?? cleanToken(enText[1]) ?? nameEn;

    characters.push({
      id,
      nameEn,
      nameJp,
      faceCode: cleanToken(charRow[0]) ?? '',
      group: cleanToken(charRow[2]) ?? '',
      boards: boardIds,
      boardNodeCounts,
      hasBoard2: boardIds.includes('2'),
    });
  }

  characters.sort((a, b) => {
    const byName = a.nameEn.localeCompare(b.nameEn, undefined, { sensitivity: 'base', numeric: true });
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  return {
    characters,
    requirementsByGroup: parseGroupRequirements(datasets),
  };
}

export function buildManaBoardCharacterPayload(
  id: string,
  datasets: ManaBoardDatasets,
): ManaBoardCharacterPayload | null {
  const boardRecord = asRecord(datasets.manaNode[id]);
  const boardIds = Object.keys(boardRecord).sort(compareBoardIds);
  if (boardIds.length === 0) return null;

  const charRow = normalizeRow(datasets.characterData[id]);
  const faceCode = cleanToken(charRow[0]) ?? '';
  const group = cleanToken(charRow[2]) ?? '';

  const boards: Record<string, ManaBoardNode[]> = {};
  const boardSummaries: Record<string, ManaBoardBoardSummary> = {};

  for (const boardId of boardIds) {
    const nodeRecord = asRecord(boardRecord[boardId]);
    const nodeEntries = Object.entries(nodeRecord)
      .map(([index, raw]) => {
        const row = normalizeRow(raw);
        const materialIds = parseCsvTokens(row[2]);
        const materialCounts = parseCsvNumbers(row[3]);

        const materials = materialIds
          .map((itemId, idx): ManaBoardMaterialCost | null => {
            const amount = materialCounts[idx] ?? 0;
            if (amount <= 0) return null;

            const itemRow = normalizeRow(datasets.itemData[itemId]);
            return {
              itemId,
              amount,
              name: cleanToken(itemRow[1]) ?? itemId,
              iconPath: cleanToken(itemRow[2]),
            };
          })
          .filter((entry): entry is ManaBoardMaterialCost => entry !== null);

        const parsedTier = toNumber(row[6]);

        return {
          index: Number.parseInt(index, 10) || 0,
          node: {
            index: Number.parseInt(index, 10) || 0,
            nodeId: cleanToken(row[0]) ?? index,
            manaCost: toNumber(row[4]) ?? 0,
            nodeType: toNumber(row[5]) ?? 0,
            tier: parsedTier && parsedTier > 0 ? parsedTier : null,
            materials,
          } satisfies ManaBoardNode,
        };
      })
      .sort((a, b) => a.index - b.index);

    const nodes = nodeEntries.map((entry) => entry.node);
    boards[boardId] = nodes;

    boardSummaries[boardId] = {
      totalMana: nodes.reduce((sum, node) => sum + node.manaCost, 0),
      totalNodes: nodes.length,
    };
  }

  const upskillRow = normalizeRow(datasets.upskill[id]);
  const upskills: ManaBoardUpskillSlot[] = Array.from({ length: 12 }, (_, idx) => {
    const key = cleanToken(upskillRow[idx]);
    if (!key) {
      return {
        slot: idx + 1,
        key: null,
        descriptionEn: null,
        descriptionJp: null,
      };
    }

    const descriptionJp = firstString(datasets.upskillText[key]) ?? firstString(datasets.upskillTextIos[key]);

    return {
      slot: idx + 1,
      key,
      descriptionEn: humanizeSkillKey(key),
      descriptionJp,
    };
  });

  const requirementsByGroup = parseGroupRequirements(datasets);
  const characterKit =
    parseCharacterKit(findCharacterKitByDevNickname(faceCode, datasets.charactersAll), faceCode) ??
    parseFallbackCharacterKitFromText(id, datasets, faceCode);

  return {
    id,
    group,
    boards,
    boardSummaries,
    upskills,
    requirement: group ? requirementsByGroup[group] ?? null : null,
    characterKit,
  };
}

