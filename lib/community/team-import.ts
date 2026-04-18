import { getCompTokenMaps } from '@/lib/community/catalog';
import { parseEliyaCompTokens } from '@/lib/community/eliya';
import type { TeamBuild, TeamImportPayload } from '@/lib/community/types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getObjectOrArrayEntries(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    return value.map((entry, index) => [String(index), entry] as [string, unknown]);
  }
  if (isObject(value)) {
    return Object.entries(value);
  }
  return [];
}

function toNumeric(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeTriplet(value: unknown): number[] {
  const source = Array.isArray(value) ? value : [];
  const result = [0, 0, 0];
  for (let index = 0; index < 3; index += 1) {
    result[index] = Math.max(0, toNumeric(source[index], 0));
  }
  return result;
}

function normalizeBuildFromSlot(slot: Record<string, unknown>): TeamBuild {
  return {
    mainUnitIds: normalizeTriplet(slot.character_ids),
    unisonUnitIds: normalizeTriplet(slot.unison_character_ids),
    equipmentIds: normalizeTriplet(slot.equipment_ids),
    soulIds: normalizeTriplet(slot.ability_soul_ids),
    slotMeta: {
      edited: Boolean(slot.edited),
      deckType: slot.deck_type ?? null,
    },
  };
}

export function importTeamFromSaveSlot(saveJson: unknown, groupIdInput: string | number, slotIdInput: string | number): TeamImportPayload {
  if (!isObject(saveJson)) {
    throw new Error('saveJson must be an object.');
  }

  const groupId = String(groupIdInput);
  const slotId = String(slotIdInput);

  const rootData = isObject(saveJson.data) ? (saveJson.data as Record<string, unknown>) : saveJson;
  const groupsValue = rootData.user_party_group_list;
  const groups = isObject(groupsValue) ? groupsValue : null;
  if (!groups) {
    throw new Error('Save JSON does not contain data.user_party_group_list.');
  }

  const groupValue = groups[groupId];
  if (!isObject(groupValue)) {
    throw new Error(`Group ${groupId} was not found in user_party_group_list.`);
  }

  const listValue = isObject(groupValue.list) || Array.isArray(groupValue.list) ? groupValue.list : groupValue;
  const slotEntries = getObjectOrArrayEntries(listValue);

  let slot: Record<string, unknown> | null = null;
  for (const [key, value] of slotEntries) {
    if (String(key) !== slotId) continue;
    if (!isObject(value)) continue;
    slot = value;
    break;
  }

  if (!slot) {
    throw new Error(`Slot ${slotId} was not found in group ${groupId}.`);
  }

  const build = normalizeBuildFromSlot(slot);
  const slotName = String(slot.name || '').trim();

  const warnings: string[] = [];
  if (build.mainUnitIds.every((id) => id <= 0)) {
    warnings.push('Imported slot has no main units assigned.');
  }

  return {
    title: slotName || `Group ${groupId} Slot ${slotId}`,
    sourceType: 'save_slot',
    build,
    rawSnapshot: {
      source: 'save_slot',
      groupId,
      slotId,
      slot,
    },
    warnings,
  };
}

function resolveTokenToId(token: string, lookup: Record<string, number>, missing: string[]): number {
  if (!token || token === 'blank') return 0;
  const hit = lookup[token];
  if (typeof hit === 'number' && Number.isFinite(hit)) return hit;
  missing.push(token);
  return 0;
}

export async function importTeamFromEliyaLink(link: string): Promise<TeamImportPayload> {
  const tokens = parseEliyaCompTokens(link);
  if (!tokens) {
    throw new Error('Could not parse Eliya link.');
  }

  const { characterIdByToken, equipmentIdByToken } = await getCompTokenMaps();

  const missingCharacterTokens: string[] = [];
  const missingEquipmentTokens: string[] = [];

  const build: TeamBuild = {
    mainUnitIds: [
      resolveTokenToId(tokens[0], characterIdByToken, missingCharacterTokens),
      resolveTokenToId(tokens[2], characterIdByToken, missingCharacterTokens),
      resolveTokenToId(tokens[4], characterIdByToken, missingCharacterTokens),
    ],
    unisonUnitIds: [
      resolveTokenToId(tokens[1], characterIdByToken, missingCharacterTokens),
      resolveTokenToId(tokens[3], characterIdByToken, missingCharacterTokens),
      resolveTokenToId(tokens[5], characterIdByToken, missingCharacterTokens),
    ],
    equipmentIds: [
      resolveTokenToId(tokens[6], equipmentIdByToken, missingEquipmentTokens),
      resolveTokenToId(tokens[8], equipmentIdByToken, missingEquipmentTokens),
      resolveTokenToId(tokens[10], equipmentIdByToken, missingEquipmentTokens),
    ],
    soulIds: [
      resolveTokenToId(tokens[7], equipmentIdByToken, missingEquipmentTokens),
      resolveTokenToId(tokens[9], equipmentIdByToken, missingEquipmentTokens),
      resolveTokenToId(tokens[11], equipmentIdByToken, missingEquipmentTokens),
    ],
    slotMeta: {
      source: 'eliya_link',
      tokens,
    },
  };

  const warnings: string[] = [];
  if (missingCharacterTokens.length > 0) {
    warnings.push(`Unknown character tokens mapped to blank: ${Array.from(new Set(missingCharacterTokens)).join(', ')}`);
  }
  if (missingEquipmentTokens.length > 0) {
    warnings.push(`Unknown equipment tokens mapped to blank: ${Array.from(new Set(missingEquipmentTokens)).join(', ')}`);
  }

  return {
    title: 'Imported Eliya Team',
    sourceType: 'eliya_link',
    build,
    rawSnapshot: {
      source: 'eliya_link',
      link,
      tokens,
      missingCharacterTokens: Array.from(new Set(missingCharacterTokens)),
      missingEquipmentTokens: Array.from(new Set(missingEquipmentTokens)),
    },
    warnings,
  };
}
