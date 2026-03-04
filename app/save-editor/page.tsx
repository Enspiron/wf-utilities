'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Code2,
  Download,
  FileJson,
  FileUp,
  Loader2,
  Layers,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

type JsonObject = Record<string, unknown>;
type SaveDocument = JsonObject & { data_headers: JsonObject; data: JsonObject };
type TemplateKind = 'fresh' | 'mostly_complete';
type EditorTab = 'general' | 'characters' | 'items' | 'equipment' | 'party' | 'story' | 'raw';
type FieldKind = 'string' | 'number';
type CharacterMeta = { id: string; faceCode: string; group: string; nameEN: string; nameJP: string; rarity: number };
type EquipmentRegion = 'gl' | 'ja';
type ItemMeta = {
  id: string;
  devName: string;
  name: string;
  icon: string;
  thumbnail: string;
  type: 'item' | 'equipment';
  sheetRegions: EquipmentRegion[];
};
type ManaBoardMeta = { board1Nodes: number; board2Nodes: number; hasBoard2: boolean };
type ManaBoardGroupRequirementMeta = {
  rawLevelEntries: string[];
  levelRequirements: number[];
  board2ConditionIds: string[];
};
type CharacterCatalogMeta = {
  devName: string;
  enName: string;
  jpName: string;
  skill: string;
  skillWait: string;
  leaderBuff: string;
  ability1: string;
  ability2: string;
  ability3: string;
  ability4: string;
  ability5: string;
  ability6: string;
};
type ExBoostStatusMeta = {
  id: string;
  key: string;
  atk: number;
  hp: number;
  rarity: ExBoostRarity;
};
type ExBoostAbilityMeta = {
  id: string;
  key: string;
  baseKey: string;
  slot: ExBoostSlotKey;
  rarity: ExBoostRarity;
  value: number;
};
type ExBoostRarity = 3 | 4 | 5;
type ExBoostSlotKey = 'slot_a' | 'slot_b';
type CharacterModalTab = 'progress' | 'abilities' | 'nodes';
type CharacterBorderTone = 'default' | 'blue' | 'red' | 'gold';
type CharacterBorderFilter = 'all' | 'default' | 'blue' | 'red' | 'gold';
type CharacterMb2Filter = 'all' | 'has_mb2' | 'no_mb2';
type ItemOwnedFilter = 'all' | 'owned' | 'unowned';
type CharacterContextMenuState = {
  characterId: string | null;
  x: number;
  y: number;
};
type ItemContextMenuState = {
  itemId: string | null;
  x: number;
  y: number;
};
type EquipmentContextMenuState = {
  equipmentId: string | null;
  x: number;
  y: number;
};
type EquipmentBorderTone = 'default' | 'blue' | 'red' | 'gold';
type EquipmentBorderFilter = 'all' | 'blue' | 'red' | 'gold';
type EquipmentOwnedFilter = 'all' | 'owned' | 'unowned';
type EquipmentProtectionFilter = 'all' | 'protected' | 'unprotected';
type CharacterAbilityTrackState = {
  key: string;
  label: string;
  slots: number[];
  availableNodeIds: number[];
  currentLevel: number;
  description: string;
};
type PartyEntry = {
  groupId: string;
  slotId: string;
  value: JsonObject;
};
type PartyPickerKind = 'character' | 'equipment';
type PartyPickerField = 'character_ids' | 'unison_character_ids' | 'equipment_ids' | 'ability_soul_ids';
type PartyPickerState = {
  groupId: string;
  slotId: string;
  slotIndex: number;
  field: PartyPickerField;
  kind: PartyPickerKind;
  title: string;
};
type StoryEntry = {
  chapterId: string;
  index: number;
  questId: string;
  finished: boolean;
  clearRank: number;
  highScore: string;
};
type StoryQuestSourceKey =
  | 'main_quest'
  | 'boss_battle_quest'
  | 'character_quest'
  | 'ex_quest'
  | 'daily_week_event_quest'
  | 'advent_event_quest'
  | 'story_event_single_quest'
  | 'ranking_event_single_quest'
  | 'challenge_dungeon_event_quest'
  | 'daily_exp_mana_event_quest_odds'
  | 'practice_quest'
  | 'world_story_event_quest'
  | 'world_story_event_boss_battle_quest'
  | 'tower_dungeon_event_quest'
  | 'expert_single_event_quest'
  | 'carnival_event_quest'
  | 'raid_event_quest'
  | 'rush_event_quest'
  | 'solo_time_attack_event_quest'
  | 'hard_multi_event_quest'
  | 'score_attack_event_quest';
type StorySourceFilter = 'all' | StoryQuestSourceKey;
type StoryQuestMeta = {
  questId: string;
  title: string;
  thumbnail: string;
  sourceKey: StoryQuestSourceKey;
  sourceLabel: string;
  sourcePath: string;
  orderedMapPath: string;
  categoryName: string;
  categoryLabel: string;
  chapterKey: string;
  chapterLabel: string;
};
type StoryQuestSourceConfig = {
  key: StoryQuestSourceKey;
  path: string;
  label: string;
  orderedMapPath: string;
  chapterKind?: 'main' | 'ex';
};
type StoryDisplayEntry = StoryEntry & {
  meta: StoryQuestMeta | null;
  categoryName: string;
  categoryLabel: string;
};

type Notice =
  | { type: 'success'; message: string }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string }
  | null;

type GeneralField = {
  key: string;
  label: string;
  kind: FieldKind;
};

type TabDefinition = {
  key: EditorTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type RawSectionJump = {
  key: string;
  label: string;
  patterns: string[];
};

type RawJsonNodeKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
type RawJsonNode = {
  start: number;
  end: number;
  path: string[];
  kind: RawJsonNodeKind;
  raw: string;
};
type RawInspectorEntityKind = 'character' | 'equipment' | 'item' | 'quest' | 'unknown';
type RawInspectorHit = {
  id: string;
  kind: RawInspectorEntityKind;
  label: string;
  subtitle: string;
};
type RawHighlightMatch = {
  start: number;
  end: number;
  id: string;
  hit: RawInspectorHit;
};

type PersistedSaveEditorState = {
  version: 1;
  saveDocument: SaveDocument | null;
  sourceLabel: string;
  outputFileName: string;
  rawDirty: boolean;
  rawDraft: string | null;
};

const TEMPLATE_CONFIG: Record<TemplateKind, { path: string; label: string; fileName: string }> = {
  fresh: {
    path: '/data/fresh_save.json',
    label: 'Fresh Save Template',
    fileName: 'fresh_save.json',
  },
  mostly_complete: {
    path: '/data/mostly_complete_save.json',
    label: 'Mostly Complete Save Template',
    fileName: 'mostly_complete_save.json',
  },
};

const EDITOR_TABS: TabDefinition[] = [
  { key: 'general', label: 'General', icon: UserRound },
  { key: 'characters', label: 'Characters', icon: Users },
  { key: 'items', label: 'Items', icon: Package },
  { key: 'equipment', label: 'Equipment', icon: Wrench },
  { key: 'party', label: 'Party', icon: Layers },
  { key: 'story', label: 'Story', icon: BookOpen },
  { key: 'raw', label: 'Raw JSON', icon: Code2 },
];

const GENERAL_FIELDS: GeneralField[] = [
  { key: 'name', label: 'Player Name', kind: 'string' },
  { key: 'comment', label: 'Comment', kind: 'string' },
  { key: 'rank_point', label: 'Rank EXP', kind: 'number' },
  { key: 'leader_character_id', label: 'Leader Character ID', kind: 'number' },
  { key: 'party_slot', label: 'Active Party Slot', kind: 'number' },
  { key: 'free_vmoney', label: 'Free Beads', kind: 'number' },
  { key: 'free_mana', label: 'Mana', kind: 'number' },
  { key: 'star_crumb', label: 'Star Crumb', kind: 'number' },
  { key: 'bond_token', label: 'Bond Token', kind: 'number' },
  { key: 'stamina', label: 'Stamina', kind: 'number' },
  { key: 'boost_point', label: 'Boost Point', kind: 'number' },
  { key: 'boss_boost_point', label: 'Boss Boost Point', kind: 'number' },
];
const SAVE_EDITOR_LOCALSTORAGE_KEY = 'wf-save-editor-state-v1';

const RAW_SECTION_JUMPS: RawSectionJump[] = [
  { key: 'data_headers', label: 'Data Headers', patterns: ['"data_headers"'] },
  { key: 'data', label: 'Data Root', patterns: ['"data"'] },
  { key: 'user_info', label: 'User Info', patterns: ['"user_info"'] },
  { key: 'user_character_list', label: 'Characters', patterns: ['"user_character_list"'] },
  {
    key: 'user_character_mana_node_list',
    label: 'Character Mana Nodes',
    patterns: ['"user_character_mana_node_list"'],
  },
  { key: 'item_list', label: 'Items', patterns: ['"item_list"'] },
  { key: 'user_equipment_list', label: 'Equipment', patterns: ['"user_equipment_list"'] },
  { key: 'user_party_group_list', label: 'Party', patterns: ['"user_party_group_list"'] },
  { key: 'quest_progress', label: 'Quest Progress', patterns: ['"quest_progress"'] },
];

const CHARACTER_PAGE_SIZE = 500;
const ITEM_PAGE_SIZE = 240;
const EQUIPMENT_PAGE_SIZE = 240;
const PARTY_PAGE_SIZE = 24;
const PARTY_PICKER_SEARCH_DEBOUNCE_MS = 90;
const PARTY_PICKER_INITIAL_RENDER_COUNT = 180;
const PARTY_PICKER_RENDER_BATCH_SIZE = 180;
const STORY_PAGE_SIZE = 60;
const ELIYA_COMP_BASE_URL = 'https://eliya-bot.herokuapp.com/comp';
const ELIYA_COMP_SLOT_COUNT = 12;
const ELIYA_COMP_BLANK_TOKEN = 'blank';
const RAW_JSON_INSPECT_MAX_SIZE = 1_500_000;
const RAW_JSON_HIGHLIGHT_MAX_MATCHES = 48;
const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const DATA_FALLBACK_BASE = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';
const ABILITY_TRACKS: Array<{ key: string; label: string; slots: number[] }> = [
  { key: 'abi1', label: 'Ability 1', slots: [0, 1, 2, 3, 4, 5] },
  { key: 'abi2', label: 'Ability 2', slots: [6, 7, 8, 9, 10, 11] },
  { key: 'abi3', label: 'Ability 3', slots: [12, 13, 14, 15, 16, 17] },
  { key: 'skill_evo', label: 'Skill Evolution', slots: [18] },
  { key: 'skill_level', label: 'Skill Levels', slots: [19, 20, 21, 22] },
  { key: 'abi4', label: 'Ability 4', slots: [23, 24, 25, 26, 27, 28] },
  { key: 'abi5', label: 'Ability 5', slots: [29, 30, 31, 32, 33, 34] },
  { key: 'abi6', label: 'Ability 6', slots: [35, 36, 37, 38, 39, 40] },
];
const CORE_ABILITY_KEYS = ['abi1', 'abi2', 'abi3'] as const;
const ADVANCED_ABILITY_KEYS = ['abi4', 'abi5', 'abi6'] as const;
const EQUIPMENT_LEVEL_POINT_MAX = 4;
const EQUIPMENT_SAVE_LEVEL_MIN = 1;
const EQUIPMENT_SAVE_LEVEL_MAX = 5;
const EQUIPMENT_LEVEL_POINTS = [0, 1, 2, 3, 4] as const;
type EquipmentLevelPoint = (typeof EQUIPMENT_LEVEL_POINTS)[number];
const CHARACTER_LEVEL_STOPS = [80, 85, 90, 95, 100] as const;
type CharacterLevelStop = (typeof CHARACTER_LEVEL_STOPS)[number];
const STORY_QUEST_SOURCES: StoryQuestSourceConfig[] = [
  {
    key: 'main_quest',
    path: '/data/datalist_en/quest/main_quest.json',
    label: 'Main Quest',
    orderedMapPath: 'quest/main_quest.orderedmap',
    chapterKind: 'main',
  },
  {
    key: 'boss_battle_quest',
    path: '/data/datalist_en/quest/boss_battle_quest.json',
    label: 'Boss Battle',
    orderedMapPath: 'quest/boss_battle_quest.orderedmap',
  },
  {
    key: 'character_quest',
    path: '/data/datalist_en/quest/character_quest.json',
    label: 'Character Story',
    orderedMapPath: 'quest/character_quest.orderedmap',
  },
  {
    key: 'ex_quest',
    path: '/data/datalist_en/quest/ex_quest.json',
    label: 'EX Quest',
    orderedMapPath: 'quest/ex_quest.orderedmap',
    chapterKind: 'ex',
  },
  {
    key: 'daily_week_event_quest',
    path: '/data/datalist_en/quest/event/daily_week_event_quest.json',
    label: 'Daily Week Event',
    orderedMapPath: 'quest/event/daily_week_event_quest.orderedmap',
  },
  {
    key: 'advent_event_quest',
    path: '/data/datalist_en/quest/event/advent_event_quest.json',
    label: 'Advent Event',
    orderedMapPath: 'quest/event/advent_event_quest.orderedmap',
  },
  {
    key: 'story_event_single_quest',
    path: '/data/datalist_en/quest/event/story_event_single_quest.json',
    label: 'Story Event',
    orderedMapPath: 'quest/event/story_event_single_quest.orderedmap',
  },
  {
    key: 'ranking_event_single_quest',
    path: '/data/datalist_en/quest/event/ranking_event_single_quest.json',
    label: 'Ranking Event',
    orderedMapPath: 'quest/event/ranking_event_single_quest.orderedmap',
  },
  {
    key: 'challenge_dungeon_event_quest',
    path: '/data/datalist_en/quest/event/challenge_dungeon_event_quest.json',
    label: 'Challenge Dungeon',
    orderedMapPath: 'quest/event/challenge_dungeon_event_quest.orderedmap',
  },
  {
    key: 'daily_exp_mana_event_quest_odds',
    path: '/data/datalist_en/quest/event/daily_exp_mana_event_quest_odds.json',
    label: 'Daily EXP / Mana',
    orderedMapPath: 'quest/event/daily_exp_mana_event_quest_odds.orderedmap',
  },
  {
    key: 'practice_quest',
    path: '/data/datalist_en/quest/practice/practice_quest.json',
    label: 'Practice Quest',
    orderedMapPath: 'quest/practice/practice_quest.orderedmap',
  },
  {
    key: 'world_story_event_quest',
    path: '/data/datalist_en/quest/event/world_story_event_quest.json',
    label: 'World Story Event',
    orderedMapPath: 'quest/event/world_story_event_quest.orderedmap',
  },
  {
    key: 'world_story_event_boss_battle_quest',
    path: '/data/datalist_en/quest/event/world_story_event_boss_battle_quest.json',
    label: 'World Story Boss',
    orderedMapPath: 'quest/event/world_story_event_boss_battle_quest.orderedmap',
  },
  {
    key: 'tower_dungeon_event_quest',
    path: '/data/datalist_en/quest/event/tower_dungeon_event_quest.json',
    label: 'Tower Dungeon',
    orderedMapPath: 'quest/event/tower_dungeon_event_quest.orderedmap',
  },
  {
    key: 'expert_single_event_quest',
    path: '/data/datalist_en/quest/event/expert_single_event_quest.json',
    label: 'Expert Single',
    orderedMapPath: 'quest/event/expert_single_event_quest.orderedmap',
  },
  {
    key: 'carnival_event_quest',
    path: '/data/datalist_en/quest/event/carnival_event_quest.json',
    label: 'Carnival Event',
    orderedMapPath: 'quest/event/carnival_event_quest.orderedmap',
  },
  {
    key: 'raid_event_quest',
    path: '/data/datalist_en/quest/event/raid_event_quest.json',
    label: 'Raid Event',
    orderedMapPath: 'quest/event/raid_event_quest.orderedmap',
  },
  {
    key: 'rush_event_quest',
    path: '/data/datalist_en/quest/event/rush_event_quest.json',
    label: 'Rush Event',
    orderedMapPath: 'quest/event/rush_event_quest.orderedmap',
  },
  {
    key: 'solo_time_attack_event_quest',
    path: '/data/datalist_en/quest/event/solo_time_attack_event_quest.json',
    label: 'Solo Time Attack',
    orderedMapPath: 'quest/event/solo_time_attack_event_quest.orderedmap',
  },
  {
    key: 'hard_multi_event_quest',
    path: '/data/datalist_en/quest/event/hard_multi_event_quest.json',
    label: 'Hard Multi Event',
    orderedMapPath: 'quest/event/hard_multi_event_quest.orderedmap',
  },
  {
    key: 'score_attack_event_quest',
    path: '/data/datalist_en/quest/event/score_attack_event_quest.json',
    label: 'Score Attack',
    orderedMapPath: 'quest/event/score_attack_event_quest.orderedmap',
  },
];
const QUEST_CATEGORY_TO_SOURCE_KEY: Record<string, StoryQuestSourceKey> = {
  MainQuest: 'main_quest',
  BossBattleQuest: 'boss_battle_quest',
  CharacterQuest: 'character_quest',
  ExQuest: 'ex_quest',
  DailyWeekEventQuest: 'daily_week_event_quest',
  AdventEventSingleQuest: 'advent_event_quest',
  StoryEventSingleQuest: 'story_event_single_quest',
  RankingEventSingleQuest: 'ranking_event_single_quest',
  ChallengeDungeonEventQuest: 'challenge_dungeon_event_quest',
  DailyExpManaEventQuest: 'daily_exp_mana_event_quest_odds',
  PracticeQuest: 'practice_quest',
  WorldStoryEventQuest: 'world_story_event_quest',
  WorldStoryEventBossBattleQuest: 'world_story_event_boss_battle_quest',
  TowerDungeonEventQuest: 'tower_dungeon_event_quest',
  ExpertSingleEventQuest: 'expert_single_event_quest',
  CarnivalEventQuest: 'carnival_event_quest',
  RaidEventQuest: 'raid_event_quest',
  RushEventQuest: 'rush_event_quest',
  SoloTimeAttackEventQuest: 'solo_time_attack_event_quest',
  HardMultiEventQuest: 'hard_multi_event_quest',
  ScoreAttackEventQuest: 'score_attack_event_quest',
};
const LEVEL_STOP_TO_OVER_LIMIT: Record<CharacterLevelStop, number> = {
  80: 0,
  85: 1,
  90: 2,
  95: 3,
  100: 4,
};
const CHARACTER_EXP_BY_RARITY_TIER: Record<3 | 4 | 5, Record<CharacterLevelStop, number>> = {
  3: {
    80: 125223,
    85: 170928,
    90: 216633,
    95: 262338,
    100: 308043,
  },
  4: {
    80: 139190,
    85: 189995,
    90: 240800,
    95: 291605,
    100: 342410,
  },
  5: {
    80: 153988,
    85: 210488,
    90: 266988,
    95: 323488,
    100: 379988,
  },
};

function getCharacterRarityTier(rarity: number): 3 | 4 | 5 {
  if (rarity >= 5) return 5;
  if (rarity === 4) return 4;
  return 3;
}

function getCharacterExpForLevelStop(rarity: number, levelStop: CharacterLevelStop): number {
  const tier = getCharacterRarityTier(rarity);
  return CHARACTER_EXP_BY_RARITY_TIER[tier][levelStop];
}

function getLevelStopFromExp(exp: number, rarity: number): CharacterLevelStop {
  const tier = getCharacterRarityTier(rarity);
  let levelStop: CharacterLevelStop = 80;
  for (const candidate of CHARACTER_LEVEL_STOPS) {
    if (exp >= CHARACTER_EXP_BY_RARITY_TIER[tier][candidate]) {
      levelStop = candidate;
    }
  }
  return levelStop;
}

function getLevelStopFromOverLimitStep(step: number): CharacterLevelStop {
  if (step >= 4) return 100;
  if (step === 3) return 95;
  if (step === 2) return 90;
  if (step === 1) return 85;
  return 80;
}

function getLevelStopFromSliderIndex(index: number): CharacterLevelStop {
  const clamped = Math.max(0, Math.min(index, CHARACTER_LEVEL_STOPS.length - 1));
  return CHARACTER_LEVEL_STOPS[clamped];
}

function getSliderIndexFromLevelStop(levelStop: CharacterLevelStop): number {
  return CHARACTER_LEVEL_STOPS.indexOf(levelStop);
}

function clampEquipmentSaveLevel(level: number): number {
  return Math.max(EQUIPMENT_SAVE_LEVEL_MIN, Math.min(level, EQUIPMENT_SAVE_LEVEL_MAX));
}

function getEquipmentLevelPointFromSaveLevel(level: number): EquipmentLevelPoint {
  const clamped = clampEquipmentSaveLevel(level);
  return Math.max(0, Math.min(clamped - 1, EQUIPMENT_LEVEL_POINT_MAX)) as EquipmentLevelPoint;
}

function getEquipmentSaveLevelFromLevelPoint(levelPoint: number): number {
  const clamped = Math.max(0, Math.min(levelPoint, EQUIPMENT_LEVEL_POINT_MAX));
  return clamped + 1;
}

function hasImageExtension(value: string): boolean {
  return /\.(png|jpe?g|webp|svg|gif)$/i.test(value);
}

function toCdnUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  const clean = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
  return `${CDN_ROOT}/${hasImageExtension(clean) ? clean : `${clean}.png`}`;
}

function getDataFallbackUrls(pathOrUrl: string): string[] {
  const normalized = pathOrUrl.trim();
  if (!normalized) return [];
  const urls = [normalized];
  if (normalized.startsWith('/data/')) {
    urls.push(`${DATA_FALLBACK_BASE}/${normalized.slice('/data/'.length)}`);
  } else if (normalized.startsWith('data/')) {
    urls.push(`${DATA_FALLBACK_BASE}/${normalized.slice('data/'.length)}`);
  }

  const unique = Array.from(new Set(urls));
  const canCheckWindow = typeof window !== 'undefined';
  const host = canCheckWindow ? window.location.hostname.toLowerCase() : '';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';

  // On deployed hosts where /public/data is excluded, prefer remote fallback first.
  if (canCheckWindow && !isLocalHost && unique.length > 1) {
    return [unique[1], unique[0], ...unique.slice(2)];
  }

  return unique;
}

async function fetchFirstAvailable(urls: string[], init?: RequestInit): Promise<Response | null> {
  for (const url of urls) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
    } catch {
      // Try next fallback URL.
    }
  }
  return null;
}

function buildCharacterThumbUrls(faceCode: string): string[] {
  if (!faceCode) return [];
  const encoded = encodeURIComponent(faceCode);
  return [
    `${CDN_ROOT}/wfjukebox/character/character_art/${faceCode}/ui/square_0.png`,
    `${CDN_ROOT}/wfjukebox/character/character_art/${encoded}/ui/square_0.png`,
    `${CDN_ROOT}/wfjukebox/character/character_art/${faceCode}/ui/square_132_132_0.png`,
  ];
}

function buildStoryThumbUrls(questId: string, thumbPath = ''): string[] {
  const urls: string[] = [];
  const normalizedThumb = thumbPath.trim();
  if (normalizedThumb) {
    urls.push(toCdnUrl(normalizedThumb));
    urls.push(toCdnUrl(`wfjukebox/${normalizedThumb}`));
  }
  if (questId) {
    urls.push(`${CDN_ROOT}/quest/thumbnail/${questId}.png`);
    urls.push(`${CDN_ROOT}/quest/${questId}.png`);
    urls.push(`${CDN_ROOT}/wfjukebox/quest/thumbnail/${questId}.png`);
    urls.push(`${CDN_ROOT}/wfjukebox/quest/${questId}.png`);
  }
  return Array.from(new Set(urls.filter(Boolean)));
}

function formatQuestCategoryLabel(name: string): string {
  const compact = name.trim();
  if (!compact) return '';
  const noSuffix = compact.endsWith('Quest') ? compact.slice(0, -5) : compact;
  return noSuffix.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
}

function getCategoryNameForSourceKey(sourceKey: StoryQuestSourceKey): string {
  for (const [categoryName, mappedSourceKey] of Object.entries(QUEST_CATEGORY_TO_SOURCE_KEY)) {
    if (mappedSourceKey === sourceKey) {
      return categoryName;
    }
  }
  return '';
}

function getStorySourceLabel(sourceKey: StoryQuestSourceKey): string {
  const source = STORY_QUEST_SOURCES.find((entry) => entry.key === sourceKey);
  return source?.label ?? sourceKey;
}

function looksLikeQuestId(value: unknown): boolean {
  const text = getStringValue(value).trim();
  return /^\d{1,}$/.test(text);
}

function getStoryMetaScore(meta: { title: string; thumbnail: string }): number {
  let score = 0;
  if (meta.title) score += 2;
  if (meta.thumbnail) {
    score += meta.thumbnail.includes('/common/story') ? 1 : 2;
  }
  return score;
}

function shouldSkipQuestText(value: string): boolean {
  if (!value || value === '(None)') return true;
  if (value.startsWith('quest/thumbnail/')) return true;
  if (/^\d+$/.test(value)) return true;
  if (/^(true|false)$/i.test(value)) return true;
  if (/^\d{4}-\d{2}-\d{2}\s/.test(value)) return true;
  return false;
}

function extractStoryMetaFromRow(row: unknown[]): { questId: string; title: string; thumbnail: string } | null {
  if (!Array.isArray(row) || row.length === 0 || !looksLikeQuestId(row[0])) return null;
  const questId = getStringValue(row[0]).trim();
  if (!questId) return null;

  let title = '';
  let thumbnail = '';
  for (let index = 1; index < row.length; index += 1) {
    const current = compactText(row[index]);
    if (!current) continue;
    if (!thumbnail && current.startsWith('quest/thumbnail/')) {
      thumbnail = current;
      continue;
    }
    if (!title && !shouldSkipQuestText(current)) {
      title = current;
    }
  }

  return { questId, title, thumbnail };
}

function collectStoryRows(
  value: unknown,
  callback: (row: unknown[], path: string[]) => void,
  path: string[] = []
): void {
  if (Array.isArray(value)) {
    if (value.length > 0) {
      callback(value, path);
    }
    value.forEach((item, index) => {
      collectStoryRows(item, callback, [...path, String(index)]);
    });
    return;
  }

  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    collectStoryRows(child, callback, [...path, key]);
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeFileName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'save.json';
  return trimmed.toLowerCase().endsWith('.json') ? trimmed : `${trimmed}.json`;
}

function parseJson(input: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    const normalized = input.replace(/^\uFEFF/, '');
    return { ok: true, value: JSON.parse(normalized) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON.';
    return { ok: false, error: message };
  }
}

function looksLikeSaveData(value: JsonObject): boolean {
  const markers = ['user_info', 'item_list', 'user_character_list', 'user_equipment_list'];
  return markers.some((marker) => Object.prototype.hasOwnProperty.call(value, marker));
}

function normalizeSaveInput(
  input: unknown
): { ok: true; value: SaveDocument; wrappedDataObject: boolean } | { ok: false; error: string } {
  if (!isObject(input)) {
    return { ok: false, error: 'Top-level JSON must be an object.' };
  }

  if (isObject(input.data)) {
    const cloned = cloneJson(input) as JsonObject;
    if (!isObject(cloned.data_headers)) {
      cloned.data_headers = {};
    }
    return { ok: true, value: cloned as SaveDocument, wrappedDataObject: false };
  }

  if (looksLikeSaveData(input)) {
    return {
      ok: true,
      value: {
        data_headers: {},
        data: cloneJson(input),
      },
      wrappedDataObject: true,
    };
  }

  return {
    ok: false,
    error: 'JSON must include either a top-level `data` object or look like save `data` content.',
  };
}

function getOrCreateObject(parent: JsonObject, key: string): JsonObject {
  const existing = parent[key];
  if (isObject(existing)) {
    return existing;
  }
  const created: JsonObject = {};
  parent[key] = created;
  return created;
}

function toNumeric(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function getStringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function compactText(value: unknown): string {
  return getStringValue(value).replace(/\s+/g, ' ').trim();
}

function getAbilityTrackDescription(trackKey: string, meta: CharacterCatalogMeta | null): string {
  if (!meta) return '';
  switch (trackKey) {
    case 'abi1':
      return meta.ability1;
    case 'abi2':
      return meta.ability2;
    case 'abi3':
      return meta.ability3;
    case 'abi4':
      return meta.ability4;
    case 'abi5':
      return meta.ability5;
    case 'abi6':
      return meta.ability6;
    case 'skill_evo':
      return meta.skill ? `Skill unlock: ${meta.skill}` : '';
    case 'skill_level':
      if (meta.skillWait && meta.skill) return `Skill wait ${meta.skillWait}: ${meta.skill}`;
      if (meta.skillWait) return `Skill wait: ${meta.skillWait}`;
      return meta.skill ? `Skill: ${meta.skill}` : '';
    default:
      return '';
  }
}

function getCharacterToneLabel(tone: CharacterBorderTone): string {
  if (tone === 'blue') return 'MB1 Maxed';
  if (tone === 'red') return 'MB2 In Progress';
  if (tone === 'gold') return 'Fully Maxed';
  return 'Unbuilt';
}

const EX_BOOST_RARITIES: ExBoostRarity[] = [5, 4, 3];
const EX_BOOST_ABILITY_LABELS: Record<string, string> = {
  atk_self: 'Self ATK +',
  skilldamage_self: 'Self Skill Damage +',
  directdamage_self: 'Self Direct Attack Damage +',
  abilitydagame_self: 'Self Ability Damage +',
  atk_party: 'Party ATK +',
  skilldamage_party: 'Party Skill Damage +',
  directdamage_party: 'Party Direct Attack Damage +',
  abilitydagame_party: 'Party Ability Damage +',
  powerflipdamage: 'Power Flip Damage +',
  hp_self: 'Self HP +',
  atk_buffextend_self: 'Self ATK Buff Duration +',
  skilldamage_buffextend_self: 'Self Skill Damage Buff Duration +',
  directdamage_buffextend_self: 'Self Direct Attack Buff Duration +',
  abilitydagame_buffextend_self: 'Self Ability Buff Duration +',
  powerflipdamage_buffextend: 'Power Flip Buff Duration +',
  piercing_buffextend: 'Penetration Buff Duration +',
  flying_buffextend: 'Float Buff Duration +',
  feverpoint_self: 'Self Fever Gain +',
  fevertime_extend: 'Fever Duration +',
  initial_skillgauge_self: 'Battle Start Skill Gauge +',
  skillgagemax_self: 'Max Skill Gauge +',
};

function formatGameTokenLabel(value: string, stripRaritySuffix = false): string {
  const normalizedValue = stripRaritySuffix ? value.replace(/_r[345]$/i, '') : value;
  const normalized = normalizedValue.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized
    .split(' ')
    .map((segment) => {
      if (/^r\d+$/i.test(segment)) return segment.toUpperCase();
      if (/^(atk|hp|mb|ap)$/i.test(segment)) return segment.toUpperCase();
      return `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`;
    })
    .join(' ');
}

function getExBoostStatusLabel(statusKey: string): string {
  return formatGameTokenLabel(statusKey, true)
    .replace('Higher Atk', 'Higher ATK')
    .replace('Higher Hp', 'Higher HP');
}

function getExBoostAbilityLabel(abilityBaseKey: string): string {
  return EX_BOOST_ABILITY_LABELS[abilityBaseKey] || formatGameTokenLabel(abilityBaseKey, true);
}

function getExBoostRarityBadgeTone(rarity: ExBoostRarity): string {
  if (rarity === 5) return 'border-amber-500/40 bg-amber-500/20 text-amber-200';
  if (rarity === 4) return 'border-slate-500/40 bg-slate-500/20 text-slate-200';
  return 'border-orange-700/40 bg-orange-700/20 text-orange-200';
}

function toExBoostRarity(value: unknown, fallback: ExBoostRarity = 5): ExBoostRarity {
  const numeric = getNumberValue(value, fallback);
  if (numeric === 3 || numeric === 4 || numeric === 5) return numeric;
  return fallback;
}

function getRandomArrayItem<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  return values[Math.floor(Math.random() * values.length)] ?? null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getArrayNumberAt(value: unknown, index: number): number {
  if (!Array.isArray(value)) return 0;
  return getNumberValue(value[index], 0);
}

function normalizeTripleArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [0, 0, 0];
  return [0, 1, 2].map((idx) => getNumberValue(value[idx], 0));
}

function normalizeCharacterArray(raw: unknown): unknown[] {
  if (Array.isArray(raw) && Array.isArray(raw[0])) return raw[0] as unknown[];
  if (Array.isArray(raw)) return raw;
  return [];
}

function parseNumberList(value: string): number[] {
  return value
    .split(/[\s,]+/)
    .map((part) => Number(part.trim()))
    .filter((num) => Number.isFinite(num) && num > 0)
    .map((num) => Math.floor(num));
}

function buildRawJsonNodeIndex(input: string): RawJsonNode[] | null {
  const text = input;
  const length = text.length;
  const nodes: RawJsonNode[] = [];
  let index = 0;

  const isWhitespace = (char: string) => /\s/.test(char);
  const skipWhitespace = () => {
    while (index < length && isWhitespace(text[index])) index += 1;
  };

  const parseStringToken = (): { raw: string; value: string; start: number; end: number } | null => {
    if (text[index] !== '"') return null;
    const start = index;
    index += 1;
    let escaped = false;
    while (index < length) {
      const char = text[index];
      if (escaped) {
        escaped = false;
        index += 1;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        index += 1;
        continue;
      }
      if (char === '"') {
        index += 1;
        const raw = text.slice(start, index);
        try {
          return { raw, value: JSON.parse(raw) as string, start, end: index };
        } catch {
          return { raw, value: raw.slice(1, -1), start, end: index };
        }
      }
      index += 1;
    }
    return null;
  };

  const parseNumberToken = (): { raw: string; start: number; end: number } | null => {
    const source = text.slice(index);
    const match = source.match(/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/);
    if (!match) return null;
    const start = index;
    const raw = match[0];
    index += raw.length;
    return { raw, start, end: index };
  };

  const parseLiteralToken = (literal: 'true' | 'false' | 'null'): { raw: string; start: number; end: number } | null => {
    if (!text.startsWith(literal, index)) return null;
    const start = index;
    index += literal.length;
    return { raw: literal, start, end: index };
  };

  const parseValue = (path: string[]): boolean => {
    skipWhitespace();
    if (index >= length) return false;
    const valueStart = index;
    const char = text[index];

    if (char === '{') {
      index += 1;
      skipWhitespace();
      if (text[index] === '}') {
        index += 1;
        nodes.push({ start: valueStart, end: index, path, kind: 'object', raw: text.slice(valueStart, index) });
        return true;
      }

      while (index < length) {
        skipWhitespace();
        const keyToken = parseStringToken();
        if (!keyToken) return false;
        const key = keyToken.value;

        skipWhitespace();
        if (text[index] !== ':') return false;
        index += 1;
        if (!parseValue([...path, key])) return false;

        skipWhitespace();
        if (text[index] === ',') {
          index += 1;
          continue;
        }
        if (text[index] === '}') {
          index += 1;
          nodes.push({ start: valueStart, end: index, path, kind: 'object', raw: text.slice(valueStart, index) });
          return true;
        }
        return false;
      }
      return false;
    }

    if (char === '[') {
      index += 1;
      skipWhitespace();
      if (text[index] === ']') {
        index += 1;
        nodes.push({ start: valueStart, end: index, path, kind: 'array', raw: text.slice(valueStart, index) });
        return true;
      }

      let arrayIndex = 0;
      while (index < length) {
        if (!parseValue([...path, String(arrayIndex)])) return false;
        arrayIndex += 1;
        skipWhitespace();
        if (text[index] === ',') {
          index += 1;
          continue;
        }
        if (text[index] === ']') {
          index += 1;
          nodes.push({ start: valueStart, end: index, path, kind: 'array', raw: text.slice(valueStart, index) });
          return true;
        }
        return false;
      }
      return false;
    }

    if (char === '"') {
      const stringToken = parseStringToken();
      if (!stringToken) return false;
      nodes.push({
        start: stringToken.start,
        end: stringToken.end,
        path,
        kind: 'string',
        raw: stringToken.raw,
      });
      return true;
    }

    const numberToken = parseNumberToken();
    if (numberToken) {
      nodes.push({ start: numberToken.start, end: numberToken.end, path, kind: 'number', raw: numberToken.raw });
      return true;
    }

    const trueToken = parseLiteralToken('true');
    if (trueToken) {
      nodes.push({ start: trueToken.start, end: trueToken.end, path, kind: 'boolean', raw: trueToken.raw });
      return true;
    }
    const falseToken = parseLiteralToken('false');
    if (falseToken) {
      nodes.push({ start: falseToken.start, end: falseToken.end, path, kind: 'boolean', raw: falseToken.raw });
      return true;
    }
    const nullToken = parseLiteralToken('null');
    if (nullToken) {
      nodes.push({ start: nullToken.start, end: nullToken.end, path, kind: 'null', raw: nullToken.raw });
      return true;
    }

    return false;
  };

  if (!parseValue([])) return null;
  skipWhitespace();
  if (index !== length) return null;

  nodes.sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    return right.end - left.end;
  });
  return nodes;
}

function getRawLineInfo(text: string, cursorIndex: number): {
  lineNumber: number;
  columnNumber: number;
  lineText: string;
  lineStart: number;
  lineEnd: number;
} {
  const safeIndex = Math.max(0, Math.min(cursorIndex, text.length));
  const lineStart = text.lastIndexOf('\n', Math.max(0, safeIndex - 1)) + 1;
  const nextBreak = text.indexOf('\n', safeIndex);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const lineText = text.slice(lineStart, lineEnd);
  const lineNumber = text.slice(0, lineStart).split('\n').length;
  const columnNumber = safeIndex - lineStart + 1;
  return { lineNumber, columnNumber, lineText, lineStart, lineEnd };
}

function extractNumericTokenNearCursor(text: string, start: number, end: number): string {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(0, Math.min(end, text.length));
  if (safeEnd > safeStart) {
    const selected = text.slice(safeStart, safeEnd).trim();
    const selectedMatch = selected.match(/\b\d{1,12}\b/);
    return selectedMatch?.[0] ?? '';
  }

  let left = safeStart;
  let right = safeStart;
  while (left > 0 && /\d/.test(text[left - 1])) left -= 1;
  while (right < text.length && /\d/.test(text[right])) right += 1;
  const around = text.slice(left, right);
  if (/^\d{1,12}$/.test(around)) return around;

  const nearby = text.slice(Math.max(0, safeStart - 32), Math.min(text.length, safeStart + 32));
  const nearbyMatch = nearby.match(/\b\d{1,12}\b/);
  return nearbyMatch?.[0] ?? '';
}

function splitHighlightedText(text: string, matches: RawHighlightMatch[]): Array<{ text: string; match: RawHighlightMatch | null }> {
  if (!text) return [{ text: '', match: null }];
  if (matches.length === 0) return [{ text, match: null }];

  const ordered = [...matches].sort((left, right) => left.start - right.start);
  const segments: Array<{ text: string; match: RawHighlightMatch | null }> = [];
  let cursor = 0;

  ordered.forEach((match) => {
    const start = Math.max(cursor, Math.min(match.start, text.length));
    const end = Math.max(start, Math.min(match.end, text.length));
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), match: null });
    }
    if (end > start) {
      segments.push({ text: text.slice(start, end), match });
      cursor = end;
    }
  });

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: null });
  }

  return segments;
}

function getRawInspectorKindLabel(kind: RawInspectorEntityKind): string {
  if (kind === 'character') return 'Character';
  if (kind === 'equipment') return 'Equipment';
  if (kind === 'item') return 'Item';
  if (kind === 'quest') return 'Quest';
  return 'Unknown';
}

function getRawInspectorKindClasses(kind: RawInspectorEntityKind): string {
  if (kind === 'character') return 'border-sky-500/40 bg-sky-500/20 text-sky-200';
  if (kind === 'equipment') return 'border-amber-500/40 bg-amber-500/20 text-amber-200';
  if (kind === 'item') return 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200';
  if (kind === 'quest') return 'border-violet-500/40 bg-violet-500/20 text-violet-200';
  return 'border-border bg-muted/30 text-muted-foreground';
}

function formatJsonPath(path: string[]): string {
  if (path.length === 0) return '$';
  let output = '$';
  for (const segment of path) {
    if (/^\d+$/.test(segment)) {
      output += `[${segment}]`;
      continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) {
      output += `.${segment}`;
      continue;
    }
    output += `["${segment.replace(/"/g, '\\"')}"]`;
  }
  return output;
}

function normalizeEliyaCompToken(value: string): string {
  return value.trim().toLowerCase();
}

function extractEliyaCompSlug(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  let candidate = trimmed;
  try {
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(/\/comp\/([^/]+)/i);
    if (match?.[1]) {
      candidate = match[1];
    } else {
      const fallback = parsed.pathname.split('/').filter(Boolean).pop();
      candidate = fallback ?? '';
    }
  } catch {
    const inlineMatch = trimmed.match(/\/comp\/([^/?#]+)/i);
    if (inlineMatch?.[1]) {
      candidate = inlineMatch[1];
    }
  }

  return candidate.replace(/\.png$/i, '').split('?')[0].split('#')[0].trim();
}

function parseEliyaCompTokens(input: string): string[] | null {
  const slug = extractEliyaCompSlug(input);
  if (!slug) return null;

  const rawTokens = slug.split('-').map((token) => normalizeEliyaCompToken(token) || ELIYA_COMP_BLANK_TOKEN);
  if (rawTokens.length === 0) return null;

  if (rawTokens.length < ELIYA_COMP_SLOT_COUNT) {
    return [
      ...rawTokens,
      ...Array.from({ length: ELIYA_COMP_SLOT_COUNT - rawTokens.length }, () => ELIYA_COMP_BLANK_TOKEN),
    ];
  }

  return rawTokens.slice(0, ELIYA_COMP_SLOT_COUNT);
}

function buildEliyaCompLink(tokens: string[]): string {
  const normalized = tokens
    .slice(0, ELIYA_COMP_SLOT_COUNT)
    .map((token) => normalizeEliyaCompToken(token) || ELIYA_COMP_BLANK_TOKEN);
  while (normalized.length < ELIYA_COMP_SLOT_COUNT) {
    normalized.push(ELIYA_COMP_BLANK_TOKEN);
  }
  return `${ELIYA_COMP_BASE_URL}/${normalized.join('-')}.png`;
}

function getManaNodeIdForSlot(characterId: string, slotIndex: number): number | null {
  const cid = Number.parseInt(characterId, 10);
  if (!Number.isFinite(cid) || cid <= 0) return null;

  if (slotIndex >= 0 && slotIndex <= 22) {
    return cid * 2000 + (201 + slotIndex);
  }
  if (slotIndex >= 23 && slotIndex <= 40) {
    return cid * 2000 + (401 + (slotIndex - 23));
  }
  return null;
}

function isManaNodeSlotAvailable(slotIndex: number, board1Nodes: number, board2Nodes: number): boolean {
  if (slotIndex >= 0 && slotIndex <= 22) {
    return slotIndex < board1Nodes;
  }
  if (slotIndex >= 23 && slotIndex <= 40) {
    return slotIndex - 23 < board2Nodes;
  }
  return false;
}

function parseManaLevelRequirement(value: unknown): number {
  const text = getStringValue(value).trim();
  if (!text || text === '(None)') return 0;
  const numeric = Number.parseInt(text, 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function buildManaTierCumulativeRequirements(requirement: ManaBoardGroupRequirementMeta | null): number[] {
  const rawEntries = requirement?.rawLevelEntries ?? [];
  const fallbackLevels = requirement?.levelRequirements ?? [];
  const tierBase = Array.from({ length: 7 }, (_, tier) => {
    const fromRaw = parseManaLevelRequirement(rawEntries[tier]);
    if (fromRaw > 0) return fromRaw;
    if (tier === 0) return 0;
    const fallback = fallbackLevels[tier - 1] ?? 0;
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
  });

  const cumulative: number[] = [];
  let current = 0;
  for (const requiredLevel of tierBase) {
    current = Math.max(current, requiredLevel);
    cumulative.push(current);
  }
  return cumulative;
}

function getManaNodeTierFromNodeId(characterId: string, nodeId: number): number | null {
  const cid = Number.parseInt(characterId, 10);
  if (!Number.isFinite(cid) || cid <= 0) return null;

  const delta = nodeId - cid * 2000;
  if (delta >= 201 && delta <= 223) {
    const board1Index = delta - 201;
    if (board1Index <= 4) return 0;
    if (board1Index <= 10) return 1;
    if (board1Index <= 16) return 2;
    return 3;
  }
  if (delta >= 401 && delta <= 418) {
    const board2Index = delta - 401;
    if (board2Index <= 5) return 4;
    if (board2Index <= 11) return 5;
    return 6;
  }
  return null;
}

function AssetThumb({
  urls,
  alt,
  size = 96,
  pixelated = true,
}: {
  urls: string[];
  alt: string;
  size?: number;
  pixelated?: boolean;
}) {
  const sourceUrls = useMemo(() => {
    return Array.from(
      new Set(
        urls
          .map((url) => url.trim())
          .filter((url) => Boolean(url))
      )
    );
  }, [urls]);
  const sourceKey = sourceUrls.join('\n');
  const [fallbackState, setFallbackState] = useState<{ sourceKey: string; index: number }>({
    sourceKey: '',
    index: 0,
  });
  const activeIndex = fallbackState.sourceKey === sourceKey ? fallbackState.index : 0;
  const src = activeIndex >= 0 && activeIndex < sourceUrls.length ? sourceUrls[activeIndex] : '';

  if (!src) {
    return (
      <div
        className='flex shrink-0 items-center justify-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/25 text-[11px] text-muted-foreground'
        style={{ width: size, height: size }}
      >
        No Image
      </div>
    );
  }

  return (
    <div className='relative shrink-0 overflow-hidden rounded-md' style={{ width: size, height: size }}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={`${size}px`}
        className='object-contain'
        style={{ imageRendering: pixelated ? 'pixelated' : 'auto' }}
        onError={() =>
          setFallbackState((current) => {
            const currentIndex = current.sourceKey === sourceKey ? current.index : 0;
            const next = currentIndex + 1;
            return { sourceKey, index: next < sourceUrls.length ? next : -1 };
          })
        }
        unoptimized
      />
    </div>
  );
}

export default function SaveEditorPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const characterContextMenuRef = useRef<HTMLDivElement>(null);
  const itemContextMenuRef = useRef<HTMLDivElement>(null);
  const equipmentContextMenuRef = useRef<HTMLDivElement>(null);
  const partyPickerSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partyShareFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partyImportInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>('general');
  const [saveDocument, setSaveDocument] = useState<SaveDocument | null>(null);
  const [sourceLabel, setSourceLabel] = useState('No save loaded');
  const [outputFileName, setOutputFileName] = useState('edited_save.json');
  const [notice, setNotice] = useState<Notice>(null);
  const [loadingTemplate, setLoadingTemplate] = useState<TemplateKind | null>(null);

  const [rawText, setRawText] = useState('');
  const [rawDirty, setRawDirty] = useState(false);
  const [rawJumpSelection, setRawJumpSelection] = useState('');
  const [rawSelectionRange, setRawSelectionRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  const [characterSearch, setCharacterSearch] = useState('');
  const [characterBorderFilter, setCharacterBorderFilter] = useState<CharacterBorderFilter>('all');
  const [characterMb2Filter, setCharacterMb2Filter] = useState<CharacterMb2Filter>('all');
  const [characterPage, setCharacterPage] = useState(1);
  const [newCharacterId, setNewCharacterId] = useState('');
  const [characterContextMenu, setCharacterContextMenu] = useState<CharacterContextMenuState>({
    characterId: null,
    x: 0,
    y: 0,
  });
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [characterNodeDraft, setCharacterNodeDraft] = useState('');
  const [characterModalTab, setCharacterModalTab] = useState<CharacterModalTab>('progress');

  const [itemSearch, setItemSearch] = useState('');
  const [itemOwnedFilter, setItemOwnedFilter] = useState<ItemOwnedFilter>('all');
  const [itemPage, setItemPage] = useState(1);
  const [newItemId, setNewItemId] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('9999');

  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [equipmentBorderFilter, setEquipmentBorderFilter] = useState<EquipmentBorderFilter>('all');
  const [equipmentOwnedFilter, setEquipmentOwnedFilter] = useState<EquipmentOwnedFilter>('all');
  const [equipmentProtectionFilter, setEquipmentProtectionFilter] = useState<EquipmentProtectionFilter>('all');
  const [equipmentPage, setEquipmentPage] = useState(1);
  const [newEquipmentId, setNewEquipmentId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemContextMenu, setItemContextMenu] = useState<ItemContextMenuState>({ itemId: null, x: 0, y: 0 });
  const [equipmentContextMenu, setEquipmentContextMenu] = useState<EquipmentContextMenuState>({
    equipmentId: null,
    x: 0,
    y: 0,
  });
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [partySearch, setPartySearch] = useState('');
  const [partyPage, setPartyPage] = useState(1);
  const [partyImportSlotKey, setPartyImportSlotKey] = useState<string | null>(null);
  const [partyShareFeedbackKey, setPartyShareFeedbackKey] = useState<string | null>(null);
  const [partyPicker, setPartyPicker] = useState<PartyPickerState | null>(null);
  const [partyPickerSearch, setPartyPickerSearch] = useState('');
  const [partyPickerRenderCount, setPartyPickerRenderCount] = useState(PARTY_PICKER_INITIAL_RENDER_COUNT);
  const [storySearch, setStorySearch] = useState('');
  const [storySourceFilter, setStorySourceFilter] = useState<StorySourceFilter>('all');
  const [storyPage, setStoryPage] = useState(1);

  const [characterMetaById, setCharacterMetaById] = useState<Record<string, CharacterMeta>>({});
  const [characterCatalogIds, setCharacterCatalogIds] = useState<string[]>([]);
  const [characterCatalogMetaById, setCharacterCatalogMetaById] = useState<Record<string, CharacterCatalogMeta>>({});
  const [globalCharacterIds, setGlobalCharacterIds] = useState<string[]>([]);
  const [manaBoardMetaById, setManaBoardMetaById] = useState<Record<string, ManaBoardMeta>>({});
  const [manaBoardRequirementsByGroup, setManaBoardRequirementsByGroup] = useState<
    Record<string, ManaBoardGroupRequirementMeta>
  >({});
  const [itemMetaById, setItemMetaById] = useState<Record<string, ItemMeta>>({});
  const [exBoostStatusMetaById, setExBoostStatusMetaById] = useState<Record<string, ExBoostStatusMeta>>({});
  const [exBoostAbilityMetaById, setExBoostAbilityMetaById] = useState<Record<string, ExBoostAbilityMeta>>({});
  const [equipmentEnhancementOptionsById, setEquipmentEnhancementOptionsById] = useState<Record<string, number[]>>({});
  const [storyQuestMetaBySourceKey, setStoryQuestMetaBySourceKey] = useState<
    Partial<Record<StoryQuestSourceKey, Record<string, StoryQuestMeta>>>
  >({});
  const [storyQuestMetaFallbackByQuestId, setStoryQuestMetaFallbackByQuestId] = useState<Record<string, StoryQuestMeta>>({});
  const [storyQuestCategoryNameById, setStoryQuestCategoryNameById] = useState<Record<string, string>>({});

  useEffect(() => {
    return () => {
      if (partyPickerSearchDebounceRef.current) {
        clearTimeout(partyPickerSearchDebounceRef.current);
        partyPickerSearchDebounceRef.current = null;
      }
      if (partyShareFeedbackTimeoutRef.current) {
        clearTimeout(partyShareFeedbackTimeoutRef.current);
        partyShareFeedbackTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!partyPicker) return;
    setPartyPickerRenderCount(PARTY_PICKER_INITIAL_RENDER_COUNT);
  }, [partyPicker, partyPickerSearch]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(SAVE_EDITOR_LOCALSTORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as Partial<PersistedSaveEditorState>;
      const maybeSave = parsed.saveDocument;
      if (!isObject(maybeSave)) return;

      const normalized = normalizeSaveInput(maybeSave);
      if (!normalized.ok) return;

      setSaveDocument(normalized.value);
      setSourceLabel(getStringValue(parsed.sourceLabel) || 'Recovered local draft');
      setOutputFileName(safeFileName(getStringValue(parsed.outputFileName) || 'edited_save.json'));
      const rawWasDirty = Boolean(parsed.rawDirty);
      if (rawWasDirty && typeof parsed.rawDraft === 'string') {
        setRawText(parsed.rawDraft);
        setRawDirty(true);
      } else {
        setRawDirty(false);
      }
      setNotice({ type: 'info', message: 'Restored previous editor session from local storage.' });
    } catch {
      // Ignore malformed persisted data.
    }
  }, []);

  useEffect(() => {
    if (!saveDocument || rawDirty) return;
    setRawText(JSON.stringify(saveDocument, null, 2));
  }, [rawDirty, saveDocument]);

  useEffect(() => {
    setRawSelectionRange((current) => {
      const nextStart = Math.min(current.start, rawText.length);
      const nextEnd = Math.min(current.end, rawText.length);
      if (nextStart === current.start && nextEnd === current.end) return current;
      return { start: nextStart, end: nextEnd };
    });
  }, [rawText.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!saveDocument) {
      window.localStorage.removeItem(SAVE_EDITOR_LOCALSTORAGE_KEY);
      return;
    }

    const payload: PersistedSaveEditorState = {
      version: 1,
      saveDocument,
      sourceLabel,
      outputFileName: safeFileName(outputFileName),
      rawDirty,
      rawDraft: rawDirty ? rawText : null,
    };

    try {
      window.localStorage.setItem(SAVE_EDITOR_LOCALSTORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota or storage write errors.
    }
  }, [outputFileName, rawDirty, rawText, saveDocument, sourceLabel]);

  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const [
          itemsRes,
          characterRes,
          charTextENRes,
          charTextJPRes,
          manaBoardListRes,
          charactersAllRes,
          mostlyCompleteRes,
          equipmentEnhancementStatusRes,
          exBoostStatusRes,
          exBoostAbilityRes,
        ] = await Promise.all([
          fetchFirstAvailable(['/api/items'], { cache: 'no-store' }),
          fetchFirstAvailable(getDataFallbackUrls('/data/character.json'), { cache: 'no-store' }),
          fetchFirstAvailable(['/api/character-text?lang=en'], { cache: 'no-store' }),
          fetchFirstAvailable(['/api/character-text?lang=jp'], { cache: 'no-store' }),
          fetchFirstAvailable(['/api/manaboard/list'], { cache: 'no-store' }),
          fetchFirstAvailable(getDataFallbackUrls('/data/characters_all.json'), { cache: 'no-store' }),
          fetchFirstAvailable(getDataFallbackUrls('/data/mostly_complete_save.json'), { cache: 'no-store' }),
          fetchFirstAvailable(getDataFallbackUrls('/data/datalist/equipment_enhancement/equipment_enhancement_status.json'), {
            cache: 'no-store',
          }),
          fetchFirstAvailable(getDataFallbackUrls('/data/datalist/ex_boost/ex_status.json'), { cache: 'no-store' }),
          fetchFirstAvailable(getDataFallbackUrls('/data/datalist_en/ex_boost/ex_ability.json'), { cache: 'no-store' }),
        ]);

        if (canceled) return;

        if (itemsRes) {
          const itemsPayload = (await itemsRes.json()) as { items?: unknown[] };
          const nextItems: Record<string, ItemMeta> = {};
          for (const rawItem of itemsPayload.items ?? []) {
            if (!isObject(rawItem)) continue;
            const id = getStringValue(rawItem.id);
            if (!id) continue;
            const typeRaw = getStringValue(rawItem.type);
            const type: 'item' | 'equipment' = typeRaw === 'equipment' ? 'equipment' : 'item';
            const sheetRegions = Array.isArray(rawItem.sheetRegions)
              ? rawItem.sheetRegions
                  .map((entry) => getStringValue(entry))
                  .filter((entry): entry is EquipmentRegion => entry === 'gl' || entry === 'ja')
              : [];
            nextItems[id] = {
              id,
              devName: getStringValue(rawItem.devname ?? rawItem.devName),
              name: getStringValue(rawItem.name) || id,
              icon: getStringValue(rawItem.icon),
              thumbnail: getStringValue(rawItem.thumbnail),
              type,
              sheetRegions,
            };
          }
          setItemMetaById(nextItems);
        }

        if (characterRes) {
          const characterJson = (await characterRes.json()) as Record<string, unknown>;
          const charTextENPayload = charTextENRes ? ((await charTextENRes.json()) as { data?: unknown }) : {};
          const charTextJPPayload = charTextJPRes ? ((await charTextJPRes.json()) as { data?: unknown }) : {};
          const textEN = isObject(charTextENPayload.data) ? (charTextENPayload.data as Record<string, unknown>) : {};
          const textJP = isObject(charTextJPPayload.data) ? (charTextJPPayload.data as Record<string, unknown>) : {};

          const nextCharacters: Record<string, CharacterMeta> = {};
          for (const [id, rawValue] of Object.entries(characterJson)) {
            const parsed = normalizeCharacterArray(rawValue);
            const faceCode = getStringValue(parsed[0]);
            if (!faceCode) continue;

            const enArr = textEN[id];
            const jpArr = textJP[id];
            const enName = Array.isArray(enArr) ? getStringValue(enArr[0]) : '';
            const jpName = Array.isArray(jpArr) ? getStringValue(jpArr[0]) : '';

            nextCharacters[id] = {
              id,
              faceCode,
              group: getStringValue(parsed[2]),
              nameEN: enName,
              nameJP: jpName,
              rarity: getNumberValue(parsed[3], 4) + 1,
            };
          }

          setCharacterMetaById(nextCharacters);

          if (charactersAllRes) {
            const payload = (await charactersAllRes.json()) as { chars?: unknown[] };
            const faceCodeToId: Record<string, string> = {};
            for (const [id, meta] of Object.entries(nextCharacters)) {
              if (meta.faceCode) {
                faceCodeToId[meta.faceCode] = id;
              }
            }

            const ids: string[] = [];
            const seen = new Set<string>();
            const nextCatalogMetaById: Record<string, CharacterCatalogMeta> = {};
            for (const rawEntry of payload.chars ?? []) {
              if (!isObject(rawEntry)) continue;
              const devNickname = getStringValue(rawEntry.DevNicknames).trim();
              if (!devNickname) continue;
              const mappedId = faceCodeToId[devNickname];
              if (!mappedId || seen.has(mappedId)) continue;
              seen.add(mappedId);
              ids.push(mappedId);

              nextCatalogMetaById[mappedId] = {
                devName: devNickname,
                enName: compactText(rawEntry.ENName),
                jpName: compactText(rawEntry.JPName),
                skill: compactText(rawEntry.Skill),
                skillWait: compactText(rawEntry.SkillWait),
                leaderBuff: compactText(rawEntry.LeaderBuff),
                ability1: compactText(rawEntry.Ability1),
                ability2: compactText(rawEntry.Ability2),
                ability3: compactText(rawEntry.Ability3),
                ability4: compactText(rawEntry.Ability4),
                ability5: compactText(rawEntry.Ability5),
                ability6: compactText(rawEntry.Ability6),
              };
            }

            ids.sort((a, b) => getNumberValue(a, 0) - getNumberValue(b, 0));
            setCharacterCatalogIds(ids);
            setCharacterCatalogMetaById(nextCatalogMetaById);
          }

          if (mostlyCompleteRes) {
            const payload = (await mostlyCompleteRes.json()) as { data?: { user_character_mana_node_list?: unknown } };
            const nodeMap = isObject(payload.data?.user_character_mana_node_list)
              ? (payload.data?.user_character_mana_node_list as Record<string, unknown>)
              : {};
            const ids = Object.keys(nodeMap).sort((a, b) => getNumberValue(a, 0) - getNumberValue(b, 0));
            setGlobalCharacterIds(ids);
          }
        }

        if (manaBoardListRes) {
          const payload = (await manaBoardListRes.json()) as {
            characters?: Array<{ id?: unknown; boardNodeCounts?: unknown; hasBoard2?: unknown }>;
            requirementsByGroup?: Record<string, unknown>;
          };
          const nextMap: Record<string, ManaBoardMeta> = {};
          for (const rawCharacter of payload.characters ?? []) {
            if (!isObject(rawCharacter)) continue;
            const id = getStringValue(rawCharacter.id);
            if (!id) continue;
            const counts = isObject(rawCharacter.boardNodeCounts)
              ? (rawCharacter.boardNodeCounts as Record<string, unknown>)
              : {};
            nextMap[id] = {
              board1Nodes: getNumberValue(counts['1'], 23),
              board2Nodes: getNumberValue(counts['2'], 0),
              hasBoard2: Boolean(rawCharacter.hasBoard2) || getNumberValue(counts['2'], 0) > 0,
            };
          }
          setManaBoardMetaById(nextMap);

          const nextRequirements: Record<string, ManaBoardGroupRequirementMeta> = {};
          for (const [groupId, rawRequirement] of Object.entries(payload.requirementsByGroup ?? {})) {
            if (!isObject(rawRequirement)) continue;
            const rawLevelEntries = Array.isArray(rawRequirement.rawLevelEntries)
              ? rawRequirement.rawLevelEntries.map((entry) => getStringValue(entry))
              : [];
            const levelRequirements = Array.isArray(rawRequirement.levelRequirements)
              ? rawRequirement.levelRequirements
                  .map((entry) => (typeof entry === 'number' ? entry : toNumeric(getStringValue(entry), 0)))
                  .filter((entry) => Number.isFinite(entry) && entry > 0)
              : [];
            const board2ConditionIds = Array.isArray(rawRequirement.board2ConditionIds)
              ? rawRequirement.board2ConditionIds.map((entry) => getStringValue(entry)).filter(Boolean)
              : [];
            nextRequirements[groupId] = {
              rawLevelEntries,
              levelRequirements,
              board2ConditionIds,
            };
          }
          setManaBoardRequirementsByGroup(nextRequirements);
        }

        if (equipmentEnhancementStatusRes) {
          const payload = (await equipmentEnhancementStatusRes.json()) as Record<string, unknown>;
          const nextMap: Record<string, number[]> = {};
          for (const [equipmentId, rawStatuses] of Object.entries(payload)) {
            if (!isObject(rawStatuses)) continue;
            const options = Object.keys(rawStatuses)
              .map((value) => Number.parseInt(value, 10))
              .filter((value) => Number.isFinite(value) && value > 0)
              .sort((a, b) => a - b);
            if (options.length > 0) {
              nextMap[equipmentId] = options;
            }
          }
          setEquipmentEnhancementOptionsById(nextMap);
        }

        if (exBoostStatusRes) {
          const payload = (await exBoostStatusRes.json()) as Record<string, unknown>;
          const nextMap: Record<string, ExBoostStatusMeta> = {};
          for (const [statusId, rawEntry] of Object.entries(payload)) {
            if (!Array.isArray(rawEntry)) continue;
            const key = getStringValue(rawEntry[0]).trim();
            if (!key || key === '(None)') continue;
            nextMap[statusId] = {
              id: statusId,
              key,
              hp: getNumberValue(rawEntry[1], 0),
              atk: getNumberValue(rawEntry[2], 0),
              rarity: toExBoostRarity(rawEntry[3]),
            };
          }
          setExBoostStatusMetaById(nextMap);
        }

        if (exBoostAbilityRes) {
          const payload = (await exBoostAbilityRes.json()) as Record<string, unknown>;
          const nextMap: Record<string, ExBoostAbilityMeta> = {};
          for (const [abilityId, rawEntry] of Object.entries(payload)) {
            if (!Array.isArray(rawEntry)) continue;
            const key = getStringValue(rawEntry[0]).trim();
            if (!key || key === '(None)') continue;
            const numericId = getNumberValue(abilityId, 0);
            if (numericId <= 0) continue;
            nextMap[abilityId] = {
              id: abilityId,
              key,
              baseKey: key.replace(/_r[345]$/i, ''),
              slot: numericId <= 30 ? 'slot_a' : 'slot_b',
              rarity: toExBoostRarity(rawEntry[2]),
              value: getNumberValue(rawEntry[3], 0),
            };
          }
          setExBoostAbilityMetaById(nextMap);
        }
      } catch {
        // Metadata is optional; editor still works with IDs only.
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const sourceRequests = STORY_QUEST_SOURCES.map((source) =>
          fetchFirstAvailable(getDataFallbackUrls(source.path), { cache: 'no-store' })
        );
        const [questCategoryRes, mainChapterRes, exChapterRes, ...sourceResponses] = await Promise.all([
          fetchFirstAvailable(getDataFallbackUrls('/data/datalist_en/quest/quest_category.json'), { cache: 'no-store' }),
          fetchFirstAvailable(getDataFallbackUrls('/data/datalist_en/quest/main_chapter.json'), { cache: 'no-store' }),
          fetchFirstAvailable(getDataFallbackUrls('/data/datalist_en/quest/ex_chapter.json'), { cache: 'no-store' }),
          ...sourceRequests,
        ]);

        if (canceled) return;

        const categoryNameById: Record<string, string> = {};
        if (questCategoryRes) {
          const payload = (await questCategoryRes.json()) as Record<string, unknown>;
          for (const [categoryId, rawValue] of Object.entries(payload)) {
            if (!Array.isArray(rawValue)) continue;
            const categoryName = compactText(rawValue[0]);
            if (!categoryName || categoryName === '(None)') continue;
            categoryNameById[categoryId] = categoryName;
          }
        }

        const mainChapterNameById: Record<string, string> = {};
        if (mainChapterRes) {
          const payload = (await mainChapterRes.json()) as Record<string, unknown>;
          for (const [chapterId, rawValue] of Object.entries(payload)) {
            if (!Array.isArray(rawValue)) continue;
            const chapterName = compactText(rawValue[0]);
            if (!chapterName || chapterName === '(None)') continue;
            mainChapterNameById[chapterId] = chapterName;
          }
        }

        const exChapterNameById: Record<string, string> = {};
        if (exChapterRes) {
          const payload = (await exChapterRes.json()) as Record<string, unknown>;
          for (const [chapterId, rawValue] of Object.entries(payload)) {
            if (!Array.isArray(rawValue)) continue;
            const chapterName = compactText(rawValue[0]);
            if (!chapterName || chapterName === '(None)') continue;
            exChapterNameById[chapterId] = chapterName;
          }
        }

        const nextStoryQuestMetaBySource: Partial<Record<StoryQuestSourceKey, Record<string, StoryQuestMeta>>> = {};
        const nextStoryQuestMetaFallbackByQuestId: Record<string, StoryQuestMeta> = {};

        for (let index = 0; index < STORY_QUEST_SOURCES.length; index += 1) {
          const source = STORY_QUEST_SOURCES[index];
          const response = sourceResponses[index];
          if (!response) continue;

          const payload = (await response.json()) as unknown;
          const sourceCategoryName = getCategoryNameForSourceKey(source.key);
          const sourceCategoryLabel = formatQuestCategoryLabel(sourceCategoryName);
          const sourceMap: Record<string, StoryQuestMeta> = {};

          collectStoryRows(payload, (row, path) => {
            const parsed = extractStoryMetaFromRow(row);
            if (!parsed) return;

            const chapterKey = path[0] ?? '';
            const chapterLabel =
              source.chapterKind === 'main'
                ? mainChapterNameById[chapterKey] ?? ''
                : source.chapterKind === 'ex'
                  ? exChapterNameById[chapterKey] ?? ''
                  : '';

            const candidate: StoryQuestMeta = {
              questId: parsed.questId,
              title: parsed.title,
              thumbnail: parsed.thumbnail,
              sourceKey: source.key,
              sourceLabel: source.label,
              sourcePath: source.path,
              orderedMapPath: source.orderedMapPath,
              categoryName: sourceCategoryName,
              categoryLabel: sourceCategoryLabel,
              chapterKey,
              chapterLabel,
            };

            const existingInSource = sourceMap[parsed.questId];
            if (!existingInSource || getStoryMetaScore(candidate) > getStoryMetaScore(existingInSource)) {
              sourceMap[parsed.questId] = candidate;
            }

            const existingFallback = nextStoryQuestMetaFallbackByQuestId[parsed.questId];
            if (!existingFallback || getStoryMetaScore(candidate) > getStoryMetaScore(existingFallback)) {
              nextStoryQuestMetaFallbackByQuestId[parsed.questId] = candidate;
            }
          });

          nextStoryQuestMetaBySource[source.key] = sourceMap;
        }

        if (canceled) return;
        setStoryQuestCategoryNameById(categoryNameById);
        setStoryQuestMetaBySourceKey(nextStoryQuestMetaBySource);
        setStoryQuestMetaFallbackByQuestId(nextStoryQuestMetaFallbackByQuestId);
      } catch {
        // Story metadata is optional; fallback is quest IDs from save data.
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  const rawParsedState = useMemo(() => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      return { hasContent: false, isValid: false, error: 'Raw JSON is empty.', parsed: null as unknown };
    }

    const parsed = parseJson(trimmed);
    if (!parsed.ok) {
      return { hasContent: true, isValid: false, error: parsed.error, parsed: null as unknown };
    }

    return { hasContent: true, isValid: true, error: null as string | null, parsed: parsed.value };
  }, [rawText]);

  const saveStats = useMemo(() => {
    if (!saveDocument) {
      return {
        dataKeys: 0,
        characters: 0,
        items: 0,
        equipment: 0,
        parties: 0,
        stories: 0,
        fileSizeBytes: new Blob([rawText]).size,
      };
    }

    const dataKeys = Object.keys(saveDocument.data).length;
    const characters = isObject(saveDocument.data.user_character_list)
      ? Object.keys(saveDocument.data.user_character_list).length
      : 0;
    const items = isObject(saveDocument.data.item_list) ? Object.keys(saveDocument.data.item_list).length : 0;
    const equipment = isObject(saveDocument.data.user_equipment_list)
      ? Object.keys(saveDocument.data.user_equipment_list).length
      : 0;
    const parties = isObject(saveDocument.data.user_party_group_list)
      ? Object.values(saveDocument.data.user_party_group_list).reduce<number>((sum, groupValue) => {
          if (!isObject(groupValue)) return sum;
          const list = isObject(groupValue.list) ? (groupValue.list as Record<string, unknown>) : {};
          return sum + Object.keys(list).length;
        }, 0)
      : 0;
    const stories = isObject(saveDocument.data.quest_progress)
      ? Object.values(saveDocument.data.quest_progress).reduce<number>((sum, value) => {
          if (!Array.isArray(value)) return sum;
          return sum + value.length;
        }, 0)
      : 0;

    return {
      dataKeys,
      characters,
      items,
      equipment,
      parties,
      stories,
      fileSizeBytes: new Blob([JSON.stringify(saveDocument)]).size,
    };
  }, [rawText, saveDocument]);

  const userInfo = useMemo(() => {
    if (!saveDocument) return {} as JsonObject;
    return isObject(saveDocument.data.user_info) ? saveDocument.data.user_info : ({} as JsonObject);
  }, [saveDocument]);

  const characterEntries = useMemo(() => {
    if (!saveDocument || !isObject(saveDocument.data.user_character_list)) return [] as Array<[string, JsonObject]>;
    return Object.entries(saveDocument.data.user_character_list)
      .filter((entry): entry is [string, JsonObject] => isObject(entry[1]))
      .sort((a, b) => getNumberValue(a[0], 0) - getNumberValue(b[0], 0));
  }, [saveDocument]);

  const ownedCharacterIds = useMemo(() => {
    return new Set(characterEntries.map(([id]) => id));
  }, [characterEntries]);

  const globalCharacterIdSet = useMemo(() => new Set(globalCharacterIds), [globalCharacterIds]);

  const allCharacterIds = useMemo(() => {
    if (characterCatalogIds.length > 0) {
      if (globalCharacterIds.length > 0) {
        return characterCatalogIds.filter((id) => globalCharacterIdSet.has(id));
      }
      return characterCatalogIds;
    }

    const all = new Set<string>();
    for (const id of Object.keys(characterMetaById)) all.add(id);
    for (const [id] of characterEntries) all.add(id);
    return Array.from(all).sort((a, b) => getNumberValue(a, 0) - getNumberValue(b, 0));
  }, [characterCatalogIds, characterEntries, characterMetaById, globalCharacterIdSet, globalCharacterIds.length]);

  const ownedVisibleCharacterCount = useMemo(() => {
    const visibleSet = new Set(allCharacterIds);
    return characterEntries.reduce((count, [id]) => (visibleSet.has(id) ? count + 1 : count), 0);
  }, [allCharacterIds, characterEntries]);

  const searchedCharacters = useMemo(() => {
    const query = characterSearch.trim().toLowerCase();
    if (!query) return allCharacterIds;
    return allCharacterIds.filter((id) => {
      if (id.toLowerCase().includes(query)) return true;
      const meta = characterMetaById[id];
      const haystack = [meta?.nameEN, meta?.nameJP, meta?.faceCode].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [allCharacterIds, characterMetaById, characterSearch]);

  const selectedCharacter = useMemo(() => {
    if (!selectedCharacterId || !saveDocument || !isObject(saveDocument.data.user_character_list)) return null;
    const value = saveDocument.data.user_character_list[selectedCharacterId];
    return isObject(value) ? value : null;
  }, [saveDocument, selectedCharacterId]);

  const exBoostStatusOptions = useMemo(() => {
    return Object.values(exBoostStatusMetaById)
      .sort((left, right) => getNumberValue(left.id, 0) - getNumberValue(right.id, 0))
      .map((status) => ({
        id: getNumberValue(status.id, 0),
        key: status.key,
        rarity: status.rarity,
        hp: status.hp,
        atk: status.atk,
        label: getExBoostStatusLabel(status.key),
      }))
      .filter((entry) => entry.id > 0);
  }, [exBoostStatusMetaById]);

  const exBoostAbilityOptions = useMemo(() => {
    return Object.values(exBoostAbilityMetaById)
      .map((ability) => ({
        id: getNumberValue(ability.id, 0),
        key: ability.key,
        baseKey: ability.baseKey,
        slot: ability.slot,
        rarity: ability.rarity,
        value: ability.value,
        label: getExBoostAbilityLabel(ability.baseKey),
      }))
      .sort((left, right) => {
        if (left.slot !== right.slot) return left.slot === 'slot_a' ? -1 : 1;
        return left.id - right.id;
      })
      .filter((entry) => entry.id > 0);
  }, [exBoostAbilityMetaById]);

  const exBoostStatusOptionIdSet = useMemo(() => {
    return new Set(exBoostStatusOptions.map((entry) => entry.id));
  }, [exBoostStatusOptions]);

  const exBoostAbilityOptionIdSet = useMemo(() => {
    return new Set(exBoostAbilityOptions.map((entry) => entry.id));
  }, [exBoostAbilityOptions]);

  const exBoostDefaultStatusId = useMemo(() => {
    return exBoostStatusOptions.find((entry) => entry.rarity === 5)?.id ?? exBoostStatusOptions[0]?.id ?? 1;
  }, [exBoostStatusOptions]);

  const exBoostDefaultAbilityIds = useMemo(() => {
    if (exBoostAbilityOptions.length === 0) return [1, 31] as [number, number];
    const first =
      exBoostAbilityOptions.find((entry) => entry.slot === 'slot_a' && entry.rarity === 5)?.id ??
      exBoostAbilityOptions.find((entry) => entry.slot === 'slot_a')?.id ??
      exBoostAbilityOptions[0]?.id ??
      1;
    const second =
      exBoostAbilityOptions.find((entry) => entry.slot === 'slot_b' && entry.rarity === 5)?.id ??
      exBoostAbilityOptions.find((entry) => entry.slot === 'slot_b')?.id ??
      exBoostAbilityOptions.find((entry) => entry.id !== first)?.id ??
      first;
    return [first, second] as [number, number];
  }, [exBoostAbilityOptions]);

  const selectedCharacterExBoost = useMemo(() => {
    if (!selectedCharacter || !isObject(selectedCharacter.ex_boost)) return null;
    const exBoost = selectedCharacter.ex_boost as JsonObject;
    const rawAbilityIds = Array.isArray(exBoost.ability_id_list) ? exBoost.ability_id_list : [];
    return {
      statusId: Math.max(1, getNumberValue(exBoost.status_id, exBoostDefaultStatusId)),
      abilityIds: [
        Math.max(1, getNumberValue(rawAbilityIds[0], exBoostDefaultAbilityIds[0])),
        Math.max(1, getNumberValue(rawAbilityIds[1], exBoostDefaultAbilityIds[1])),
      ] as [number, number],
    };
  }, [exBoostDefaultAbilityIds, exBoostDefaultStatusId, selectedCharacter]);

  const selectedCharacterExBoostStatusMeta = useMemo(() => {
    if (!selectedCharacterExBoost) return null;
    return exBoostStatusOptions.find((entry) => entry.id === selectedCharacterExBoost.statusId) ?? null;
  }, [exBoostStatusOptions, selectedCharacterExBoost]);

  const selectedCharacterExBoostSlotAMeta = useMemo(() => {
    if (!selectedCharacterExBoost) return null;
    return exBoostAbilityOptions.find((entry) => entry.id === selectedCharacterExBoost.abilityIds[0]) ?? null;
  }, [exBoostAbilityOptions, selectedCharacterExBoost]);

  const selectedCharacterExBoostSlotBMeta = useMemo(() => {
    if (!selectedCharacterExBoost) return null;
    return exBoostAbilityOptions.find((entry) => entry.id === selectedCharacterExBoost.abilityIds[1]) ?? null;
  }, [exBoostAbilityOptions, selectedCharacterExBoost]);

  const selectedCharacterExBoostStatusRarity = selectedCharacterExBoostStatusMeta?.rarity ?? (5 as ExBoostRarity);
  const selectedCharacterExBoostSlotARarity = selectedCharacterExBoostSlotAMeta?.rarity ?? (5 as ExBoostRarity);
  const selectedCharacterExBoostSlotBRarity = selectedCharacterExBoostSlotBMeta?.rarity ?? (5 as ExBoostRarity);

  const exBoostStatusOptionsForSelectedRarity = useMemo(() => {
    return exBoostStatusOptions.filter((entry) => entry.rarity === selectedCharacterExBoostStatusRarity);
  }, [exBoostStatusOptions, selectedCharacterExBoostStatusRarity]);

  const exBoostSlotAOptionsForSelectedRarity = useMemo(() => {
    return exBoostAbilityOptions.filter(
      (entry) => entry.slot === 'slot_a' && entry.rarity === selectedCharacterExBoostSlotARarity
    );
  }, [exBoostAbilityOptions, selectedCharacterExBoostSlotARarity]);

  const exBoostSlotBOptionsForSelectedRarity = useMemo(() => {
    return exBoostAbilityOptions.filter(
      (entry) => entry.slot === 'slot_b' && entry.rarity === selectedCharacterExBoostSlotBRarity
    );
  }, [exBoostAbilityOptions, selectedCharacterExBoostSlotBRarity]);

  const selectedCharacterRarity = useMemo(() => {
    if (!selectedCharacterId) return 5;
    return getNumberValue(characterMetaById[selectedCharacterId]?.rarity, 5);
  }, [characterMetaById, selectedCharacterId]);

  const selectedCharacterLevelStop = useMemo(() => {
    if (!selectedCharacter) return 80 as CharacterLevelStop;
    const exp = getNumberValue(selectedCharacter.exp, 0);
    const overLimitStep = getNumberValue(selectedCharacter.over_limit_step, 0);
    const fromExp = getLevelStopFromExp(exp, selectedCharacterRarity);
    const fromOverLimit = getLevelStopFromOverLimitStep(overLimitStep);
    const expIndex = getSliderIndexFromLevelStop(fromExp);
    const overLimitIndex = getSliderIndexFromLevelStop(fromOverLimit);
    return CHARACTER_LEVEL_STOPS[Math.max(expIndex, overLimitIndex)];
  }, [selectedCharacter, selectedCharacterRarity]);

  const selectedCharacterLevelSliderIndex = useMemo(() => {
    return getSliderIndexFromLevelStop(selectedCharacterLevelStop);
  }, [selectedCharacterLevelStop]);

  const selectedCharacterNodeIds = useMemo(() => {
    if (!selectedCharacterId || !saveDocument) return [] as number[];
    const manaList = isObject(saveDocument.data.user_character_mana_node_list)
      ? (saveDocument.data.user_character_mana_node_list as Record<string, unknown>)
      : {};
    const raw = manaList[selectedCharacterId];
    if (!Array.isArray(raw)) return [] as number[];
    return raw.map((value) => getNumberValue(value, 0)).filter((value) => value > 0);
  }, [saveDocument, selectedCharacterId]);

  const selectedCharacterNodeSet = useMemo(() => {
    return new Set(selectedCharacterNodeIds);
  }, [selectedCharacterNodeIds]);

  const selectedCharacterBoardMeta = useMemo(() => {
    if (!selectedCharacterId) {
      return { board1Nodes: 23, board2Nodes: 0, hasBoard2: false } as ManaBoardMeta;
    }
    return manaBoardMetaById[selectedCharacterId] ?? ({ board1Nodes: 23, board2Nodes: 0, hasBoard2: false } as ManaBoardMeta);
  }, [manaBoardMetaById, selectedCharacterId]);

  const selectedCharacterBoardProgress = useMemo(() => {
    if (!selectedCharacterId) {
      return { board1Unlocked: 0, board2Unlocked: 0, otherUnlocked: 0 };
    }
    const cid = Number.parseInt(selectedCharacterId, 10);
    if (!Number.isFinite(cid) || cid <= 0) {
      return { board1Unlocked: 0, board2Unlocked: 0, otherUnlocked: selectedCharacterNodeIds.length };
    }

    let board1Unlocked = 0;
    let board2Unlocked = 0;
    let otherUnlocked = 0;
    for (const nodeId of selectedCharacterNodeIds) {
      const delta = nodeId - cid * 2000;
      if (delta >= 201 && delta <= 223) board1Unlocked += 1;
      else if (delta >= 401 && delta <= 418) board2Unlocked += 1;
      else otherUnlocked += 1;
    }
    return { board1Unlocked, board2Unlocked, otherUnlocked };
  }, [selectedCharacterId, selectedCharacterNodeIds]);

  const selectedCharacterCatalogMeta = useMemo(() => {
    if (!selectedCharacterId) return null;
    return characterCatalogMetaById[selectedCharacterId] ?? null;
  }, [characterCatalogMetaById, selectedCharacterId]);

  const selectedCharacterAbilityTracks = useMemo(() => {
    if (!selectedCharacterId) return [] as CharacterAbilityTrackState[];
    return ABILITY_TRACKS.map((track) => {
      const availableNodeIds = track.slots
        .filter((slot) =>
          isManaNodeSlotAvailable(slot, selectedCharacterBoardMeta.board1Nodes, selectedCharacterBoardMeta.board2Nodes)
        )
        .map((slot) => getManaNodeIdForSlot(selectedCharacterId, slot))
        .filter((value): value is number => value !== null);

      let currentLevel = -1;
      for (let index = 0; index < availableNodeIds.length; index += 1) {
        if (!selectedCharacterNodeSet.has(availableNodeIds[index])) break;
        currentLevel = index;
      }

      return {
        key: track.key,
        label: track.label,
        slots: track.slots,
        availableNodeIds,
        currentLevel,
        description: getAbilityTrackDescription(track.key, selectedCharacterCatalogMeta),
      };
    });
  }, [
    selectedCharacterBoardMeta.board1Nodes,
    selectedCharacterBoardMeta.board2Nodes,
    selectedCharacterCatalogMeta,
    selectedCharacterId,
    selectedCharacterNodeSet,
  ]);

  const getCharacterTierRequirements = (characterId: string): number[] => {
    const group = getStringValue(characterMetaById[characterId]?.group);
    if (!group) return buildManaTierCumulativeRequirements(null);
    return buildManaTierCumulativeRequirements(manaBoardRequirementsByGroup[group] ?? null);
  };

  const getCharacterLevelStopFromEntry = (characterId: string, character: JsonObject): CharacterLevelStop => {
    const rarity = getNumberValue(characterMetaById[characterId]?.rarity, 5);
    const exp = getNumberValue(character.exp, 0);
    const overLimitStep = getNumberValue(character.over_limit_step, 0);
    const fromExp = getLevelStopFromExp(exp, rarity);
    const fromOverLimit = getLevelStopFromOverLimitStep(overLimitStep);
    const expIndex = getSliderIndexFromLevelStop(fromExp);
    const overLimitIndex = getSliderIndexFromLevelStop(fromOverLimit);
    return CHARACTER_LEVEL_STOPS[Math.max(expIndex, overLimitIndex)];
  };

  const filterCharacterNodeIdsByProgression = (
    characterId: string,
    nodeIds: number[],
    levelStop: CharacterLevelStop
  ): number[] => {
    const tierRequirements = getCharacterTierRequirements(characterId);
    const cid = Number.parseInt(characterId, 10);
    return Array.from(new Set(nodeIds))
      .filter((nodeId) => {
        if (Number.isFinite(cid) && cid > 0) {
          const delta = nodeId - cid * 2000;
          // MB1 is available at Lv80, including Ability 3, Skill Evolution, and Skill Level nodes.
          if (delta >= 201 && delta <= 223) return true;
        }
        const tier = getManaNodeTierFromNodeId(characterId, nodeId);
        if (tier === null) return true;
        const requiredLevel = tierRequirements[tier] ?? 0;
        return levelStop >= requiredLevel;
      })
      .sort((left, right) => left - right);
  };

  const enforceCharacterNodesForProgression = (draft: SaveDocument, characterId: string): number => {
    const data = getOrCreateObject(draft, 'data');
    const characterList = getOrCreateObject(data, 'user_character_list');
    const character = isObject(characterList[characterId]) ? (characterList[characterId] as JsonObject) : null;
    if (!character) return 0;

    const manaList = getOrCreateObject(data, 'user_character_mana_node_list');
    const rawNodeValues = Array.isArray(manaList[characterId]) ? (manaList[characterId] as unknown[]) : [];
    const nodeIds = rawNodeValues.map((value) => getNumberValue(value, 0)).filter((value) => value > 0);
    if (nodeIds.length === 0) return 0;

    const levelStop = getCharacterLevelStopFromEntry(characterId, character);
    const filtered = filterCharacterNodeIdsByProgression(characterId, nodeIds, levelStop);
    const removedCount = nodeIds.length - filtered.length;
    if (removedCount > 0) {
      manaList[characterId] = filtered;
    }
    return Math.max(0, removedCount);
  };

  const selectedCharacterTierRequirements = useMemo(() => {
    if (!selectedCharacterId) return buildManaTierCumulativeRequirements(null);
    const group = getStringValue(characterMetaById[selectedCharacterId]?.group);
    if (!group) return buildManaTierCumulativeRequirements(null);
    return buildManaTierCumulativeRequirements(manaBoardRequirementsByGroup[group] ?? null);
  }, [characterMetaById, manaBoardRequirementsByGroup, selectedCharacterId]);

  const characterBorderToneById = useMemo(() => {
    const tones: Record<string, CharacterBorderTone> = {};
    if (!saveDocument || !isObject(saveDocument.data.user_character_list)) return tones;

    const characterList = saveDocument.data.user_character_list as Record<string, unknown>;
    const manaNodeList = isObject(saveDocument.data.user_character_mana_node_list)
      ? (saveDocument.data.user_character_mana_node_list as Record<string, unknown>)
      : {};

    for (const characterId of Object.keys(characterList)) {
      const rawNodes = manaNodeList[characterId];
      const nodeSet = new Set<number>(
        Array.isArray(rawNodes)
          ? rawNodes.map((value) => getNumberValue(value, 0)).filter((value) => value > 0)
          : []
      );

      const boardMeta = manaBoardMetaById[characterId] ?? { board1Nodes: 23, board2Nodes: 0, hasBoard2: false };

      const trackState: Record<string, { available: number; maxed: boolean }> = {};
      for (const track of ABILITY_TRACKS) {
        const availableNodeIds = track.slots
          .filter((slot) => isManaNodeSlotAvailable(slot, boardMeta.board1Nodes, boardMeta.board2Nodes))
          .map((slot) => getManaNodeIdForSlot(characterId, slot))
          .filter((value): value is number => value !== null);

        trackState[track.key] = {
          available: availableNodeIds.length,
          maxed: availableNodeIds.length > 0 && availableNodeIds.every((nodeId) => nodeSet.has(nodeId)),
        };
      }

      const coreMaxed = CORE_ABILITY_KEYS.every((key) => Boolean(trackState[key]?.maxed));
      const advancedAvailable = ADVANCED_ABILITY_KEYS.some((key) => (trackState[key]?.available ?? 0) > 0);
      const advancedMaxed =
        advancedAvailable &&
        ADVANCED_ABILITY_KEYS.every((key) => {
          const state = trackState[key];
          if (!state) return false;
          return state.available === 0 || state.maxed;
        });

      let board1Unlocked = 0;
      let board2Unlocked = 0;
      let otherUnlocked = 0;
      const cid = Number.parseInt(characterId, 10);
      if (Number.isFinite(cid) && cid > 0) {
        for (const nodeId of nodeSet) {
          const delta = nodeId - cid * 2000;
          if (delta >= 201 && delta <= 223) board1Unlocked += 1;
          else if (delta >= 401 && delta <= 418) board2Unlocked += 1;
          else otherUnlocked += 1;
        }
      } else {
        otherUnlocked = nodeSet.size;
      }

      const hasMb2 = boardMeta.hasBoard2 || boardMeta.board2Nodes > 0;

      const fullyMaxed =
        hasMb2 &&
        board1Unlocked >= boardMeta.board1Nodes &&
        board2Unlocked >= boardMeta.board2Nodes &&
        otherUnlocked === 0 &&
        nodeSet.size > 0;

      if (fullyMaxed) tones[characterId] = 'gold';
      else if (coreMaxed && advancedAvailable && !advancedMaxed) tones[characterId] = 'red';
      else if (coreMaxed) tones[characterId] = 'blue';
      else tones[characterId] = 'default';
    }

    return tones;
  }, [manaBoardMetaById, saveDocument]);

  const mb2AvailabilityById = useMemo(() => {
    const availability: Record<string, boolean> = {};
    const sourceIds = allCharacterIds.length > 0 ? allCharacterIds : Object.keys(manaBoardMetaById);
    for (const id of sourceIds) {
      const boardMeta = manaBoardMetaById[id];
      availability[id] = Boolean(boardMeta?.hasBoard2) || getNumberValue(boardMeta?.board2Nodes, 0) > 0;
    }
    return availability;
  }, [allCharacterIds, manaBoardMetaById]);

  const mb2FilteredCharacters = useMemo(() => {
    if (characterMb2Filter === 'all') return searchedCharacters;
    const wantsMb2 = characterMb2Filter === 'has_mb2';
    return searchedCharacters.filter((id) => Boolean(mb2AvailabilityById[id]) === wantsMb2);
  }, [characterMb2Filter, mb2AvailabilityById, searchedCharacters]);

  const filteredCharacters = useMemo(() => {
    if (characterBorderFilter === 'all') return mb2FilteredCharacters;
    return mb2FilteredCharacters.filter((id) => characterBorderToneById[id] === characterBorderFilter);
  }, [characterBorderFilter, characterBorderToneById, mb2FilteredCharacters]);

  const characterTotalPages = Math.max(1, Math.ceil(filteredCharacters.length / CHARACTER_PAGE_SIZE));
  const visibleCharacters = useMemo(() => {
    const start = (characterPage - 1) * CHARACTER_PAGE_SIZE;
    return filteredCharacters.slice(start, start + CHARACTER_PAGE_SIZE);
  }, [characterPage, filteredCharacters]);

  const characterContextMenuEntry = useMemo(() => {
    const id = characterContextMenu.characterId;
    if (!id) return null;

    const meta = characterMetaById[id];
    const catalogMeta = characterCatalogMetaById[id];
    const characterList = saveDocument && isObject(saveDocument.data.user_character_list)
      ? (saveDocument.data.user_character_list as Record<string, unknown>)
      : {};
    const characterValue = characterList[id];
    const character = isObject(characterValue) ? characterValue : null;
    const owned = Boolean(character);

    const rarity = getNumberValue(meta?.rarity, 5);
    const exp = getNumberValue(character?.exp, 0);
    const overLimitStep = getNumberValue(character?.over_limit_step, 0);
    const fromExp = getLevelStopFromExp(exp, rarity);
    const fromOverLimit = getLevelStopFromOverLimitStep(overLimitStep);
    const levelStop = CHARACTER_LEVEL_STOPS[Math.max(getSliderIndexFromLevelStop(fromExp), getSliderIndexFromLevelStop(fromOverLimit))];

    const manaNodeList = saveDocument && isObject(saveDocument.data.user_character_mana_node_list)
      ? (saveDocument.data.user_character_mana_node_list as Record<string, unknown>)
      : {};
    const rawNodes = manaNodeList[id];
    const nodeIds = Array.isArray(rawNodes)
      ? rawNodes.map((value) => getNumberValue(value, 0)).filter((value) => value > 0)
      : [];

    const boardMeta = manaBoardMetaById[id] ?? ({ board1Nodes: 23, board2Nodes: 0, hasBoard2: false } as ManaBoardMeta);
    const hasMb2 = boardMeta.hasBoard2 || boardMeta.board2Nodes > 0;

    let board1Unlocked = 0;
    let board2Unlocked = 0;
    const cid = Number.parseInt(id, 10);
    if (Number.isFinite(cid) && cid > 0) {
      for (const nodeId of nodeIds) {
        const delta = nodeId - cid * 2000;
        if (delta >= 201 && delta <= 223) board1Unlocked += 1;
        else if (delta >= 401 && delta <= 418) board2Unlocked += 1;
      }
    }

    return {
      id,
      owned,
      tone: characterBorderToneById[id] ?? 'default',
      name: meta?.nameEN || meta?.nameJP || meta?.faceCode || `Character ${id}`,
      faceCode: meta?.faceCode || '',
      devName: catalogMeta?.devName || meta?.faceCode || '',
      hasMb2,
      levelStop,
      overLimitStep,
      board1Unlocked,
      board2Unlocked,
      board1Total: boardMeta.board1Nodes,
      board2Total: boardMeta.board2Nodes,
    };
  }, [characterBorderToneById, characterCatalogMetaById, characterContextMenu.characterId, characterMetaById, manaBoardMetaById, saveDocument]);

  const characterContextMenuPosition = useMemo(() => {
    const menuWidth = 312;
    const menuHeight = 620;
    const margin = 8;
    if (typeof window === 'undefined') {
      return { left: characterContextMenu.x, top: characterContextMenu.y };
    }
    const left = Math.max(margin, Math.min(characterContextMenu.x, window.innerWidth - menuWidth - margin));
    const top = Math.max(margin, Math.min(characterContextMenu.y, window.innerHeight - menuHeight - margin));
    return { left, top };
  }, [characterContextMenu.x, characterContextMenu.y]);

  const itemEntries = useMemo(() => {
    if (!saveDocument || !isObject(saveDocument.data.item_list)) return [] as Array<[string, number]>;
    return Object.entries(saveDocument.data.item_list)
      .map(([id, qty]) => [id, getNumberValue(qty, 0)] as [string, number])
      .sort((a, b) => getNumberValue(a[0], 0) - getNumberValue(b[0], 0));
  }, [saveDocument]);

  const itemQuantityById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [id, quantity] of itemEntries) {
      map[id] = quantity;
    }
    return map;
  }, [itemEntries]);

  const ownedItemIds = useMemo(() => {
    return new Set(itemEntries.map(([id]) => id));
  }, [itemEntries]);

  const allItemIds = useMemo(() => {
    const idSet = new Set<string>();
    for (const [id] of itemEntries) idSet.add(id);
    for (const [id, meta] of Object.entries(itemMetaById)) {
      if (meta.type === 'item') idSet.add(id);
    }
    return Array.from(idSet).sort((a, b) => {
      const numericDiff = getNumberValue(a, 0) - getNumberValue(b, 0);
      if (numericDiff !== 0) return numericDiff;
      return a.localeCompare(b);
    });
  }, [itemEntries, itemMetaById]);

  const searchedItemIds = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    if (!query) return allItemIds;
    return allItemIds.filter((id) => {
      if (id.toLowerCase().includes(query)) return true;
      const meta = itemMetaById[id];
      const name = getStringValue(meta?.name).toLowerCase();
      return name.includes(query);
    });
  }, [allItemIds, itemMetaById, itemSearch]);

  const filteredItemIds = useMemo(() => {
    if (itemOwnedFilter === 'all') return searchedItemIds;
    const wantsOwned = itemOwnedFilter === 'owned';
    return searchedItemIds.filter((id) => ownedItemIds.has(id) === wantsOwned);
  }, [itemOwnedFilter, ownedItemIds, searchedItemIds]);

  const itemTotalPages = Math.max(1, Math.ceil(filteredItemIds.length / ITEM_PAGE_SIZE));
  const visibleItemIds = useMemo(() => {
    const start = (itemPage - 1) * ITEM_PAGE_SIZE;
    return filteredItemIds.slice(start, start + ITEM_PAGE_SIZE);
  }, [filteredItemIds, itemPage]);

  const selectedItemQuantity = useMemo(() => {
    if (!selectedItemId) return 0;
    return itemQuantityById[selectedItemId] ?? 0;
  }, [itemQuantityById, selectedItemId]);

  const selectedItemOwned = useMemo(() => {
    if (!selectedItemId) return false;
    return ownedItemIds.has(selectedItemId);
  }, [ownedItemIds, selectedItemId]);

  const selectedItemMeta = useMemo(() => {
    if (!selectedItemId) return null;
    return itemMetaById[selectedItemId] ?? null;
  }, [itemMetaById, selectedItemId]);

  const selectedItemDisplayName = useMemo(() => {
    if (!selectedItemId) return '';
    return selectedItemMeta?.name || `Item ${selectedItemId}`;
  }, [selectedItemId, selectedItemMeta]);

  const selectedItemThumbUrls = useMemo(() => {
    if (!selectedItemId) return [] as string[];
    return [toCdnUrl(selectedItemMeta?.thumbnail || ''), toCdnUrl(selectedItemMeta?.icon || '')].filter(Boolean);
  }, [selectedItemId, selectedItemMeta]);

  const itemContextMenuEntry = useMemo(() => {
    const id = itemContextMenu.itemId;
    if (!id) return null;
    const meta = itemMetaById[id];
    return {
      id,
      quantity: itemQuantityById[id] ?? 0,
      owned: ownedItemIds.has(id),
      name: meta?.name || `Item ${id}`,
      type: meta?.type ?? 'item',
    };
  }, [itemContextMenu.itemId, itemMetaById, itemQuantityById, ownedItemIds]);

  const itemContextMenuPosition = useMemo(() => {
    const menuWidth = 224;
    const menuHeight = 280;
    const margin = 8;
    if (typeof window === 'undefined') {
      return { left: itemContextMenu.x, top: itemContextMenu.y };
    }
    const left = Math.max(margin, Math.min(itemContextMenu.x, window.innerWidth - menuWidth - margin));
    const top = Math.max(margin, Math.min(itemContextMenu.y, window.innerHeight - menuHeight - margin));
    return { left, top };
  }, [itemContextMenu.x, itemContextMenu.y]);

  const equipmentEntries = useMemo(() => {
    if (!saveDocument || !isObject(saveDocument.data.user_equipment_list)) {
      return [] as Array<[string, JsonObject]>;
    }

    return Object.entries(saveDocument.data.user_equipment_list)
      .map(([id, value]) => [id, isObject(value) ? value : {}] as [string, JsonObject])
      .sort((a, b) => getNumberValue(a[0], 0) - getNumberValue(b[0], 0));
  }, [saveDocument]);

  const equipmentById = useMemo(() => {
    const map: Record<string, JsonObject> = {};
    for (const [id, value] of equipmentEntries) {
      map[id] = value;
    }
    return map;
  }, [equipmentEntries]);

  const ownedEquipmentIds = useMemo(() => {
    return new Set(equipmentEntries.map(([id]) => id));
  }, [equipmentEntries]);

  const allEquipmentIds = useMemo(() => {
    const idSet = new Set<string>();
    for (const [id] of equipmentEntries) idSet.add(id);
    for (const [id, meta] of Object.entries(itemMetaById)) {
      if (meta.type !== 'equipment') continue;
      // Save editor is EN-only: do not include JP-exclusive equipment in addable catalog IDs.
      if (meta.sheetRegions.length > 0 && !meta.sheetRegions.includes('gl')) continue;
      idSet.add(id);
    }
    return Array.from(idSet).sort((a, b) => {
      const numericDiff = getNumberValue(a, 0) - getNumberValue(b, 0);
      if (numericDiff !== 0) return numericDiff;
      return a.localeCompare(b);
    });
  }, [equipmentEntries, itemMetaById]);

  const characterCompTokenById = useMemo(() => {
    const map: Record<string, string> = {};
    const ids = new Set<string>([...Object.keys(characterCatalogMetaById), ...Object.keys(characterMetaById)]);
    for (const id of ids) {
      const catalogToken = normalizeEliyaCompToken(getStringValue(characterCatalogMetaById[id]?.devName));
      const fallbackToken = normalizeEliyaCompToken(getStringValue(characterMetaById[id]?.faceCode));
      const token = catalogToken || fallbackToken;
      if (!token) continue;
      map[id] = token;
    }
    return map;
  }, [characterCatalogMetaById, characterMetaById]);

  const characterIdByCompToken = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, meta] of Object.entries(characterCatalogMetaById)) {
      const token = normalizeEliyaCompToken(getStringValue(meta.devName));
      if (token && !map[token]) {
        map[token] = id;
      }
    }
    for (const [id, meta] of Object.entries(characterMetaById)) {
      const token = normalizeEliyaCompToken(getStringValue(meta.faceCode));
      if (token && !map[token]) {
        map[token] = id;
      }
    }
    return map;
  }, [characterCatalogMetaById, characterMetaById]);

  const equipmentCompTokenById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, meta] of Object.entries(itemMetaById)) {
      if (meta.type !== 'equipment') continue;
      const token = normalizeEliyaCompToken(getStringValue(meta.devName));
      if (!token) continue;
      map[id] = token;
    }
    return map;
  }, [itemMetaById]);

  const equipmentIdByCompToken = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, meta] of Object.entries(itemMetaById)) {
      if (meta.type !== 'equipment') continue;
      const token = normalizeEliyaCompToken(getStringValue(meta.devName));
      if (token && !map[token]) {
        map[token] = id;
      }
    }
    return map;
  }, [itemMetaById]);

  const equipmentBorderToneById = useMemo(() => {
    const tones: Record<string, EquipmentBorderTone> = {};
    for (const id of allEquipmentIds) {
      const equipment = equipmentById[id];
      if (!equipment) {
        tones[id] = 'default';
        continue;
      }
      const levelPoint = getEquipmentLevelPointFromSaveLevel(getNumberValue(equipment.level, EQUIPMENT_SAVE_LEVEL_MIN));
      const isLevelMaxed = levelPoint >= EQUIPMENT_LEVEL_POINT_MAX;
      const enhancementOptions = equipmentEnhancementOptionsById[id] ?? [];
      const enhanceable = enhancementOptions.length > 0;
      const enhancementStatus = getNumberValue(equipment.enhancement_level, 0);
      const enhancementActive = enhanceable && enhancementStatus > 0;
      if (isLevelMaxed && enhancementActive) tones[id] = 'gold';
      else if (enhancementActive && !isLevelMaxed) tones[id] = 'red';
      else if (isLevelMaxed) tones[id] = 'blue';
      else tones[id] = 'default';
    }
    return tones;
  }, [allEquipmentIds, equipmentById, equipmentEnhancementOptionsById]);

  const searchedEquipmentIds = useMemo(() => {
    const query = equipmentSearch.trim().toLowerCase();
    if (!query) return allEquipmentIds;
    return allEquipmentIds.filter((id) => {
      if (id.toLowerCase().includes(query)) return true;
      const name = getStringValue(itemMetaById[id]?.name).toLowerCase();
      return name.includes(query);
    });
  }, [allEquipmentIds, equipmentSearch, itemMetaById]);

  const ownershipFilteredEquipmentIds = useMemo(() => {
    if (equipmentOwnedFilter === 'all') return searchedEquipmentIds;
    const wantsOwned = equipmentOwnedFilter === 'owned';
    return searchedEquipmentIds.filter((id) => ownedEquipmentIds.has(id) === wantsOwned);
  }, [equipmentOwnedFilter, ownedEquipmentIds, searchedEquipmentIds]);

  const protectionFilteredEquipmentIds = useMemo(() => {
    if (equipmentProtectionFilter === 'all') return ownershipFilteredEquipmentIds;
    const wantsProtected = equipmentProtectionFilter === 'protected';
    return ownershipFilteredEquipmentIds.filter((id) => {
      const equipment = equipmentById[id];
      const isProtected = Boolean(equipment?.protection);
      return isProtected === wantsProtected;
    });
  }, [equipmentById, equipmentProtectionFilter, ownershipFilteredEquipmentIds]);

  const filteredEquipmentIds = useMemo(() => {
    if (equipmentBorderFilter === 'all') return protectionFilteredEquipmentIds;
    return protectionFilteredEquipmentIds.filter((id) => equipmentBorderToneById[id] === equipmentBorderFilter);
  }, [equipmentBorderFilter, equipmentBorderToneById, protectionFilteredEquipmentIds]);

  const equipmentTotalPages = Math.max(1, Math.ceil(filteredEquipmentIds.length / EQUIPMENT_PAGE_SIZE));
  const visibleEquipmentIds = useMemo(() => {
    const start = (equipmentPage - 1) * EQUIPMENT_PAGE_SIZE;
    return filteredEquipmentIds.slice(start, start + EQUIPMENT_PAGE_SIZE);
  }, [equipmentPage, filteredEquipmentIds]);

  const visibleOwnedEquipmentIds = useMemo(() => {
    return visibleEquipmentIds.filter((id) => ownedEquipmentIds.has(id));
  }, [ownedEquipmentIds, visibleEquipmentIds]);

  const equipmentContextMenuEntry = useMemo(() => {
    const id = equipmentContextMenu.equipmentId;
    if (!id) return null;
    const equipment = equipmentById[id];
    const owned = ownedEquipmentIds.has(id);
    const enhancementOptions = equipmentEnhancementOptionsById[id] ?? [];
    const enhancementStatus = equipment ? getNumberValue(equipment.enhancement_level, 0) : 0;
    const enhancementSelectableValues = (() => {
      if (enhancementOptions.length === 0) return [0];
      const next = [0, ...enhancementOptions];
      if (enhancementStatus > 0 && !next.includes(enhancementStatus)) {
        next.push(enhancementStatus);
      }
      return Array.from(new Set(next)).sort((left, right) => left - right);
    })();

    return {
      id,
      name: itemMetaById[id]?.name || `Equipment ${id}`,
      owned,
      tone: equipmentBorderToneById[id] ?? 'default',
      levelPoint: equipment
        ? getEquipmentLevelPointFromSaveLevel(getNumberValue(equipment.level, EQUIPMENT_SAVE_LEVEL_MIN))
        : 0,
      protected: Boolean(equipment?.protection),
      enhanceable: enhancementOptions.length > 0,
      enhancementStatus,
      enhancementSelectableValues,
    };
  }, [
    equipmentBorderToneById,
    equipmentById,
    equipmentContextMenu.equipmentId,
    equipmentEnhancementOptionsById,
    itemMetaById,
    ownedEquipmentIds,
  ]);

  const equipmentContextMenuPosition = useMemo(() => {
    const menuWidth = 288;
    const menuHeight = 520;
    const margin = 8;
    if (typeof window === 'undefined') {
      return { left: equipmentContextMenu.x, top: equipmentContextMenu.y };
    }
    const left = Math.max(margin, Math.min(equipmentContextMenu.x, window.innerWidth - menuWidth - margin));
    const top = Math.max(margin, Math.min(equipmentContextMenu.y, window.innerHeight - menuHeight - margin));
    return { left, top };
  }, [equipmentContextMenu.x, equipmentContextMenu.y]);

  const selectedEquipment = useMemo(() => {
    if (!selectedEquipmentId) return null;
    return equipmentById[selectedEquipmentId] ?? null;
  }, [equipmentById, selectedEquipmentId]);

  const selectedEquipmentLevel = useMemo(() => {
    return getNumberValue(selectedEquipment?.level, 1);
  }, [selectedEquipment]);

  const selectedEquipmentLevelPoint = useMemo(() => {
    return getEquipmentLevelPointFromSaveLevel(selectedEquipmentLevel);
  }, [selectedEquipmentLevel]);

  const selectedEquipmentEnhancement = useMemo(() => {
    return getNumberValue(selectedEquipment?.enhancement_level, 0);
  }, [selectedEquipment]);

  const selectedEquipmentEnhancementOptions = useMemo(() => {
    if (!selectedEquipmentId) return [] as number[];
    const options = equipmentEnhancementOptionsById[selectedEquipmentId] ?? [];
    if (selectedEquipmentEnhancement > 0 && !options.includes(selectedEquipmentEnhancement)) {
      return [...options, selectedEquipmentEnhancement].sort((a, b) => a - b);
    }
    return options;
  }, [equipmentEnhancementOptionsById, selectedEquipmentEnhancement, selectedEquipmentId]);

  const selectedEquipmentEnhanceable = selectedEquipmentEnhancementOptions.length > 0;

  const selectedEquipmentEnhancementSelectableValues = useMemo(() => {
    if (!selectedEquipmentEnhanceable) return [0];
    return [0, ...selectedEquipmentEnhancementOptions];
  }, [selectedEquipmentEnhanceable, selectedEquipmentEnhancementOptions]);

  const selectedEquipmentEnhancementSliderIndex = useMemo(() => {
    return Math.max(0, selectedEquipmentEnhancementSelectableValues.indexOf(selectedEquipmentEnhancement));
  }, [selectedEquipmentEnhancement, selectedEquipmentEnhancementSelectableValues]);

  const partyEntries = useMemo(() => {
    if (!saveDocument || !isObject(saveDocument.data.user_party_group_list)) return [] as PartyEntry[];
    const entries: PartyEntry[] = [];

    for (const [groupId, groupValue] of Object.entries(saveDocument.data.user_party_group_list)) {
      if (!isObject(groupValue)) continue;
      const list = isObject(groupValue.list) ? (groupValue.list as Record<string, unknown>) : {};
      for (const [slotId, slotValue] of Object.entries(list)) {
        if (!isObject(slotValue)) continue;
        entries.push({ groupId, slotId, value: slotValue });
      }
    }

    return entries.sort((a, b) => {
      const groupDiff = getNumberValue(a.groupId, 0) - getNumberValue(b.groupId, 0);
      if (groupDiff !== 0) return groupDiff;
      return getNumberValue(a.slotId, 0) - getNumberValue(b.slotId, 0);
    });
  }, [saveDocument]);

  const filteredPartyEntries = useMemo(() => {
    const query = partySearch.trim().toLowerCase();
    if (!query) return partyEntries;
    return partyEntries.filter((entry) => {
      if (entry.groupId.toLowerCase().includes(query)) return true;
      if (entry.slotId.toLowerCase().includes(query)) return true;
      const name = getStringValue(entry.value.name).toLowerCase();
      if (name.includes(query)) return true;
      const chars = normalizeTripleArray(entry.value.character_ids).join(',');
      return chars.includes(query);
    });
  }, [partyEntries, partySearch]);

  const partyTotalPages = Math.max(1, Math.ceil(filteredPartyEntries.length / PARTY_PAGE_SIZE));
  const visiblePartyEntries = useMemo(() => {
    const start = (partyPage - 1) * PARTY_PAGE_SIZE;
    return filteredPartyEntries.slice(start, start + PARTY_PAGE_SIZE);
  }, [filteredPartyEntries, partyPage]);

  const partyPickerCurrentValue = useMemo(() => {
    if (!partyPicker || !saveDocument) return 0;
    const groups = isObject(saveDocument.data.user_party_group_list)
      ? (saveDocument.data.user_party_group_list as Record<string, unknown>)
      : {};
    const groupValue = groups[partyPicker.groupId];
    const group = isObject(groupValue) ? groupValue : null;
    const list = group && isObject(group.list) ? (group.list as Record<string, unknown>) : {};
    const slotValue = list[partyPicker.slotId];
    const slot = isObject(slotValue) ? slotValue : null;
    if (!slot) return 0;
    const values = Array.isArray(slot[partyPicker.field]) ? (slot[partyPicker.field] as unknown[]) : [0, 0, 0];
    return getNumberValue(values[partyPicker.slotIndex], 0);
  }, [partyPicker, saveDocument]);

  const partyPickerCharacterSearchIndex = useMemo(() => {
    return allCharacterIds.map((id) => {
      const meta = characterMetaById[id];
      const haystack = [id, meta?.nameEN, meta?.nameJP, meta?.faceCode].filter(Boolean).join(' ').toLowerCase();
      return { id, haystack };
    });
  }, [allCharacterIds, characterMetaById]);

  const partyPickerEquipmentSearchIndex = useMemo(() => {
    return allEquipmentIds.map((id) => {
      const name = getStringValue(itemMetaById[id]?.name);
      return { id, haystack: `${id} ${name}`.toLowerCase() };
    });
  }, [allEquipmentIds, itemMetaById]);

  const partyPickerQuery = useMemo(() => partyPickerSearch.trim().toLowerCase(), [partyPickerSearch]);

  const partyPickerCharacterIds = useMemo(() => {
    if (partyPicker?.kind !== 'character') return [] as string[];
    if (!partyPickerQuery) return allCharacterIds;
    return partyPickerCharacterSearchIndex
      .filter((entry) => entry.haystack.includes(partyPickerQuery))
      .map((entry) => entry.id);
  }, [allCharacterIds, partyPicker?.kind, partyPickerCharacterSearchIndex, partyPickerQuery]);

  const partyPickerEquipmentIds = useMemo(() => {
    if (partyPicker?.kind !== 'equipment') return [] as string[];
    if (!partyPickerQuery) return allEquipmentIds;
    return partyPickerEquipmentSearchIndex
      .filter((entry) => entry.haystack.includes(partyPickerQuery))
      .map((entry) => entry.id);
  }, [allEquipmentIds, partyPicker?.kind, partyPickerEquipmentSearchIndex, partyPickerQuery]);

  const partyPickerResultIds = useMemo(() => {
    if (!partyPicker) return [] as string[];
    return partyPicker.kind === 'character' ? partyPickerCharacterIds : partyPickerEquipmentIds;
  }, [partyPicker, partyPickerCharacterIds, partyPickerEquipmentIds]);

  useEffect(() => {
    if (!partyPicker) return;
    if (partyPickerRenderCount >= partyPickerResultIds.length) return;
    const timer = window.setTimeout(() => {
      setPartyPickerRenderCount((current) =>
        Math.min(current + PARTY_PICKER_RENDER_BATCH_SIZE, partyPickerResultIds.length)
      );
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [partyPicker, partyPickerRenderCount, partyPickerResultIds.length]);

  const partyPickerVisibleIds = useMemo(() => {
    const visible = partyPickerResultIds.slice(0, partyPickerRenderCount);
    if (partyPickerCurrentValue <= 0) return visible;
    const selectedId = String(partyPickerCurrentValue);
    if (visible.includes(selectedId)) return visible;
    if (!partyPickerResultIds.includes(selectedId)) return visible;
    return [...visible, selectedId];
  }, [partyPickerCurrentValue, partyPickerRenderCount, partyPickerResultIds]);

  const partyPickerRenderPending = partyPickerVisibleIds.length < partyPickerResultIds.length;

  const storyEntries = useMemo(() => {
    if (!saveDocument || !isObject(saveDocument.data.quest_progress)) return [] as StoryEntry[];
    const results: StoryEntry[] = [];

    for (const [chapterId, chapterValue] of Object.entries(saveDocument.data.quest_progress)) {
      if (!Array.isArray(chapterValue)) continue;
      chapterValue.forEach((entry, index) => {
        if (!isObject(entry)) return;
        const questIdValue = entry.quest_id;
        const questId = getStringValue(questIdValue);
        if (!questId) return;
        results.push({
          chapterId,
          index,
          questId,
          finished: Boolean(entry.finished),
          clearRank: getNumberValue(entry.clear_rank, 0),
          highScore: getStringValue(entry.high_score),
        });
      });
    }

    return results.sort((a, b) => getNumberValue(a.questId, 0) - getNumberValue(b.questId, 0));
  }, [saveDocument]);

  const storyDisplayEntries = useMemo(() => {
    return storyEntries.map((entry) => {
      const categoryName = storyQuestCategoryNameById[entry.chapterId] ?? '';
      const mappedSourceKey = categoryName ? QUEST_CATEGORY_TO_SOURCE_KEY[categoryName] : undefined;
      const mappedMeta = mappedSourceKey ? storyQuestMetaBySourceKey[mappedSourceKey]?.[entry.questId] : undefined;
      const fallbackMeta = storyQuestMetaFallbackByQuestId[entry.questId];
      const meta = mappedMeta ?? fallbackMeta ?? null;
      const categoryLabel = formatQuestCategoryLabel(categoryName) || meta?.categoryLabel || `Category ${entry.chapterId}`;
      return {
        ...entry,
        meta,
        categoryName,
        categoryLabel,
      } as StoryDisplayEntry;
    });
  }, [storyEntries, storyQuestCategoryNameById, storyQuestMetaBySourceKey, storyQuestMetaFallbackByQuestId]);

  const storySeedQuestIdsByChapterId = useMemo(() => {
    const next: Record<string, string[]> = {};
    for (const [chapterId, categoryName] of Object.entries(storyQuestCategoryNameById)) {
      const sourceKey = QUEST_CATEGORY_TO_SOURCE_KEY[categoryName];
      if (!sourceKey) continue;
      const sourceMap = storyQuestMetaBySourceKey[sourceKey];
      if (!sourceMap) continue;
      const questIds = Object.keys(sourceMap).sort((left, right) => getNumberValue(left, 0) - getNumberValue(right, 0));
      if (questIds.length > 0) {
        next[chapterId] = questIds;
      }
    }
    return next;
  }, [storyQuestCategoryNameById, storyQuestMetaBySourceKey]);

  const storySeedQuestCount = useMemo(() => {
    return Object.values(storySeedQuestIdsByChapterId).reduce((sum, ids) => sum + ids.length, 0);
  }, [storySeedQuestIdsByChapterId]);

  const storySourceFilterOptions = useMemo(() => {
    const sourceKeys = new Set<StoryQuestSourceKey>();
    for (const entry of storyDisplayEntries) {
      if (entry.meta) {
        sourceKeys.add(entry.meta.sourceKey);
      }
    }
    return Array.from(sourceKeys).sort((left, right) => {
      return getStorySourceLabel(left).localeCompare(getStorySourceLabel(right));
    });
  }, [storyDisplayEntries]);

  const filteredStoryEntries = useMemo(() => {
    const query = storySearch.trim().toLowerCase();
    return storyDisplayEntries.filter((entry) => {
      if (storySourceFilter !== 'all' && entry.meta?.sourceKey !== storySourceFilter) return false;
      if (!query) return true;

      const searchBlob = [
        entry.questId,
        entry.chapterId,
        entry.categoryName,
        entry.categoryLabel,
        entry.meta?.title,
        entry.meta?.sourceLabel,
        entry.meta?.chapterLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchBlob.includes(query);
    });
  }, [storyDisplayEntries, storySearch, storySourceFilter]);

  const storyTotalPages = Math.max(1, Math.ceil(filteredStoryEntries.length / STORY_PAGE_SIZE));
  const visibleStoryEntries = useMemo(() => {
    const start = (storyPage - 1) * STORY_PAGE_SIZE;
    return filteredStoryEntries.slice(start, start + STORY_PAGE_SIZE);
  }, [filteredStoryEntries, storyPage]);

  const rawSelectionStart = Math.max(0, Math.min(rawSelectionRange.start, rawText.length));
  const rawSelectionEnd = Math.max(0, Math.min(rawSelectionRange.end, rawText.length));
  const rawSelectionMin = Math.min(rawSelectionStart, rawSelectionEnd);
  const rawSelectionMax = Math.max(rawSelectionStart, rawSelectionEnd);
  const rawSelectedText = useMemo(() => rawText.slice(rawSelectionMin, rawSelectionMax), [rawSelectionMax, rawSelectionMin, rawText]);
  const rawCursorIndex = rawSelectionMin;
  const rawLineInfo = useMemo(() => getRawLineInfo(rawText, rawCursorIndex), [rawCursorIndex, rawText]);
  const rawCharacterIdSet = useMemo(() => new Set(allCharacterIds), [allCharacterIds]);
  const rawItemIdSet = useMemo(() => new Set(allItemIds), [allItemIds]);
  const rawEquipmentIdSet = useMemo(() => new Set(allEquipmentIds), [allEquipmentIds]);

  const resolveRawInspectorIdHit = useMemo(() => {
    return (rawId: string, path: string[]): RawInspectorHit | null => {
      const numericId = toNumeric(rawId, 0);
      if (numericId <= 0) return null;
      const id = String(numericId);
      const parent = path[path.length - 2] ?? '';
      const leaf = path[path.length - 1] ?? '';
      const pathJoined = path.join('.');

      const characterContext =
        leaf === 'leader_character_id' ||
        parent === 'character_ids' ||
        parent === 'unison_character_ids' ||
        parent === 'user_character_list' ||
        pathJoined.includes('user_character_list');
      const equipmentContext =
        parent === 'equipment_ids' ||
        parent === 'ability_soul_ids' ||
        parent === 'user_equipment_list' ||
        pathJoined.includes('user_equipment_list');
      const itemContext = parent === 'item_list' || pathJoined.includes('item_list');
      const questContext = leaf === 'quest_id' || pathJoined.includes('quest_progress');

      if (characterContext || rawCharacterIdSet.has(id) || Boolean(characterMetaById[id]) || Boolean(characterCatalogMetaById[id])) {
        const meta = characterMetaById[id];
        const catalog = characterCatalogMetaById[id];
        return {
          id,
          kind: 'character',
          label: catalog?.enName || meta?.nameEN || catalog?.jpName || meta?.nameJP || `Character ${id}`,
          subtitle: catalog?.devName || meta?.faceCode || `ID ${id}`,
        };
      }

      if (
        equipmentContext ||
        rawEquipmentIdSet.has(id) ||
        itemMetaById[id]?.type === 'equipment' ||
        Boolean(equipmentById[id])
      ) {
        const meta = itemMetaById[id];
        return {
          id,
          kind: 'equipment',
          label: meta?.name || `Equipment ${id}`,
          subtitle: meta?.devName || `ID ${id}`,
        };
      }

      if (itemContext || rawItemIdSet.has(id) || itemMetaById[id]?.type === 'item') {
        const meta = itemMetaById[id];
        return {
          id,
          kind: 'item',
          label: meta?.name || `Item ${id}`,
          subtitle: meta?.devName || `ID ${id}`,
        };
      }

      if (questContext || Boolean(storyQuestMetaFallbackByQuestId[id])) {
        const questMeta = storyQuestMetaFallbackByQuestId[id];
        return {
          id,
          kind: 'quest',
          label: questMeta?.title || `Quest ${id}`,
          subtitle: questMeta?.sourceLabel || `ID ${id}`,
        };
      }

      if (characterContext || equipmentContext || itemContext || questContext) {
        return { id, kind: 'unknown', label: `ID ${id}`, subtitle: 'No metadata match' };
      }

      return null;
    };
  }, [
    characterCatalogMetaById,
    characterMetaById,
    equipmentById,
    itemMetaById,
    rawCharacterIdSet,
    rawEquipmentIdSet,
    rawItemIdSet,
    storyQuestMetaFallbackByQuestId,
  ]);

  const rawJsonNodeIndex = useMemo(() => {
    if (!rawParsedState.isValid) return null;
    if (rawText.length > RAW_JSON_INSPECT_MAX_SIZE) return null;
    return buildRawJsonNodeIndex(rawText);
  }, [rawParsedState.isValid, rawText]);

  const rawInspectorNode = useMemo(() => {
    if (!rawJsonNodeIndex || rawJsonNodeIndex.length === 0) return null;
    let best: RawJsonNode | null = null;
    for (const node of rawJsonNodeIndex) {
      if (node.start > rawCursorIndex) break;
      if (node.start <= rawCursorIndex && rawCursorIndex < node.end) {
        if (!best) {
          best = node;
          continue;
        }
        const bestSpan = best.end - best.start;
        const nodeSpan = node.end - node.start;
        if (node.path.length > best.path.length || (node.path.length === best.path.length && nodeSpan <= bestSpan)) {
          best = node;
        }
      }
    }
    return best;
  }, [rawCursorIndex, rawJsonNodeIndex]);

  const rawInspectorPath = useMemo(() => rawInspectorNode?.path ?? [], [rawInspectorNode]);
  const rawInspectorPathText = useMemo(() => formatJsonPath(rawInspectorPath), [rawInspectorPath]);
  const rawInspectorToken = useMemo(
    () => extractNumericTokenNearCursor(rawText, rawSelectionMin, rawSelectionMax),
    [rawSelectionMax, rawSelectionMin, rawText]
  );
  const rawInspectorPrimaryHit = useMemo(() => {
    if (!rawInspectorToken) return null;
    return resolveRawInspectorIdHit(rawInspectorToken, rawInspectorPath);
  }, [rawInspectorPath, rawInspectorToken, resolveRawInspectorIdHit]);

  const rawInspectorPrimaryThumb = useMemo(() => {
    if (!rawInspectorPrimaryHit || rawInspectorPrimaryHit.kind === 'unknown') {
      return { urls: [] as string[], pixelated: false };
    }

    if (rawInspectorPrimaryHit.kind === 'character') {
      const faceCode =
        getStringValue(characterMetaById[rawInspectorPrimaryHit.id]?.faceCode) ||
        getStringValue(characterCatalogMetaById[rawInspectorPrimaryHit.id]?.devName);
      return {
        urls: buildCharacterThumbUrls(faceCode),
        pixelated: false,
      };
    }

    if (rawInspectorPrimaryHit.kind === 'quest') {
      const questMeta = storyQuestMetaFallbackByQuestId[rawInspectorPrimaryHit.id];
      return {
        urls: buildStoryThumbUrls(rawInspectorPrimaryHit.id, questMeta?.thumbnail ?? ''),
        pixelated: false,
      };
    }

    const itemMeta = itemMetaById[rawInspectorPrimaryHit.id];
    return {
      urls: [toCdnUrl(itemMeta?.thumbnail || ''), toCdnUrl(itemMeta?.icon || '')].filter(Boolean),
      pixelated: true,
    };
  }, [characterCatalogMetaById, characterMetaById, itemMetaById, rawInspectorPrimaryHit, storyQuestMetaFallbackByQuestId]);

  const rawHighlightScope = useMemo(() => {
    if (rawSelectedText && rawSelectedText.length <= 1200) {
      return { label: 'Selection', text: rawSelectedText };
    }
    return { label: 'Current Line', text: rawLineInfo.lineText };
  }, [rawLineInfo.lineText, rawSelectedText]);

  const rawHighlightMatches = useMemo(() => {
    const matches: RawHighlightMatch[] = [];
    const seen = new Set<string>();
    const scopeText = rawHighlightScope.text;
    if (!scopeText) return matches;
    const regex = /\b\d{1,12}\b/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(scopeText)) !== null) {
      if (matches.length >= RAW_JSON_HIGHLIGHT_MAX_MATCHES) break;
      const token = match[0];
      const key = `${match.index}:${token}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const hit = resolveRawInspectorIdHit(token, rawInspectorPath);
      if (!hit) continue;
      matches.push({
        start: match.index,
        end: match.index + token.length,
        id: token,
        hit,
      });
    }
    return matches;
  }, [rawHighlightScope.text, rawInspectorPath, resolveRawInspectorIdHit]);

  const rawHighlightSegments = useMemo(
    () => splitHighlightedText(rawHighlightScope.text, rawHighlightMatches),
    [rawHighlightMatches, rawHighlightScope.text]
  );

  const rawHighlightHits = useMemo(() => {
    const deduped = new Map<string, RawInspectorHit>();
    for (const match of rawHighlightMatches) {
      const key = `${match.hit.kind}:${match.hit.id}`;
      if (!deduped.has(key)) {
        deduped.set(key, match.hit);
      }
    }
    return Array.from(deduped.values());
  }, [rawHighlightMatches]);

  useEffect(() => setCharacterPage(1), [characterBorderFilter, characterMb2Filter, characterSearch]);
  useEffect(() => setItemPage(1), [itemOwnedFilter, itemSearch]);
  useEffect(
    () => setEquipmentPage(1),
    [equipmentBorderFilter, equipmentOwnedFilter, equipmentProtectionFilter, equipmentSearch]
  );
  useEffect(() => setPartyPage(1), [partySearch]);
  useEffect(() => setStoryPage(1), [storySearch, storySourceFilter]);
  useEffect(() => {
    if (storySourceFilter === 'all') return;
    if (storySourceFilterOptions.includes(storySourceFilter)) return;
    setStorySourceFilter('all');
  }, [storySourceFilter, storySourceFilterOptions]);
  useEffect(() => {
    if (!selectedCharacterId) return;
    if (characterModalTab === 'nodes') return;
    setCharacterNodeDraft(selectedCharacterNodeIds.join(', '));
  }, [characterModalTab, selectedCharacterId, selectedCharacterNodeIds]);

  useEffect(() => {
    if (characterPage > characterTotalPages) setCharacterPage(characterTotalPages);
  }, [characterPage, characterTotalPages]);

  useEffect(() => {
    if (itemPage > itemTotalPages) setItemPage(itemTotalPages);
  }, [itemPage, itemTotalPages]);

  useEffect(() => {
    if (equipmentPage > equipmentTotalPages) setEquipmentPage(equipmentTotalPages);
  }, [equipmentPage, equipmentTotalPages]);

  useEffect(() => {
    if (partyPage > partyTotalPages) setPartyPage(partyTotalPages);
  }, [partyPage, partyTotalPages]);

  useEffect(() => {
    if (storyPage > storyTotalPages) setStoryPage(storyTotalPages);
  }, [storyPage, storyTotalPages]);

  useEffect(() => {
    if (!characterContextMenu.characterId) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (characterContextMenuRef.current?.contains(target)) return;
      setCharacterContextMenu((current) => ({ ...current, characterId: null }));
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setCharacterContextMenu((current) => ({ ...current, characterId: null }));
    };

    const closeMenu = () => {
      setCharacterContextMenu((current) => ({ ...current, characterId: null }));
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [characterContextMenu.characterId]);

  useEffect(() => {
    if (!itemContextMenu.itemId) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (itemContextMenuRef.current?.contains(target)) return;
      setItemContextMenu((current) => ({ ...current, itemId: null }));
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setItemContextMenu((current) => ({ ...current, itemId: null }));
    };

    const closeMenu = () => {
      setItemContextMenu((current) => ({ ...current, itemId: null }));
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [itemContextMenu.itemId]);

  useEffect(() => {
    if (!equipmentContextMenu.equipmentId) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (equipmentContextMenuRef.current?.contains(target)) return;
      setEquipmentContextMenu((current) => ({ ...current, equipmentId: null }));
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setEquipmentContextMenu((current) => ({ ...current, equipmentId: null }));
    };

    const closeMenu = () => {
      setEquipmentContextMenu((current) => ({ ...current, equipmentId: null }));
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [equipmentContextMenu.equipmentId]);

  const applySaveMutation = (mutator: (draft: SaveDocument) => void) => {
    setSaveDocument((current) => {
      if (!current) return current;
      const next = cloneJson(current);
      mutator(next);
      return next;
    });
    setRawDirty(false);
  };

  const loadJsonText = (raw: string, source: string, suggestedFileName?: string) => {
    const parsed = parseJson(raw);
    if (!parsed.ok) {
      setNotice({ type: 'error', message: `Could not parse JSON: ${parsed.error}` });
      return;
    }

    const normalized = normalizeSaveInput(parsed.value);
    if (!normalized.ok) {
      setNotice({ type: 'error', message: normalized.error });
      return;
    }

    setSaveDocument(normalized.value);
    setRawDirty(false);
    setSourceLabel(source);
    setOutputFileName(suggestedFileName ?? outputFileName);
    setNotice({
      type: 'success',
      message: normalized.wrappedDataObject
        ? `Loaded ${source}. Data object was wrapped into a save container.`
        : `Loaded ${source}.`,
    });
  };

  const loadTemplate = async (template: TemplateKind) => {
    setLoadingTemplate(template);
    setNotice(null);

    try {
      const config = TEMPLATE_CONFIG[template];
      const response = await fetchFirstAvailable(getDataFallbackUrls(config.path), { cache: 'no-store' });
      if (!response) {
        throw new Error('Template request failed (404).');
      }
      const text = await response.text();
      loadJsonText(text, config.label, config.fileName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load template.';
      setNotice({ type: 'error', message });
    } finally {
      setLoadingTemplate(null);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      loadJsonText(text, `Uploaded file (${file.name})`, file.name);
    } catch {
      setNotice({ type: 'error', message: 'Could not read uploaded file.' });
    } finally {
      event.target.value = '';
    }
  };

  const downloadSave = () => {
    if (!saveDocument) {
      setNotice({ type: 'error', message: 'No save loaded.' });
      return;
    }

    const pretty = JSON.stringify(saveDocument, null, 2);
    const blob = new Blob([pretty], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeFileName(outputFileName);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice({ type: 'success', message: `Downloaded ${safeFileName(outputFileName)}.` });
  };

  const handleGeneralFieldChange = (field: GeneralField, value: string) => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const info = getOrCreateObject(data, 'user_info');
      info[field.key] = field.kind === 'number' ? toNumeric(value, 0) : value;
    });
  };

  const applyResourcePreset = () => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const info = getOrCreateObject(data, 'user_info');
      info.free_vmoney = 999999;
      info.free_mana = 999999999;
      info.star_crumb = 99999;
      info.bond_token = 99999;
      info.stamina = 999;
      info.boost_point = 99;
      info.boss_boost_point = 99;
    });
    setNotice({ type: 'info', message: 'Applied high resource preset.' });
  };

  const handleCharacterFieldChange = (characterId: string, field: string, value: string) => {
    let removedNodeCount = 0;
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      const character = getOrCreateObject(characterList, characterId);
      const numericValue = Math.floor(toNumeric(value, 0));

      if (field === 'over_limit_step') {
        const clampedStep = Math.max(0, numericValue);
        const rarity = getNumberValue(characterMetaById[characterId]?.rarity, 5);
        const levelStop = getLevelStopFromOverLimitStep(clampedStep);
        const mappedExp = getCharacterExpForLevelStop(rarity, levelStop);
        character.over_limit_step = clampedStep;
        character.exp = clampedStep >= 5 ? Math.max(getNumberValue(character.exp, 0), mappedExp) : mappedExp;
        removedNodeCount = enforceCharacterNodesForProgression(draft, characterId);
        return;
      }

      if (field === 'exp') {
        const clampedExp = Math.max(0, numericValue);
        const rarity = getNumberValue(characterMetaById[characterId]?.rarity, 5);
        const levelStop = getLevelStopFromExp(clampedExp, rarity);
        character.exp = clampedExp;
        character.over_limit_step = LEVEL_STOP_TO_OVER_LIMIT[levelStop];
        removedNodeCount = enforceCharacterNodesForProgression(draft, characterId);
        return;
      }

      character[field] = numericValue;
    });
    if (removedNodeCount > 0 && selectedCharacterId === characterId) {
      setNotice({
        type: 'info',
        message: `Removed ${removedNodeCount} mana nodes that require a higher level.`,
      });
    }
  };

  const handleCharacterLevelStopChange = (characterId: string, levelStop: CharacterLevelStop) => {
    let removedNodeCount = 0;
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      const character = getOrCreateObject(characterList, characterId);
      const rarity = getNumberValue(characterMetaById[characterId]?.rarity, 5);
      character.exp = getCharacterExpForLevelStop(rarity, levelStop);
      character.over_limit_step = LEVEL_STOP_TO_OVER_LIMIT[levelStop];
      removedNodeCount = enforceCharacterNodesForProgression(draft, characterId);
    });
    if (removedNodeCount > 0 && selectedCharacterId === characterId) {
      setNotice({
        type: 'info',
        message: `Removed ${removedNodeCount} mana nodes that require a higher level.`,
      });
    }
  };

  const ensureCharacterExBoost = (character: JsonObject): JsonObject => {
    const exBoost = isObject(character.ex_boost) ? (character.ex_boost as JsonObject) : ({} as JsonObject);
    const rawAbilityList = Array.isArray(exBoost.ability_id_list) ? exBoost.ability_id_list : [];
    const ability1 = Math.max(1, getNumberValue(rawAbilityList[0], exBoostDefaultAbilityIds[0]));
    const ability2 = Math.max(1, getNumberValue(rawAbilityList[1], exBoostDefaultAbilityIds[1]));
    exBoost.status_id = Math.max(1, getNumberValue(exBoost.status_id, exBoostDefaultStatusId));
    exBoost.ability_id_list = [ability1, ability2];
    character.ex_boost = exBoost;
    return exBoost;
  };

  const handleCharacterExBoostEnabledChange = (characterId: string, enabled: boolean) => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      const character = isObject(characterList[characterId]) ? (characterList[characterId] as JsonObject) : null;
      if (!character) return;
      if (!enabled) {
        delete character.ex_boost;
        return;
      }
      ensureCharacterExBoost(character);
    });
  };

  const handleCharacterExBoostStatusChange = (characterId: string, value: string) => {
    const statusId = Math.max(1, Math.floor(toNumeric(value, exBoostDefaultStatusId)));
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      const character = isObject(characterList[characterId]) ? (characterList[characterId] as JsonObject) : null;
      if (!character) return;
      const exBoost = ensureCharacterExBoost(character);
      exBoost.status_id = statusId;
    });
  };

  const handleCharacterExBoostStatusRarityChange = (characterId: string, rarity: ExBoostRarity) => {
    const nextStatusId =
      exBoostStatusOptions.find((entry) => entry.rarity === rarity)?.id ??
      exBoostStatusOptions[0]?.id ??
      exBoostDefaultStatusId;
    handleCharacterExBoostStatusChange(characterId, String(nextStatusId));
  };

  const handleCharacterExBoostAbilityChange = (characterId: string, slotIndex: 0 | 1, value: string) => {
    const abilityId = Math.max(1, Math.floor(toNumeric(value, exBoostDefaultAbilityIds[slotIndex])));
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      const character = isObject(characterList[characterId]) ? (characterList[characterId] as JsonObject) : null;
      if (!character) return;
      const exBoost = ensureCharacterExBoost(character);
      const rawAbilityList = Array.isArray(exBoost.ability_id_list) ? exBoost.ability_id_list : [];
      const nextAbilityList: [number, number] = [
        Math.max(1, getNumberValue(rawAbilityList[0], exBoostDefaultAbilityIds[0])),
        Math.max(1, getNumberValue(rawAbilityList[1], exBoostDefaultAbilityIds[1])),
      ];
      nextAbilityList[slotIndex] = abilityId;
      exBoost.ability_id_list = nextAbilityList;
    });
  };

  const handleCharacterExBoostAbilityRarityChange = (
    characterId: string,
    slotIndex: 0 | 1,
    rarity: ExBoostRarity
  ) => {
    const slot: ExBoostSlotKey = slotIndex === 0 ? 'slot_a' : 'slot_b';
    const fallbackId = exBoostDefaultAbilityIds[slotIndex];
    const nextAbilityId =
      exBoostAbilityOptions.find((entry) => entry.slot === slot && entry.rarity === rarity)?.id ??
      exBoostAbilityOptions.find((entry) => entry.slot === slot)?.id ??
      fallbackId;
    handleCharacterExBoostAbilityChange(characterId, slotIndex, String(nextAbilityId));
  };

  const randomizeCharacterExBoost = (characterId: string) => {
    const randomStatus = getRandomArrayItem(exBoostStatusOptions);
    const randomSlotA = getRandomArrayItem(exBoostAbilityOptions.filter((entry) => entry.slot === 'slot_a'));
    const randomSlotB = getRandomArrayItem(exBoostAbilityOptions.filter((entry) => entry.slot === 'slot_b'));
    if (!randomStatus || !randomSlotA || !randomSlotB) {
      setNotice({ type: 'error', message: 'EX boost metadata is missing, so randomize is unavailable.' });
      return;
    }

    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      const character = isObject(characterList[characterId]) ? (characterList[characterId] as JsonObject) : null;
      if (!character) return;
      character.ex_boost = {
        status_id: randomStatus.id,
        ability_id_list: [randomSlotA.id, randomSlotB.id],
      };
    });
    setNotice({ type: 'success', message: `Randomized EX boost for character ${characterId}.` });
  };

  const getCharacterNodeValues = (characterId: string): number[] => {
    if (!saveDocument) return [];
    const manaList = isObject(saveDocument.data.user_character_mana_node_list)
      ? (saveDocument.data.user_character_mana_node_list as Record<string, unknown>)
      : {};
    const raw = manaList[characterId];
    if (!Array.isArray(raw)) return [];
    return raw.map((value) => getNumberValue(value, 0)).filter((value) => value > 0);
  };

  const getCharacterNodeString = (characterId: string): string => {
    return getCharacterNodeValues(characterId).join(', ');
  };

  const openCharacterEditor = (characterId: string) => {
    setSelectedCharacterId(characterId);
    setCharacterModalTab('progress');
    setCharacterNodeDraft(getCharacterNodeString(characterId));
  };

  const closeCharacterContextMenu = () => {
    setCharacterContextMenu((current) => {
      if (!current.characterId) return current;
      return { ...current, characterId: null };
    });
  };

  const openCharacterContextMenu = (event: React.MouseEvent<HTMLButtonElement>, characterId: string) => {
    event.preventDefault();
    setItemContextMenu((current) => (current.itemId ? { ...current, itemId: null } : current));
    setEquipmentContextMenu((current) => (current.equipmentId ? { ...current, equipmentId: null } : current));
    setCharacterContextMenu({ characterId, x: event.clientX, y: event.clientY });
  };

  const openCharacterPageByDevName = (devName: string) => {
    const trimmed = devName.trim();
    if (!trimmed) {
      setNotice({ type: 'error', message: 'Missing character dev name for route link.' });
      closeCharacterContextMenu();
      return;
    }

    if (typeof window !== 'undefined') {
      const href = `/characters/${encodeURIComponent(trimmed)}`;
      window.open(href, '_blank', 'noopener,noreferrer');
      setNotice({ type: 'info', message: `Opened ${href} in a new tab.` });
    }
    closeCharacterContextMenu();
  };

  const copyCharacterFieldToClipboard = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ type: 'success', message: `Copied ${label}: ${value}.` });
    } catch {
      setNotice({ type: 'error', message: `Could not copy ${label} to clipboard.` });
    } finally {
      closeCharacterContextMenu();
    }
  };

  const addCharacterById = (characterId: string) => {
    const id = characterId.trim();
    if (!id) return;

    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      const manaList = getOrCreateObject(data, 'user_character_mana_node_list');
      if (!isObject(characterList[id])) {
        characterList[id] = {
          entry_count: 1,
          evolution_level: 1,
          over_limit_step: 0,
          protection: false,
          join_time: Math.floor(Date.now() / 1000),
          update_time: Math.floor(Date.now() / 1000),
          exp: 0,
          stack: 0,
          bond_token_list: [
            { mana_board_index: 1, status: 0 },
            { mana_board_index: 2, status: 0 },
          ],
          mana_board_index: 1,
        };
      }
      if (!Array.isArray(manaList[id])) {
        manaList[id] = [];
      }
    });
  };

  const addCharacter = () => {
    const id = newCharacterId.trim();
    if (!id) return;

    addCharacterById(id);
    setNewCharacterId('');
    setNotice({ type: 'success', message: `Character ${id} added.` });
  };

  const removeCharacter = (characterId: string) => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      const manaList = getOrCreateObject(data, 'user_character_mana_node_list');
      delete characterList[characterId];
      delete manaList[characterId];
    });
  };

  const updateCharacterNodes = (characterId: string, value: string) => {
    const parsed = parseNumberList(value);
    let nextNodeDraft = parsed.join(', ');
    let removedNodeCount = 0;
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      const character = isObject(characterList[characterId]) ? (characterList[characterId] as JsonObject) : null;
      const manaList = getOrCreateObject(data, 'user_character_mana_node_list');
      if (!character) {
        manaList[characterId] = parsed;
        return;
      }
      const levelStop = getCharacterLevelStopFromEntry(characterId, character);
      const filtered = filterCharacterNodeIdsByProgression(characterId, parsed, levelStop);
      manaList[characterId] = filtered;
      removedNodeCount = Math.max(0, parsed.length - filtered.length);
      nextNodeDraft = filtered.join(', ');
    });
    setCharacterNodeDraft(nextNodeDraft);
    if (removedNodeCount > 0) {
      setNotice({
        type: 'info',
        message: `Updated mana nodes for character ${characterId}. ${removedNodeCount} node(s) were removed due to level requirements.`,
      });
      return;
    }
    setNotice({ type: 'info', message: `Updated mana nodes for character ${characterId}.` });
  };

  const setCharacterAbilityTrackLevel = (characterId: string, trackSlots: number[], targetLevel: number) => {
    const boardMeta = manaBoardMetaById[characterId] ?? { board1Nodes: 23, board2Nodes: 0, hasBoard2: false };
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      if (!isObject(characterList[characterId])) return;

      const manaList = getOrCreateObject(data, 'user_character_mana_node_list');
      const raw = Array.isArray(manaList[characterId]) ? (manaList[characterId] as unknown[]) : [];
      const nextSet = new Set(raw.map((value) => getNumberValue(value, 0)).filter((value) => value > 0));

      const availableNodeIds = trackSlots
        .filter((slot) => isManaNodeSlotAvailable(slot, boardMeta.board1Nodes, boardMeta.board2Nodes))
        .map((slot) => getManaNodeIdForSlot(characterId, slot))
        .filter((value): value is number => value !== null);

      for (const nodeId of availableNodeIds) nextSet.delete(nodeId);

      const clampedLevel = Math.max(-1, Math.min(targetLevel, availableNodeIds.length - 1));
      for (let index = 0; index <= clampedLevel; index += 1) {
        nextSet.add(availableNodeIds[index]);
      }

      manaList[characterId] = Array.from(nextSet).sort((a, b) => a - b);
      enforceCharacterNodesForProgression(draft, characterId);
    });
  };

  const setAllCharacterAbilityTracks = (characterId: string, mode: 'max' | 'clear') => {
    const boardMeta = manaBoardMetaById[characterId] ?? { board1Nodes: 23, board2Nodes: 0, hasBoard2: false };
    let removedNodeCount = 0;
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      if (!isObject(characterList[characterId])) return;

      const manaList = getOrCreateObject(data, 'user_character_mana_node_list');
      const raw = Array.isArray(manaList[characterId]) ? (manaList[characterId] as unknown[]) : [];
      const nextSet = new Set(raw.map((value) => getNumberValue(value, 0)).filter((value) => value > 0));

      for (const track of ABILITY_TRACKS) {
        const availableNodeIds = track.slots
          .filter((slot) => isManaNodeSlotAvailable(slot, boardMeta.board1Nodes, boardMeta.board2Nodes))
          .map((slot) => getManaNodeIdForSlot(characterId, slot))
          .filter((value): value is number => value !== null);

        for (const nodeId of availableNodeIds) nextSet.delete(nodeId);
        if (mode === 'max') {
          for (const nodeId of availableNodeIds) nextSet.add(nodeId);
        }
      }

      manaList[characterId] = Array.from(nextSet).sort((a, b) => a - b);
      removedNodeCount = enforceCharacterNodesForProgression(draft, characterId);
    });
    setCharacterNodeDraft(getCharacterNodeString(characterId));
    setNotice({
      type: 'info',
      message:
        mode === 'max'
          ? removedNodeCount > 0
            ? `Set ability tracks for character ${characterId}, but ${removedNodeCount} node(s) were removed due to level requirements.`
            : `Set ability tracks to max for character ${characterId}.`
          : `Cleared ability track nodes for character ${characterId}.`,
    });
  };

  const maxCharacterManaBoardById = (characterId: string) => {
    const boardMeta = manaBoardMetaById[characterId] ?? { board1Nodes: 23, board2Nodes: 0, hasBoard2: false };
    let removedNodeCount = 0;
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      if (!isObject(characterList[characterId])) return;

      const allNodeIds: number[] = [];
      for (let slotIndex = 0; slotIndex < 41; slotIndex += 1) {
        if (!isManaNodeSlotAvailable(slotIndex, boardMeta.board1Nodes, boardMeta.board2Nodes)) continue;
        const nodeId = getManaNodeIdForSlot(characterId, slotIndex);
        if (nodeId !== null) allNodeIds.push(nodeId);
      }

      const manaList = getOrCreateObject(data, 'user_character_mana_node_list');
      manaList[characterId] = allNodeIds;
      removedNodeCount = enforceCharacterNodesForProgression(draft, characterId);
    });
    setCharacterNodeDraft(getCharacterNodeString(characterId));
    setNotice({
      type: 'info',
      message:
        removedNodeCount > 0
          ? `Set mana board nodes for character ${characterId}, but ${removedNodeCount} node(s) were removed due to level requirements.`
          : `Set mana board nodes to max for character ${characterId}.`,
    });
  };

  const maxCharacterById = (characterId: string) => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      const character = getOrCreateObject(characterList, characterId);
      character.evolution_level = 1;
      character.over_limit_step = 6;
      character.mana_board_index = 2;
      character.exp = Math.max(getNumberValue(character.exp, 0), 999999);
    });
  };

  const applyCharacterContextBoardPreset = (characterId: string, mode: 'fresh' | 'blue' | 'red' | 'gold') => {
    const boardMeta = manaBoardMetaById[characterId] ?? { board1Nodes: 23, board2Nodes: 0, hasBoard2: false };
    let removedNodeCount = 0;
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      if (!isObject(characterList[characterId])) return;

      const manaList = getOrCreateObject(data, 'user_character_mana_node_list');
      const nextSet = new Set<number>();

      if (mode === 'gold') {
        for (let slot = 0; slot < 41; slot += 1) {
          if (!isManaNodeSlotAvailable(slot, boardMeta.board1Nodes, boardMeta.board2Nodes)) continue;
          const nodeId = getManaNodeIdForSlot(characterId, slot);
          if (nodeId !== null) nextSet.add(nodeId);
        }
      } else if (mode === 'blue' || mode === 'red') {
        for (const track of ABILITY_TRACKS) {
          const availableNodeIds = track.slots
            .filter((slot) => isManaNodeSlotAvailable(slot, boardMeta.board1Nodes, boardMeta.board2Nodes))
            .map((slot) => getManaNodeIdForSlot(characterId, slot))
            .filter((value): value is number => value !== null);

          if (CORE_ABILITY_KEYS.includes(track.key as (typeof CORE_ABILITY_KEYS)[number])) {
            for (const nodeId of availableNodeIds) nextSet.add(nodeId);
            continue;
          }

          if (
            mode === 'red' &&
            ADVANCED_ABILITY_KEYS.includes(track.key as (typeof ADVANCED_ABILITY_KEYS)[number]) &&
            availableNodeIds.length > 0
          ) {
            nextSet.add(availableNodeIds[0]);
          }
        }
      }

      manaList[characterId] = Array.from(nextSet).sort((left, right) => left - right);
      removedNodeCount = enforceCharacterNodesForProgression(draft, characterId);
    });

    setCharacterNodeDraft(getCharacterNodeString(characterId));
    const message =
      mode === 'fresh'
        ? `Cleared mana board nodes for character ${characterId}.`
        : mode === 'blue'
          ? removedNodeCount > 0
            ? `Set MB1 tracks for character ${characterId}; ${removedNodeCount} node(s) were removed due to level requirements.`
            : `Set MB1 ability tracks to max (MB1 Maxed) for character ${characterId}.`
          : mode === 'red'
            ? removedNodeCount > 0
              ? `Set MB2 In Progress for character ${characterId}; ${removedNodeCount} node(s) were removed due to level requirements.`
              : `Set MB2 In Progress for character ${characterId}.`
            : removedNodeCount > 0
              ? `Set Fully Maxed preset for character ${characterId}; ${removedNodeCount} node(s) were removed due to level requirements.`
              : `Set all mana board nodes to max (Fully Maxed) for character ${characterId}.`;
    setNotice({ type: 'info', message });
  };

  const applyCharacterContextQuickPreset = (characterId: string, mode: 'base' | 'max' | 'max_board') => {
    if (mode === 'base') {
      applySaveMutation((draft) => {
        const data = getOrCreateObject(draft, 'data');
        const characterList = getOrCreateObject(data, 'user_character_list');
        if (!isObject(characterList[characterId])) return;
        const character = getOrCreateObject(characterList, characterId);
        const rarity = getNumberValue(characterMetaById[characterId]?.rarity, 5);
        character.evolution_level = 1;
        character.over_limit_step = 0;
        character.mana_board_index = 1;
        character.exp = getCharacterExpForLevelStop(rarity, 80);
      });
      applyCharacterContextBoardPreset(characterId, 'fresh');
      setNotice({ type: 'info', message: `Character ${characterId} reset to base progression.` });
      closeCharacterContextMenu();
      return;
    }

    if (mode === 'max') {
      maxCharacterById(characterId);
      setNotice({ type: 'info', message: `Character ${characterId} set to max progression.` });
      closeCharacterContextMenu();
      return;
    }

    maxCharacterManaBoardById(characterId);
    setNotice({ type: 'info', message: `Character ${characterId} mana board set to max.` });
    closeCharacterContextMenu();
  };

  const applyCharacterContextLevelStop = (characterId: string, levelStop: CharacterLevelStop) => {
    handleCharacterLevelStopChange(characterId, levelStop);
    setNotice({ type: 'info', message: `Character ${characterId} level set to ${levelStop}.` });
  };

  const applyCharacterContextOverLimit = (characterId: string, step: number) => {
    handleCharacterFieldChange(characterId, 'over_limit_step', String(step));
    setNotice({ type: 'info', message: `Character ${characterId} over limit set to ${step}.` });
  };

  const maxVisibleCharacters = () => {
    if (visibleCharacters.length === 0) return;
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      for (const id of visibleCharacters) {
        if (!isObject(characterList[id])) continue;
        const character = getOrCreateObject(characterList, id);
        character.evolution_level = 1;
        character.over_limit_step = 6;
        character.mana_board_index = 2;
        character.exp = Math.max(getNumberValue(character.exp, 0), 999999);
      }
    });
    setNotice({ type: 'info', message: 'Visible owned characters updated to max board defaults.' });
  };

  const maxAllCharacters = () => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const characterList = getOrCreateObject(data, 'user_character_list');
      for (const [id] of Object.entries(characterList)) {
        const character = getOrCreateObject(characterList, id);
        character.evolution_level = 1;
        character.over_limit_step = 6;
        character.mana_board_index = 2;
        character.exp = Math.max(getNumberValue(character.exp, 0), 999999);
      }
    });
    setNotice({ type: 'info', message: 'Applied max settings to all owned characters.' });
  };

  const handleItemQuantityChange = (itemId: string, value: string) => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const itemList = getOrCreateObject(data, 'item_list');
      itemList[itemId] = toNumeric(value, 0);
    });
  };

  const addItem = () => {
    const id = newItemId.trim();
    if (!id) return;
    const qty = toNumeric(newItemQuantity, 0);
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const itemList = getOrCreateObject(data, 'item_list');
      itemList[id] = qty;
    });
    setNewItemId('');
    setNotice({ type: 'success', message: `Item ${id} set to ${qty}.` });
  };

  const removeItemEntry = (itemId: string) => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const itemList = getOrCreateObject(data, 'item_list');
      delete itemList[itemId];
    });
  };

  const openItemEditor = (itemId: string) => {
    setSelectedItemId(itemId);
  };

  const closeItemContextMenu = () => {
    setItemContextMenu((current) => {
      if (!current.itemId) return current;
      return { ...current, itemId: null };
    });
  };

  const openItemContextMenu = (event: React.MouseEvent<HTMLButtonElement>, itemId: string) => {
    event.preventDefault();
    setCharacterContextMenu((current) => (current.characterId ? { ...current, characterId: null } : current));
    setEquipmentContextMenu((current) => (current.equipmentId ? { ...current, equipmentId: null } : current));
    setItemContextMenu({ itemId, x: event.clientX, y: event.clientY });
  };

  const applyItemContextQuantity = (itemId: string, quantity: number, noticeMessage: string) => {
    handleItemQuantityChange(itemId, String(Math.max(0, quantity)));
    setNotice({ type: 'info', message: noticeMessage });
    closeItemContextMenu();
  };

  const applyItemContextDelta = (itemId: string, delta: number) => {
    const currentQuantity = itemQuantityById[itemId] ?? 0;
    const nextQuantity = Math.max(0, currentQuantity + delta);
    handleItemQuantityChange(itemId, String(nextQuantity));
    setNotice({ type: 'info', message: `Item ${itemId} quantity set to ${nextQuantity}.` });
    closeItemContextMenu();
  };

  const copyItemIdToClipboard = async (itemId: string) => {
    try {
      await navigator.clipboard.writeText(itemId);
      setNotice({ type: 'success', message: `Copied item ID ${itemId}.` });
    } catch {
      setNotice({ type: 'error', message: 'Could not copy item ID to clipboard.' });
    } finally {
      closeItemContextMenu();
    }
  };

  const closeEquipmentContextMenu = () => {
    setEquipmentContextMenu((current) => {
      if (!current.equipmentId) return current;
      return { ...current, equipmentId: null };
    });
  };

  const openEquipmentContextMenu = (event: React.MouseEvent<HTMLButtonElement>, equipmentId: string) => {
    event.preventDefault();
    setCharacterContextMenu((current) => (current.characterId ? { ...current, characterId: null } : current));
    setItemContextMenu((current) => (current.itemId ? { ...current, itemId: null } : current));
    setEquipmentContextMenu({ equipmentId, x: event.clientX, y: event.clientY });
  };

  const setVisibleItems = (qty: number) => {
    if (visibleItemIds.length === 0) return;
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const itemList = getOrCreateObject(data, 'item_list');
      for (const id of visibleItemIds) {
        itemList[id] = qty;
      }
    });
    setNotice({ type: 'info', message: `Visible items set to ${qty}.` });
  };

  const setAllItems = (qty: number) => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const itemList = getOrCreateObject(data, 'item_list');
      for (const id of Object.keys(itemList)) {
        itemList[id] = qty;
      }
    });
    setNotice({ type: 'info', message: `Set all item quantities to ${qty}.` });
  };

  const removeZeroQuantityItems = () => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const itemList = getOrCreateObject(data, 'item_list');
      for (const [id, quantity] of Object.entries(itemList)) {
        if (getNumberValue(quantity, 0) <= 0) {
          delete itemList[id];
        }
      }
    });
    setNotice({ type: 'info', message: 'Removed zero-quantity item entries from the save.' });
  };

  const handleEquipmentFieldChange = (equipmentId: string, field: string, value: string | boolean) => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const equipmentList = getOrCreateObject(data, 'user_equipment_list');
      const equipment = getOrCreateObject(equipmentList, equipmentId);
      equipment[field] = typeof value === 'boolean' ? value : toNumeric(value, 0);
    });
  };

  const addEquipmentById = (equipmentId: string): boolean => {
    const id = equipmentId.trim();
    if (!id) return false;
    const equipmentMeta = itemMetaById[id];
    if (
      equipmentMeta?.type === 'equipment' &&
      equipmentMeta.sheetRegions.length > 0 &&
      !equipmentMeta.sheetRegions.includes('gl')
    ) {
      setNotice({ type: 'error', message: `Equipment ${id} is JP-only and cannot be added to EN saves.` });
      return false;
    }
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const equipmentList = getOrCreateObject(data, 'user_equipment_list');
      if (!isObject(equipmentList[id])) {
        equipmentList[id] = {
          level: 1,
          enhancement_level: 0,
          protection: false,
          stack: 1,
        };
      }
    });
    return true;
  };

  const addEquipment = () => {
    const id = newEquipmentId.trim();
    if (!id) return;
    const added = addEquipmentById(id);
    if (!added) return;
    setNewEquipmentId('');
    setNotice({ type: 'success', message: `Equipment ${id} added.` });
  };

  const removeEquipment = (equipmentId: string) => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const equipmentList = getOrCreateObject(data, 'user_equipment_list');
      delete equipmentList[equipmentId];
    });
  };

  const maxVisibleEquipment = () => {
    if (visibleOwnedEquipmentIds.length === 0) return;
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const equipmentList = getOrCreateObject(data, 'user_equipment_list');
      for (const id of visibleOwnedEquipmentIds) {
        const equipment = getOrCreateObject(equipmentList, id);
        const options = equipmentEnhancementOptionsById[id] ?? [];
        equipment.level = EQUIPMENT_SAVE_LEVEL_MAX;
        equipment.enhancement_level = options.length > 0 ? options[options.length - 1] : 0;
      }
    });
    setNotice({
      type: 'info',
      message: `Visible owned equipment set to ${EQUIPMENT_LEVEL_POINT_MAX}/${EQUIPMENT_LEVEL_POINT_MAX}.`,
    });
  };

  const setVisibleOwnedEquipmentProtection = (locked: boolean) => {
    if (visibleOwnedEquipmentIds.length === 0) return;
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const equipmentList = getOrCreateObject(data, 'user_equipment_list');
      for (const id of visibleOwnedEquipmentIds) {
        const equipment = getOrCreateObject(equipmentList, id);
        equipment.protection = locked;
      }
    });
    setNotice({
      type: 'info',
      message: locked ? 'Visible owned equipment locked.' : 'Visible owned equipment unlocked.',
    });
  };

  const openEquipmentEditor = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
  };

  const handleEquipmentLevelPointChange = (equipmentId: string, levelPoint: number) => {
    const saveLevel = getEquipmentSaveLevelFromLevelPoint(levelPoint);
    handleEquipmentFieldChange(equipmentId, 'level', String(saveLevel));
  };

  const handleEquipmentEnhancementChange = (equipmentId: string, enhancementStatus: number) => {
    const options = equipmentEnhancementOptionsById[equipmentId] ?? [];
    if (options.length === 0 || enhancementStatus === 0) {
      handleEquipmentFieldChange(equipmentId, 'enhancement_level', '0');
      return;
    }
    if (!options.includes(enhancementStatus)) {
      return;
    }
    handleEquipmentFieldChange(equipmentId, 'enhancement_level', String(enhancementStatus));
  };

  const applyEquipmentPreset = (equipmentId: string, mode: 'min' | 'max' | 'max_lock') => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const equipmentList = getOrCreateObject(data, 'user_equipment_list');
      const equipment = getOrCreateObject(equipmentList, equipmentId);
      if (mode === 'min') {
        equipment.level = EQUIPMENT_SAVE_LEVEL_MIN;
        equipment.enhancement_level = 0;
        equipment.protection = false;
        equipment.stack = Math.max(getNumberValue(equipment.stack, 1), 1);
        return;
      }

      const options = equipmentEnhancementOptionsById[equipmentId] ?? [];
      equipment.level = EQUIPMENT_SAVE_LEVEL_MAX;
      equipment.enhancement_level = options.length > 0 ? options[options.length - 1] : 0;
      equipment.stack = Math.max(getNumberValue(equipment.stack, 1), 1);
      if (mode === 'max_lock') {
        equipment.protection = true;
      }
    });
  };

  const applyEquipmentContextPreset = (equipmentId: string, mode: 'min' | 'max' | 'max_lock') => {
    applyEquipmentPreset(equipmentId, mode);
    const modeLabel = mode === 'min' ? 'min' : mode === 'max' ? 'max' : 'max + lock';
    setNotice({ type: 'info', message: `Equipment ${equipmentId} set to ${modeLabel}.` });
    closeEquipmentContextMenu();
  };

  const applyEquipmentContextLevelPoint = (equipmentId: string, levelPoint: number) => {
    handleEquipmentLevelPointChange(equipmentId, levelPoint);
    setNotice({
      type: 'info',
      message: `Equipment ${equipmentId} level set to ${levelPoint}/${EQUIPMENT_LEVEL_POINT_MAX}.`,
    });
  };

  const applyEquipmentContextEnhancement = (equipmentId: string, enhancementStatus: number) => {
    handleEquipmentEnhancementChange(equipmentId, enhancementStatus);
    setNotice({
      type: 'info',
      message:
        enhancementStatus === 0
          ? `Equipment ${equipmentId} set to base enhancement.`
          : `Equipment ${equipmentId} enhancement set to ${enhancementStatus}.`,
    });
  };

  const applyEquipmentContextProtection = (equipmentId: string, locked: boolean) => {
    handleEquipmentFieldChange(equipmentId, 'protection', locked);
    setNotice({
      type: 'info',
      message: locked ? `Equipment ${equipmentId} locked.` : `Equipment ${equipmentId} unlocked.`,
    });
  };

  const copyEquipmentIdToClipboard = async (equipmentId: string) => {
    try {
      await navigator.clipboard.writeText(equipmentId);
      setNotice({ type: 'success', message: `Copied equipment ID ${equipmentId}.` });
    } catch {
      setNotice({ type: 'error', message: 'Could not copy equipment ID to clipboard.' });
    } finally {
      closeEquipmentContextMenu();
    }
  };

  const maxAllEquipment = () => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const equipmentList = getOrCreateObject(data, 'user_equipment_list');
      for (const [id] of Object.entries(equipmentList)) {
        const equipment = getOrCreateObject(equipmentList, id);
        const options = equipmentEnhancementOptionsById[id] ?? [];
        equipment.level = EQUIPMENT_SAVE_LEVEL_MAX;
        equipment.enhancement_level = options.length > 0 ? options[options.length - 1] : 0;
        equipment.stack = Math.max(getNumberValue(equipment.stack, 1), 1);
      }
    });
    setNotice({ type: 'info', message: 'Applied max settings to all owned equipment.' });
  };

  const updateStoryEntry = (
    chapterId: string,
    index: number,
    updater: (entry: JsonObject) => void
  ) => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const progress = getOrCreateObject(data, 'quest_progress');
      const chapterValue = progress[chapterId];
      if (!Array.isArray(chapterValue)) return;
      const current = chapterValue[index];
      if (!isObject(current)) return;
      updater(current);
      chapterValue[index] = current;
      progress[chapterId] = chapterValue;
    });
  };

  const initializeStoryProgressFromMetadata = () => {
    if (!saveDocument) {
      setNotice({ type: 'error', message: 'No save loaded.' });
      return;
    }
    const chapterSeeds = Object.entries(storySeedQuestIdsByChapterId);
    if (chapterSeeds.length === 0) {
      setNotice({ type: 'error', message: 'No EN story metadata is available to seed progression.' });
      return;
    }

    let addedEntries = 0;
    let touchedChapters = 0;
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const progress = getOrCreateObject(data, 'quest_progress');

      for (const [chapterId, questIds] of chapterSeeds) {
        const chapterValue = progress[chapterId];
        const chapterList = Array.isArray(chapterValue) ? [...chapterValue] : [];
        const existingQuestIds = new Set<string>();
        for (const entry of chapterList) {
          if (!isObject(entry)) continue;
          const questId = getStringValue(entry.quest_id);
          if (!questId) continue;
          existingQuestIds.add(questId);
        }

        let chapterAdded = 0;
        for (const questId of questIds) {
          if (existingQuestIds.has(questId)) continue;
          chapterList.push({
            quest_id: toNumeric(questId, 0),
            finished: false,
            clear_rank: 0,
            high_score: '',
          });
          existingQuestIds.add(questId);
          chapterAdded += 1;
        }

        if (chapterAdded > 0) {
          chapterList.sort((left, right) => {
            const leftQuestId = isObject(left) ? getNumberValue(left.quest_id, 0) : 0;
            const rightQuestId = isObject(right) ? getNumberValue(right.quest_id, 0) : 0;
            return leftQuestId - rightQuestId;
          });
          progress[chapterId] = chapterList;
          touchedChapters += 1;
          addedEntries += chapterAdded;
        }
      }
    });

    if (addedEntries === 0) {
      setNotice({ type: 'info', message: 'Story progression is already initialized from EN metadata.' });
      return;
    }

    setNotice({
      type: 'success',
      message: `Initialized story progression: added ${addedEntries} quest entries across ${touchedChapters} categories.`,
    });
  };

  const completeAllStory = () => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const progress = getOrCreateObject(data, 'quest_progress');
      for (const chapter of Object.keys(progress)) {
        const chapterValue = progress[chapter];
        if (!Array.isArray(chapterValue)) continue;
        chapterValue.forEach((entry) => {
          if (!isObject(entry)) return;
          entry.finished = true;
          if (getNumberValue(entry.clear_rank, 0) < 5) entry.clear_rank = 5;
        });
      }
    });
    setNotice({ type: 'info', message: 'Marked all story/quest entries as cleared.' });
  };

  const updatePartySlotField = (
    groupId: string,
    slotId: string,
    field: 'name' | PartyPickerField,
    index: number | null,
    value: string
  ) => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const groups = getOrCreateObject(data, 'user_party_group_list');
      const group = getOrCreateObject(groups, groupId);
      const list = getOrCreateObject(group, 'list');
      const slot = getOrCreateObject(list, slotId);

      if (field === 'name') {
        slot.name = value;
        return;
      }

      const current = Array.isArray(slot[field]) ? [...(slot[field] as unknown[])] : [0, 0, 0];
      const nextIndex = index ?? 0;
      current[nextIndex] = toNumeric(value, 0);
      slot[field] = current;
    });
  };

  const getPartySlotLoadout = (groupId: string, slotId: string) => {
    if (!saveDocument) return null;
    const groups = isObject(saveDocument.data.user_party_group_list)
      ? (saveDocument.data.user_party_group_list as Record<string, unknown>)
      : {};
    const groupValue = groups[groupId];
    const group = isObject(groupValue) ? groupValue : null;
    const list = group && isObject(group.list) ? (group.list as Record<string, unknown>) : {};
    const slotValue = list[slotId];
    const slot = isObject(slotValue) ? slotValue : null;
    if (!slot) return null;

    return {
      characterIds: normalizeTripleArray(slot.character_ids),
      unisonCharacterIds: normalizeTripleArray(slot.unison_character_ids),
      equipmentIds: normalizeTripleArray(slot.equipment_ids),
      soulIds: normalizeTripleArray(slot.ability_soul_ids),
    };
  };

  const mapPartyIdToCompToken = (
    id: number,
    tokenById: Record<string, string>,
    missingIds: number[],
    fallbackToken = ELIYA_COMP_BLANK_TOKEN
  ): string => {
    if (id <= 0) return fallbackToken;
    const token = tokenById[String(id)];
    if (token) return token;
    missingIds.push(id);
    return fallbackToken;
  };

  const mapCompTokenToPartyId = (
    token: string,
    idByToken: Record<string, string>,
    missingTokens: string[],
    fallbackId = 0
  ): number => {
    const normalizedToken = normalizeEliyaCompToken(token);
    if (!normalizedToken || normalizedToken === ELIYA_COMP_BLANK_TOKEN) return fallbackId;
    const id = idByToken[normalizedToken];
    if (!id) {
      missingTokens.push(normalizedToken);
      return fallbackId;
    }
    return toNumeric(id, fallbackId);
  };

  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fallback below.
      }
    }
    if (typeof document === 'undefined') return false;
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', 'true');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    document.body.removeChild(textArea);
    return copied;
  };

  const triggerPartyShareFeedback = (groupId: string, slotId: string) => {
    const nextKey = `${groupId}-${slotId}`;
    if (partyShareFeedbackTimeoutRef.current) {
      clearTimeout(partyShareFeedbackTimeoutRef.current);
      partyShareFeedbackTimeoutRef.current = null;
    }
    setPartyShareFeedbackKey(nextKey);
    partyShareFeedbackTimeoutRef.current = setTimeout(() => {
      setPartyShareFeedbackKey((current) => (current === nextKey ? null : current));
      partyShareFeedbackTimeoutRef.current = null;
    }, 1800);
  };

  const sharePartySlotAsLink = async (groupId: string, slotId: string) => {
    const loadout = getPartySlotLoadout(groupId, slotId);
    if (!loadout) {
      setNotice({ type: 'error', message: 'Could not read this party slot.' });
      return;
    }

    const missingCharacterIds: number[] = [];
    const missingEquipmentIds: number[] = [];
    const tokens = [
      mapPartyIdToCompToken(loadout.characterIds[0], characterCompTokenById, missingCharacterIds),
      mapPartyIdToCompToken(loadout.unisonCharacterIds[0], characterCompTokenById, missingCharacterIds),
      mapPartyIdToCompToken(loadout.characterIds[1], characterCompTokenById, missingCharacterIds),
      mapPartyIdToCompToken(loadout.unisonCharacterIds[1], characterCompTokenById, missingCharacterIds),
      mapPartyIdToCompToken(loadout.characterIds[2], characterCompTokenById, missingCharacterIds),
      mapPartyIdToCompToken(loadout.unisonCharacterIds[2], characterCompTokenById, missingCharacterIds),
      mapPartyIdToCompToken(loadout.equipmentIds[0], equipmentCompTokenById, missingEquipmentIds),
      mapPartyIdToCompToken(loadout.soulIds[0], equipmentCompTokenById, missingEquipmentIds),
      mapPartyIdToCompToken(loadout.equipmentIds[1], equipmentCompTokenById, missingEquipmentIds),
      mapPartyIdToCompToken(loadout.soulIds[1], equipmentCompTokenById, missingEquipmentIds),
      mapPartyIdToCompToken(loadout.equipmentIds[2], equipmentCompTokenById, missingEquipmentIds),
      mapPartyIdToCompToken(loadout.soulIds[2], equipmentCompTokenById, missingEquipmentIds),
    ];

    const link = buildEliyaCompLink(tokens);
    const copied = await copyTextToClipboard(link);
    const missingCount = missingCharacterIds.length + missingEquipmentIds.length;
    if (copied) {
      triggerPartyShareFeedback(groupId, slotId);
      setNotice({
        type: 'success',
        message:
          missingCount > 0
            ? `Party link copied. ${missingCount} unknown IDs were exported as "blank".`
            : 'Party link copied to clipboard.',
      });
      return;
    }

    if (typeof window !== 'undefined') {
      window.prompt('Copy party link', link);
    }
    triggerPartyShareFeedback(groupId, slotId);
    setNotice({
      type: 'info',
      message:
        missingCount > 0
          ? `Generated party link. ${missingCount} unknown IDs were exported as "blank".`
          : 'Generated party link.',
    });
  };

  const importPartySlotFromLink = (groupId: string, slotId: string, input: string): boolean => {
    const tokens = parseEliyaCompTokens(input);
    if (!tokens) {
      setNotice({ type: 'error', message: 'Could not parse that party link.' });
      return false;
    }

    const missingCharacterTokens: string[] = [];
    const missingEquipmentTokens: string[] = [];
    const characterIds = [
      mapCompTokenToPartyId(tokens[0], characterIdByCompToken, missingCharacterTokens),
      mapCompTokenToPartyId(tokens[2], characterIdByCompToken, missingCharacterTokens),
      mapCompTokenToPartyId(tokens[4], characterIdByCompToken, missingCharacterTokens),
    ];
    const unisonCharacterIds = [
      mapCompTokenToPartyId(tokens[1], characterIdByCompToken, missingCharacterTokens),
      mapCompTokenToPartyId(tokens[3], characterIdByCompToken, missingCharacterTokens),
      mapCompTokenToPartyId(tokens[5], characterIdByCompToken, missingCharacterTokens),
    ];
    const equipmentIds = [
      mapCompTokenToPartyId(tokens[6], equipmentIdByCompToken, missingEquipmentTokens),
      mapCompTokenToPartyId(tokens[8], equipmentIdByCompToken, missingEquipmentTokens),
      mapCompTokenToPartyId(tokens[10], equipmentIdByCompToken, missingEquipmentTokens),
    ];
    const soulIds = [
      mapCompTokenToPartyId(tokens[7], equipmentIdByCompToken, missingEquipmentTokens),
      mapCompTokenToPartyId(tokens[9], equipmentIdByCompToken, missingEquipmentTokens),
      mapCompTokenToPartyId(tokens[11], equipmentIdByCompToken, missingEquipmentTokens),
    ];

    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const groups = getOrCreateObject(data, 'user_party_group_list');
      const group = getOrCreateObject(groups, groupId);
      const list = getOrCreateObject(group, 'list');
      const slot = getOrCreateObject(list, slotId);
      slot.character_ids = characterIds;
      slot.unison_character_ids = unisonCharacterIds;
      slot.equipment_ids = equipmentIds;
      slot.ability_soul_ids = soulIds;
      slot.edited = true;
    });

    const missingCount = missingCharacterTokens.length + missingEquipmentTokens.length;
    setNotice({
      type: missingCount > 0 ? 'info' : 'success',
      message:
        missingCount > 0
          ? `Imported party link with ${missingCount} unknown token(s) set to blank.`
          : 'Imported party link into this slot.',
    });
    return true;
  };

  const startPartySlotLinkImport = (groupId: string, slotId: string) => {
    if (partyImportInputRef.current) {
      partyImportInputRef.current.value = '';
    }
    setPartyImportSlotKey(`${groupId}-${slotId}`);
  };

  const cancelPartySlotLinkImport = () => {
    setPartyImportSlotKey(null);
    if (partyImportInputRef.current) {
      partyImportInputRef.current.value = '';
    }
  };

  const confirmPartySlotLinkImport = (groupId: string, slotId: string, rawInput?: string) => {
    const text = getStringValue(rawInput ?? partyImportInputRef.current?.value).trim();
    if (!text) {
      setNotice({ type: 'error', message: 'Paste a link or comp slug first.' });
      return;
    }
    const imported = importPartySlotFromLink(groupId, slotId, text);
    if (imported) {
      cancelPartySlotLinkImport();
    }
  };

  const clearQueuedPartyPickerSearch = () => {
    if (partyPickerSearchDebounceRef.current) {
      clearTimeout(partyPickerSearchDebounceRef.current);
      partyPickerSearchDebounceRef.current = null;
    }
  };

  const queuePartyPickerSearch = (value: string) => {
    clearQueuedPartyPickerSearch();
    partyPickerSearchDebounceRef.current = setTimeout(() => {
      setPartyPickerSearch(value);
      partyPickerSearchDebounceRef.current = null;
    }, PARTY_PICKER_SEARCH_DEBOUNCE_MS);
  };

  const openPartyPicker = (
    groupId: string,
    slotId: string,
    slotIndex: number,
    field: PartyPickerField,
    kind: PartyPickerKind,
    title: string
  ) => {
    clearQueuedPartyPickerSearch();
    setPartyPickerSearch('');
    setPartyPicker({ groupId, slotId, slotIndex, field, kind, title });
  };

  const closePartyPicker = () => {
    clearQueuedPartyPickerSearch();
    setPartyPicker(null);
    setPartyPickerSearch('');
  };

  const applyPartyPickerValue = (selectedId: string | number) => {
    if (!partyPicker) return;
    updatePartySlotField(
      partyPicker.groupId,
      partyPicker.slotId,
      partyPicker.field,
      partyPicker.slotIndex,
      String(getNumberValue(selectedId, 0))
    );
    closePartyPicker();
  };

  const clearPartySlot = (groupId: string, slotId: string) => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const groups = getOrCreateObject(data, 'user_party_group_list');
      const group = getOrCreateObject(groups, groupId);
      const list = getOrCreateObject(group, 'list');
      const slot = getOrCreateObject(list, slotId);
      slot.character_ids = [0, 0, 0];
      slot.unison_character_ids = [0, 0, 0];
      slot.equipment_ids = [0, 0, 0];
      slot.ability_soul_ids = [0, 0, 0];
      slot.edited = true;
    });
  };

  const setPartySlotEdited = (groupId: string, slotId: string, edited: boolean) => {
    applySaveMutation((draft) => {
      const data = getOrCreateObject(draft, 'data');
      const groups = getOrCreateObject(data, 'user_party_group_list');
      const group = getOrCreateObject(groups, groupId);
      const list = getOrCreateObject(group, 'list');
      const slot = getOrCreateObject(list, slotId);
      slot.edited = edited;
    });
  };

  const syncRawSelectionFromTextarea = () => {
    const textArea = rawTextAreaRef.current;
    if (!textArea) return;
    const next = { start: textArea.selectionStart ?? 0, end: textArea.selectionEnd ?? 0 };
    setRawSelectionRange((current) => {
      if (current.start === next.start && current.end === next.end) return current;
      return next;
    });
  };

  const openInspectorHitInEditor = (hit: RawInspectorHit) => {
    if (hit.kind === 'character') {
      setActiveTab('characters');
      setSelectedCharacterId(hit.id);
      return;
    }
    if (hit.kind === 'equipment') {
      setActiveTab('equipment');
      setSelectedEquipmentId(hit.id);
      return;
    }
    if (hit.kind === 'item') {
      setActiveTab('items');
      setSelectedItemId(hit.id);
      return;
    }
    if (hit.kind === 'quest') {
      setActiveTab('story');
      setStorySearch(hit.id);
    }
  };

  const applyRawJson = () => {
    if (!rawParsedState.isValid) {
      setNotice({ type: 'error', message: rawParsedState.error ?? 'Raw JSON is invalid.' });
      return;
    }

    const normalized = normalizeSaveInput(rawParsedState.parsed);
    if (!normalized.ok) {
      setNotice({ type: 'error', message: normalized.error });
      return;
    }

    setSaveDocument(normalized.value);
    setRawDirty(false);
    setNotice({ type: 'success', message: 'Raw JSON applied to editor.' });
  };

  const formatRawJson = () => {
    if (!rawParsedState.isValid) {
      setNotice({ type: 'error', message: rawParsedState.error ?? 'Raw JSON is invalid.' });
      return;
    }
    setRawText(JSON.stringify(rawParsedState.parsed, null, 2));
    setRawDirty(true);
  };

  const minifyRawJson = () => {
    if (!rawParsedState.isValid) {
      setNotice({ type: 'error', message: rawParsedState.error ?? 'Raw JSON is invalid.' });
      return;
    }
    setRawText(JSON.stringify(rawParsedState.parsed));
    setRawDirty(true);
  };

  const resetRawFromStructured = () => {
    if (!saveDocument) return;
    setRawText(JSON.stringify(saveDocument, null, 2));
    setRawDirty(false);
    setNotice({ type: 'info', message: 'Raw editor reset from structured data.' });
  };

  const resetSavedEditorSession = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SAVE_EDITOR_LOCALSTORAGE_KEY);
    }
    setSaveDocument(null);
    setSourceLabel('No save loaded');
    setOutputFileName('edited_save.json');
    setRawText('');
    setRawDirty(false);
    setRawJumpSelection('');
    setSelectedCharacterId(null);
    setCharacterNodeDraft('');
    setSelectedEquipmentId(null);
    setNotice({ type: 'info', message: 'Cleared local save editor session.' });
  };

  const jumpToRawSection = (sectionKey: string) => {
    const section = RAW_SECTION_JUMPS.find((entry) => entry.key === sectionKey);
    if (!section) return;
    if (!rawText) {
      setNotice({ type: 'error', message: 'Raw JSON is empty.' });
      return;
    }

    let matchIndex = -1;
    for (const pattern of section.patterns) {
      const foundIndex = rawText.indexOf(pattern);
      if (foundIndex === -1) continue;
      if (matchIndex === -1 || foundIndex < matchIndex) {
        matchIndex = foundIndex;
      }
    }

    if (matchIndex === -1) {
      setNotice({ type: 'error', message: `Could not find section "${section.label}" in raw JSON.` });
      return;
    }

    const textArea = rawTextAreaRef.current;
    if (!textArea) return;

    textArea.focus();
    textArea.setSelectionRange(matchIndex, matchIndex);
    setRawSelectionRange({ start: matchIndex, end: matchIndex });

    const lineNumber = rawText.slice(0, matchIndex).split('\n').length - 1;
    const computedStyle = window.getComputedStyle(textArea);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight);
    const safeLineHeight = Number.isFinite(lineHeight) ? lineHeight : 16;
    textArea.scrollTop = Math.max(0, lineNumber * safeLineHeight - textArea.clientHeight * 0.35);

    setNotice({ type: 'info', message: `Jumped to ${section.label}.` });
  };

  return (
    <div className='min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.11),transparent_42%)]'>
      <div className='mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6'>
        <Card className='border-border/60 bg-background/90 backdrop-blur'>
          <CardHeader className='pb-3'>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
              <div>
                <CardTitle className='flex items-center gap-2 text-2xl'>
                  <FileJson className='h-6 w-6 text-primary' />
                  Save Editor
                </CardTitle>
                <CardDescription className='mt-1'>
                  Structured editing for World Flipper saves with a raw JSON fallback tab.
                </CardDescription>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant={saveDocument ? 'default' : 'secondary'} className='gap-1.5'>
                  {saveDocument ? <CheckCircle2 className='h-3.5 w-3.5' /> : <AlertCircle className='h-3.5 w-3.5' />}
                  {saveDocument ? 'Save Loaded' : 'No Save'}
                </Badge>
                <Badge variant='outline'>{sourceLabel}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex flex-wrap gap-2'>
              <input
                ref={fileInputRef}
                type='file'
                accept='.json,application/json'
                className='hidden'
                onChange={(event) => void handleUpload(event)}
              />
              <Button onClick={() => fileInputRef.current?.click()} className='gap-2'>
                <FileUp className='h-4 w-4' />
                Upload JSON
              </Button>
              <Button variant='outline' onClick={() => void loadTemplate('fresh')} disabled={loadingTemplate !== null}>
                {loadingTemplate === 'fresh' ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
                Start Fresh
              </Button>
              <Button
                variant='outline'
                onClick={() => void loadTemplate('mostly_complete')}
                disabled={loadingTemplate !== null}
              >
                {loadingTemplate === 'mostly_complete' ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
                Start Mostly Complete
              </Button>
              <Button variant='secondary' onClick={downloadSave} disabled={!saveDocument} className='gap-2'>
                <Download className='h-4 w-4' />
                Download
              </Button>
              <Button
                variant='outline'
                onClick={resetSavedEditorSession}
                className='gap-2 border-destructive/50 text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive'
              >
                <Trash2 className='h-4 w-4' />
                Reset
              </Button>
            </div>

            <div className='rounded-md border bg-muted/20 p-3'>
              <p className='text-xs uppercase tracking-wide text-muted-foreground'>Quick Actions</p>
              <div className='mt-2 flex flex-wrap gap-2'>
                <Button variant='secondary' onClick={maxAllCharacters} disabled={!saveDocument}>
                  Max All Characters
                </Button>
                <Button variant='secondary' onClick={() => setAllItems(9999)} disabled={!saveDocument}>
                  Set All Items 9999
                </Button>
                <Button variant='outline' onClick={() => setAllItems(0)} disabled={!saveDocument}>
                  Zero All Items
                </Button>
                <Button variant='secondary' onClick={maxAllEquipment} disabled={!saveDocument}>
                  Max All Equipment
                </Button>
                <Button
                  variant='outline'
                  onClick={initializeStoryProgressFromMetadata}
                  disabled={!saveDocument || storySeedQuestCount === 0}
                >
                  Initialize Story Progress (EN)
                </Button>
                <Button variant='secondary' onClick={completeAllStory} disabled={!saveDocument}>
                  Complete All Story
                </Button>
              </div>
            </div>

            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-7'>
              <div className='rounded-md border bg-muted/20 p-3'>
                <p className='text-xs uppercase tracking-wide text-muted-foreground'>Data Keys</p>
                <p className='mt-1 text-xl font-semibold'>{saveStats.dataKeys}</p>
              </div>
              <div className='rounded-md border bg-muted/20 p-3'>
                <p className='text-xs uppercase tracking-wide text-muted-foreground'>Characters</p>
                <p className='mt-1 text-xl font-semibold'>{saveStats.characters}</p>
              </div>
              <div className='rounded-md border bg-muted/20 p-3'>
                <p className='text-xs uppercase tracking-wide text-muted-foreground'>Items</p>
                <p className='mt-1 text-xl font-semibold'>{saveStats.items}</p>
              </div>
              <div className='rounded-md border bg-muted/20 p-3'>
                <p className='text-xs uppercase tracking-wide text-muted-foreground'>Equipment</p>
                <p className='mt-1 text-xl font-semibold'>{saveStats.equipment}</p>
              </div>
              <div className='rounded-md border bg-muted/20 p-3'>
                <p className='text-xs uppercase tracking-wide text-muted-foreground'>Party Slots</p>
                <p className='mt-1 text-xl font-semibold'>{saveStats.parties}</p>
              </div>
              <div className='rounded-md border bg-muted/20 p-3'>
                <p className='text-xs uppercase tracking-wide text-muted-foreground'>Story Entries</p>
                <p className='mt-1 text-xl font-semibold'>{saveStats.stories}</p>
              </div>
              <div className='rounded-md border bg-muted/20 p-3'>
                <p className='text-xs uppercase tracking-wide text-muted-foreground'>Estimated Size</p>
                <p className='mt-1 text-xl font-semibold'>{formatBytes(saveStats.fileSizeBytes)}</p>
              </div>
            </div>

            <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]'>
              <Input
                value={outputFileName}
                onChange={(event) => setOutputFileName(event.target.value)}
                placeholder='edited_save.json'
              />
            </div>

            {notice && (
              <div
                className={
                  notice.type === 'error'
                    ? 'rounded-md border border-destructive/35 bg-destructive/5 px-3 py-2 text-sm text-destructive'
                    : 'rounded-md border border-primary/35 bg-primary/5 px-3 py-2 text-sm'
                }
              >
                {notice.message}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className='border-border/60 bg-background/90'>
          <CardContent className='p-3'>
            <div className='grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7'>
              {EDITOR_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <Button
                    key={tab.key}
                    variant={isActive ? 'default' : 'outline'}
                    className='justify-start gap-2'
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <Icon className='h-4 w-4' />
                    {tab.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {activeTab === 'general' && (
          <Card className='border-border/60 bg-background/90'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>General</CardTitle>
              <CardDescription>Edit account-level profile and resource values.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex flex-wrap gap-2'>
                <Button variant='secondary' onClick={applyResourcePreset} disabled={!saveDocument} className='gap-2'>
                  <Sparkles className='h-4 w-4' />
                  High Resource Preset
                </Button>
              </div>
              <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                {GENERAL_FIELDS.map((field) => {
                  const rawValue = userInfo[field.key];
                  const value =
                    field.kind === 'number' ? String(getNumberValue(rawValue, 0)) : getStringValue(rawValue);

                  return (
                    <div key={field.key} className='space-y-1 rounded-md border bg-muted/20 p-3'>
                      <p className='text-xs uppercase tracking-wide text-muted-foreground'>{field.label}</p>
                      <Input
                        type={field.kind === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={(event) => handleGeneralFieldChange(field, event.target.value)}
                        disabled={!saveDocument}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'characters' && (
          <Card className='border-border/60 bg-background/90'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Characters</CardTitle>
              <CardDescription>
                Icon collection view. Owned characters glow; unowned are dimmed. Click any icon to edit details.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex flex-wrap gap-2'>
                <div className='relative min-w-[220px] flex-1'>
                  <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    value={characterSearch}
                    onChange={(event) => setCharacterSearch(event.target.value)}
                    placeholder='Search ID, EN/JP name, or face code...'
                    className='pl-9'
                    disabled={!saveDocument}
                  />
                </div>
                <Input
                  value={newCharacterId}
                  onChange={(event) => setNewCharacterId(event.target.value)}
                  placeholder='Character ID'
                  className='w-[160px]'
                  disabled={!saveDocument}
                />
                <Button onClick={addCharacter} className='gap-2' disabled={!saveDocument}>
                  <Plus className='h-4 w-4' />
                  Add
                </Button>
                <Button variant='secondary' onClick={maxVisibleCharacters} disabled={!saveDocument}>
                  Max Visible Owned
                </Button>
                <Select
                  value={characterMb2Filter}
                  onValueChange={(value) => setCharacterMb2Filter(value as CharacterMb2Filter)}
                  disabled={!saveDocument}
                >
                  <SelectTrigger className='w-[150px]'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>MB2: All</SelectItem>
                    <SelectItem value='has_mb2'>MB2: Has MB2</SelectItem>
                    <SelectItem value='no_mb2'>MB2: No MB2</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={characterBorderFilter}
                  onValueChange={(value) => setCharacterBorderFilter(value as CharacterBorderFilter)}
                  disabled={!saveDocument}
                >
                  <SelectTrigger className='w-[190px]'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Status: All</SelectItem>
                    <SelectItem value='default'>Status: Unbuilt</SelectItem>
                    <SelectItem value='blue'>Status: MB1 Maxed</SelectItem>
                    <SelectItem value='red'>Status: MB2 In Progress</SelectItem>
                    <SelectItem value='gold'>Status: Fully Maxed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-1'>
                {visibleCharacters.map((id) => {
                  const owned = ownedCharacterIds.has(id);
                  const meta = characterMetaById[id];
                  const displayName = meta?.nameEN || meta?.nameJP || meta?.faceCode || `Character ${id}`;
                  const thumbUrls = meta ? buildCharacterThumbUrls(meta.faceCode) : [];
                  const tone = characterBorderToneById[id] ?? 'default';
                  const ownedClass =
                    tone === 'gold'
                      ? 'border-amber-400/70 bg-amber-400/10 shadow-[0_0_0_1px_rgba(251,191,36,0.35)] hover:bg-amber-400/15'
                      : tone === 'red'
                        ? 'border-red-500/70 bg-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.35)] hover:bg-red-500/15'
                        : tone === 'blue'
                          ? 'border-sky-400/70 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.32)] hover:bg-sky-500/15'
                          : 'border-primary/50 bg-primary/10 shadow-[0_0_0_1px_rgba(59,130,246,0.18)] hover:bg-primary/15';

                  return (
                    <button
                      key={id}
                      type='button'
                      onClick={() => openCharacterEditor(id)}
                      onContextMenu={(event) => openCharacterContextMenu(event, id)}
                      className={`group flex flex-col items-center rounded-md border p-0.5 text-center transition ${
                        owned ? ownedClass : 'border-border/50 bg-muted/20 opacity-45 grayscale hover:opacity-80 hover:grayscale-0'
                      }`}
                      disabled={!saveDocument}
                      title={`ID ${id}`}
                    >
                      <AssetThumb urls={thumbUrls} alt={displayName} size={52} pixelated={false} />
                      <p className='mt-0.5 w-full truncate text-[9px] text-muted-foreground'>{displayName}</p>
                    </button>
                  );
                })}
                {visibleCharacters.length === 0 && (
                  <div className='col-span-full rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
                    No matching characters.
                  </div>
                )}
              </div>

              {characterContextMenuEntry && (
                <div
                  ref={characterContextMenuRef}
                  role='menu'
                  className='fixed z-[70] w-80 rounded-md border bg-background/95 p-1 shadow-2xl backdrop-blur'
                  style={{ left: characterContextMenuPosition.left, top: characterContextMenuPosition.top }}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <div className='px-2 py-1.5'>
                    <p className='truncate text-xs font-semibold'>{characterContextMenuEntry.name}</p>
                    <p className='font-mono text-[10px] text-muted-foreground'>
                      ID {characterContextMenuEntry.id} | {getCharacterToneLabel(characterContextMenuEntry.tone)} | Lv{' '}
                      {characterContextMenuEntry.levelStop}
                      {' | '}OL {characterContextMenuEntry.overLimitStep}
                    </p>
                    <p className='font-mono text-[10px] text-muted-foreground'>
                      /characters/{characterContextMenuEntry.devName || '(missing-devname)'}
                    </p>
                  </div>
                  <div className='my-1 h-px bg-border' />
                  <button
                    type='button'
                    className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent'
                    onClick={() => {
                      openCharacterEditor(characterContextMenuEntry.id);
                      closeCharacterContextMenu();
                    }}
                    disabled={!saveDocument}
                  >
                    Open Full Editor
                  </button>
                  <button
                    type='button'
                    className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-50'
                    onClick={() => openCharacterPageByDevName(characterContextMenuEntry.devName)}
                    disabled={!characterContextMenuEntry.devName}
                  >
                    Open Character Page
                  </button>
                  {!characterContextMenuEntry.owned ? (
                    <button
                      type='button'
                      className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent'
                      onClick={() => {
                        addCharacterById(characterContextMenuEntry.id);
                        setNotice({ type: 'success', message: `Character ${characterContextMenuEntry.id} added.` });
                        closeCharacterContextMenu();
                      }}
                      disabled={!saveDocument}
                    >
                      Add To Save
                    </button>
                  ) : (
                    <button
                      type='button'
                      className='w-full rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10'
                      onClick={() => {
                        removeCharacter(characterContextMenuEntry.id);
                        setNotice({ type: 'info', message: `Character ${characterContextMenuEntry.id} removed.` });
                        closeCharacterContextMenu();
                      }}
                      disabled={!saveDocument}
                    >
                      Remove From Save
                    </button>
                  )}
                  <button
                    type='button'
                    className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent'
                    onClick={() => void copyCharacterFieldToClipboard(characterContextMenuEntry.id, 'character ID')}
                  >
                    Copy ID
                  </button>
                  <button
                    type='button'
                    className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-50'
                    onClick={() => void copyCharacterFieldToClipboard(characterContextMenuEntry.faceCode, 'face code')}
                    disabled={!characterContextMenuEntry.faceCode}
                  >
                    Copy Face Code
                  </button>
                  <div className='my-1 h-px bg-border' />
                  <div className='px-2 pb-1 pt-0.5'>
                    <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Progress Preset</p>
                    <div className='mt-1 grid grid-cols-3 gap-1'>
                      <button
                        type='button'
                        className='rounded border px-1 py-1 text-[11px] hover:bg-accent disabled:opacity-50'
                        onClick={() => applyCharacterContextQuickPreset(characterContextMenuEntry.id, 'base')}
                        disabled={!saveDocument || !characterContextMenuEntry.owned}
                      >
                        Base
                      </button>
                      <button
                        type='button'
                        className='rounded border px-1 py-1 text-[11px] hover:bg-accent disabled:opacity-50'
                        onClick={() => applyCharacterContextQuickPreset(characterContextMenuEntry.id, 'max')}
                        disabled={!saveDocument || !characterContextMenuEntry.owned}
                      >
                        Max
                      </button>
                      <button
                        type='button'
                        className='rounded border px-1 py-1 text-[11px] hover:bg-accent disabled:opacity-50'
                        onClick={() => applyCharacterContextQuickPreset(characterContextMenuEntry.id, 'max_board')}
                        disabled={!saveDocument || !characterContextMenuEntry.owned}
                      >
                        Max Board
                      </button>
                    </div>
                  </div>
                  <div className='my-1 h-px bg-border' />
                  <div className='px-2 pb-1 pt-0.5'>
                    <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Mana Preset</p>
                    <div className='mt-1 grid grid-cols-2 gap-1'>
                      <button
                        type='button'
                        className='rounded border px-1 py-1 text-[11px] hover:bg-accent disabled:opacity-50'
                        onClick={() => applyCharacterContextBoardPreset(characterContextMenuEntry.id, 'fresh')}
                        disabled={!saveDocument || !characterContextMenuEntry.owned}
                      >
                        Fresh
                      </button>
                      <button
                        type='button'
                        className='rounded border px-1 py-1 text-[11px] hover:bg-accent disabled:opacity-50'
                        onClick={() => applyCharacterContextBoardPreset(characterContextMenuEntry.id, 'blue')}
                        disabled={!saveDocument || !characterContextMenuEntry.owned}
                      >
                        MB1 Maxed
                      </button>
                      <button
                        type='button'
                        className='rounded border px-1 py-1 text-[11px] hover:bg-accent disabled:opacity-50'
                        onClick={() => applyCharacterContextBoardPreset(characterContextMenuEntry.id, 'red')}
                        disabled={!saveDocument || !characterContextMenuEntry.owned}
                      >
                        MB2 In Progress
                      </button>
                      <button
                        type='button'
                        className='rounded border px-1 py-1 text-[11px] hover:bg-accent disabled:opacity-50'
                        onClick={() => applyCharacterContextBoardPreset(characterContextMenuEntry.id, 'gold')}
                        disabled={!saveDocument || !characterContextMenuEntry.owned}
                      >
                        Fully Maxed
                      </button>
                    </div>
                  </div>
                  <div className='my-1 h-px bg-border' />
                  <div className='px-2 pb-1 pt-0.5'>
                    <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Level</p>
                    <div className='mt-1 grid grid-cols-5 gap-1'>
                      {CHARACTER_LEVEL_STOPS.map((levelStop) => {
                        const active = characterContextMenuEntry.levelStop === levelStop;
                        return (
                          <button
                            key={levelStop}
                            type='button'
                            className={`rounded border px-1 py-1 text-[11px] transition ${
                              active
                                ? 'border-primary/70 bg-primary/15 text-primary'
                                : 'border-border bg-background/70 text-muted-foreground hover:bg-accent'
                            }`}
                            onClick={() => applyCharacterContextLevelStop(characterContextMenuEntry.id, levelStop)}
                            disabled={!saveDocument || !characterContextMenuEntry.owned}
                          >
                            {levelStop}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className='my-1 h-px bg-border' />
                  <div className='px-2 pb-1 pt-0.5'>
                    <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Over Limit</p>
                    <div className='mt-1 grid grid-cols-7 gap-1'>
                      {[0, 1, 2, 3, 4, 5, 6].map((step) => {
                        const active = characterContextMenuEntry.overLimitStep === step;
                        return (
                          <button
                            key={step}
                            type='button'
                            className={`rounded border px-1 py-1 text-[11px] transition ${
                              active
                                ? 'border-primary/70 bg-primary/15 text-primary'
                                : 'border-border bg-background/70 text-muted-foreground hover:bg-accent'
                            }`}
                            onClick={() => applyCharacterContextOverLimit(characterContextMenuEntry.id, step)}
                            disabled={!saveDocument || !characterContextMenuEntry.owned}
                          >
                            {step}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
                <span className='inline-flex items-center gap-1.5 rounded-md border px-2 py-1'>
                  <span className='h-2 w-2 rounded-full bg-slate-400' />
                  Unbuilt: Not at core-max status
                </span>
                <span className='inline-flex items-center gap-1.5 rounded-md border px-2 py-1'>
                  <span className='h-2 w-2 rounded-full bg-sky-400' />
                  MB1 Maxed: Abi 1-3 maxed
                </span>
                <span className='inline-flex items-center gap-1.5 rounded-md border px-2 py-1'>
                  <span className='h-2 w-2 rounded-full bg-red-500' />
                  MB2 In Progress: Abi 1-3 maxed, Abi 4-6 not maxed
                </span>
                <span className='inline-flex items-center gap-1.5 rounded-md border px-2 py-1'>
                  <span className='h-2 w-2 rounded-full bg-amber-400' />
                  Fully Maxed: Fully maxed mana board
                </span>
              </div>

              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                <p>
                  Owned in save (catalog list): {ownedVisibleCharacterCount} / {allCharacterIds.length} listed characters
                </p>
              </div>

              <div className='flex items-center justify-between'>
                <p className='text-sm text-muted-foreground'>
                  Showing page {characterPage} / {characterTotalPages} ({filteredCharacters.length} matches)
                </p>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCharacterPage((page) => Math.max(1, page - 1))}
                    disabled={characterPage <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCharacterPage((page) => Math.min(characterTotalPages, page + 1))}
                    disabled={characterPage >= characterTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>

              <Dialog
                open={Boolean(selectedCharacterId)}
                onOpenChange={(open) => {
                  if (!open) {
                    setSelectedCharacterId(null);
                    setCharacterNodeDraft('');
                    setCharacterModalTab('progress');
                  }
                }}
              >
                <DialogContent className='max-h-[92vh] overflow-y-auto sm:max-w-3xl'>
                  {selectedCharacterId && (
                    <>
                      <DialogHeader>
                        <DialogTitle>
                          {characterMetaById[selectedCharacterId]?.nameEN ||
                            characterMetaById[selectedCharacterId]?.nameJP ||
                            characterMetaById[selectedCharacterId]?.faceCode ||
                            `Character ${selectedCharacterId}`}
                        </DialogTitle>
                        <DialogDescription className='font-mono'>ID {selectedCharacterId}</DialogDescription>
                      </DialogHeader>

                      <div className='space-y-4'>
                        <div className='rounded-xl border border-border/70 bg-gradient-to-r from-primary/10 via-background to-orange-500/10 p-3'>
                          <div className='flex flex-wrap items-start gap-3'>
                            <AssetThumb
                              urls={
                                characterMetaById[selectedCharacterId]
                                  ? buildCharacterThumbUrls(characterMetaById[selectedCharacterId].faceCode)
                                  : []
                              }
                              alt={`Character ${selectedCharacterId}`}
                              size={104}
                              pixelated={false}
                            />
                            <div className='min-w-0 flex-1 space-y-2'>
                              <div className='flex flex-wrap items-center gap-2'>
                                <Badge variant={selectedCharacter ? 'default' : 'secondary'}>
                                  {selectedCharacter ? 'Owned' : 'Unowned'}
                                </Badge>
                                <Badge variant='outline'>B1 {selectedCharacterBoardMeta.board1Nodes} nodes</Badge>
                                <Badge variant='outline'>
                                  {selectedCharacterBoardMeta.hasBoard2
                                    ? `B2 ${selectedCharacterBoardMeta.board2Nodes} nodes`
                                    : 'No Board 2'}
                                </Badge>
                              </div>
                              <p className='text-xs text-muted-foreground'>
                                Face code: {characterMetaById[selectedCharacterId]?.faceCode || 'Unknown'}
                              </p>
                              <p className='text-xs text-muted-foreground'>
                                Node level gates: MB1 80 | MB2 T4 {selectedCharacterTierRequirements[4] || 0} | MB2 T5+{' '}
                                {Math.max(selectedCharacterTierRequirements[5] || 0, selectedCharacterTierRequirements[6] || 0)}
                              </p>
                              <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
                                <div className='rounded-md border bg-background/50 p-2'>
                                  <p className='text-[10px] uppercase text-muted-foreground'>Board 1</p>
                                  <p className='text-sm font-semibold'>
                                    {selectedCharacterBoardProgress.board1Unlocked} / {selectedCharacterBoardMeta.board1Nodes}
                                  </p>
                                </div>
                                <div className='rounded-md border bg-background/50 p-2'>
                                  <p className='text-[10px] uppercase text-muted-foreground'>Board 2</p>
                                  <p className='text-sm font-semibold'>
                                    {selectedCharacterBoardProgress.board2Unlocked} / {selectedCharacterBoardMeta.board2Nodes}
                                  </p>
                                </div>
                                <div className='rounded-md border bg-background/50 p-2'>
                                  <p className='text-[10px] uppercase text-muted-foreground'>Node IDs</p>
                                  <p className='text-sm font-semibold'>{selectedCharacterNodeIds.length}</p>
                                </div>
                              </div>
                            </div>
                            <div className='flex flex-col gap-2'>
                              {!selectedCharacter && (
                                <Button
                                  onClick={() => {
                                    addCharacterById(selectedCharacterId);
                                    setCharacterNodeDraft(getCharacterNodeString(selectedCharacterId));
                                    setNotice({ type: 'success', message: `Character ${selectedCharacterId} added.` });
                                  }}
                                  disabled={!saveDocument}
                                >
                                  Add To Save
                                </Button>
                              )}
                              {selectedCharacter && (
                                <>
                                  <Button
                                    variant='secondary'
                                    onClick={() => maxCharacterById(selectedCharacterId)}
                                    disabled={!saveDocument}
                                  >
                                    Max Character
                                  </Button>
                                  <Button
                                    variant='secondary'
                                    onClick={() => maxCharacterManaBoardById(selectedCharacterId)}
                                    disabled={!saveDocument}
                                  >
                                    Max Mana Board
                                  </Button>
                                  <Button
                                    variant='outline'
                                    className='text-destructive hover:text-destructive'
                                    onClick={() => {
                                      removeCharacter(selectedCharacterId);
                                      setSelectedCharacterId(null);
                                      setCharacterNodeDraft('');
                                      setNotice({
                                        type: 'info',
                                        message: `Character ${selectedCharacterId} removed from save.`,
                                      });
                                    }}
                                    disabled={!saveDocument}
                                  >
                                    <Trash2 className='mr-2 h-4 w-4' />
                                    Remove
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className='flex flex-wrap gap-2'>
                          <Button
                            size='sm'
                            variant={characterModalTab === 'progress' ? 'default' : 'outline'}
                            onClick={() => setCharacterModalTab('progress')}
                          >
                            Progression
                          </Button>
                          <Button
                            size='sm'
                            variant={characterModalTab === 'abilities' ? 'default' : 'outline'}
                            onClick={() => setCharacterModalTab('abilities')}
                          >
                            Abilities
                          </Button>
                          <Button
                            size='sm'
                            variant={characterModalTab === 'nodes' ? 'default' : 'outline'}
                            onClick={() => setCharacterModalTab('nodes')}
                          >
                            Raw Nodes
                          </Button>
                        </div>

                        {!selectedCharacter && (
                          <div className='rounded-md border border-dashed p-3 text-sm text-muted-foreground'>
                            This character is not currently owned in the loaded save.
                          </div>
                        )}

                        {selectedCharacter && characterModalTab === 'progress' && (
                          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                            <div>
                              <p className='mb-1 text-[10px] uppercase text-muted-foreground'>Evolution</p>
                              <Input
                                type='number'
                                value={String(getNumberValue(selectedCharacter.evolution_level, 0))}
                                onChange={(event) =>
                                  handleCharacterFieldChange(selectedCharacterId, 'evolution_level', event.target.value)
                                }
                                disabled={!saveDocument}
                              />
                            </div>
                            <div>
                              <p className='mb-1 text-[10px] uppercase text-muted-foreground'>Over Limit</p>
                              <Input
                                type='number'
                                value={String(getNumberValue(selectedCharacter.over_limit_step, 0))}
                                onChange={(event) =>
                                  handleCharacterFieldChange(selectedCharacterId, 'over_limit_step', event.target.value)
                                }
                                disabled={!saveDocument}
                              />
                            </div>
                            <div>
                              <p className='mb-1 text-[10px] uppercase text-muted-foreground'>Mana Board Index</p>
                              <Input
                                type='number'
                                value={String(getNumberValue(selectedCharacter.mana_board_index, 1))}
                                onChange={(event) =>
                                  handleCharacterFieldChange(selectedCharacterId, 'mana_board_index', event.target.value)
                                }
                                disabled={!saveDocument}
                              />
                            </div>
                            <div className='sm:col-span-2 lg:col-span-3 rounded-md border bg-muted/20 p-3'>
                              <div className='mb-2 flex items-center justify-between'>
                                <p className='text-[10px] uppercase text-muted-foreground'>Level (EXP Sync)</p>
                                <Badge variant='outline'>Lv {selectedCharacterLevelStop}</Badge>
                              </div>
                              <Slider
                                min={0}
                                max={CHARACTER_LEVEL_STOPS.length - 1}
                                step={1}
                                value={[selectedCharacterLevelSliderIndex]}
                                onValueChange={(values) =>
                                  handleCharacterLevelStopChange(
                                    selectedCharacterId,
                                    getLevelStopFromSliderIndex(values[0] ?? 0)
                                  )
                                }
                                disabled={!saveDocument}
                              />
                              <div className='mt-2 grid grid-cols-5 gap-1'>
                                {CHARACTER_LEVEL_STOPS.map((levelStop) => {
                                  const active = levelStop === selectedCharacterLevelStop;
                                  return (
                                    <button
                                      key={levelStop}
                                      type='button'
                                      className={`rounded-md border px-1 py-1 text-[11px] font-semibold transition ${
                                        active
                                          ? 'border-primary/70 bg-primary/15 text-primary'
                                          : 'border-border bg-background/70 text-muted-foreground hover:bg-accent'
                                      }`}
                                      onClick={() => handleCharacterLevelStopChange(selectedCharacterId, levelStop)}
                                      disabled={!saveDocument}
                                    >
                                      {levelStop}
                                    </button>
                                  );
                                })}
                              </div>
                              <p className='mt-2 text-xs text-muted-foreground'>
                                EXP {getNumberValue(selectedCharacter.exp, 0).toLocaleString()} | Over Limit{' '}
                                {getNumberValue(selectedCharacter.over_limit_step, 0)} | Rarity {selectedCharacterRarity}
                              </p>
                            </div>
                            <div>
                              <p className='mb-1 text-[10px] uppercase text-muted-foreground'>Entry Count</p>
                              <Input
                                type='number'
                                value={String(getNumberValue(selectedCharacter.entry_count, 1))}
                                onChange={(event) =>
                                  handleCharacterFieldChange(selectedCharacterId, 'entry_count', event.target.value)
                                }
                                disabled={!saveDocument}
                              />
                            </div>
                            <div>
                              <p className='mb-1 text-[10px] uppercase text-muted-foreground'>Stack</p>
                              <Input
                                type='number'
                                value={String(getNumberValue(selectedCharacter.stack, 0))}
                                onChange={(event) => handleCharacterFieldChange(selectedCharacterId, 'stack', event.target.value)}
                                disabled={!saveDocument}
                              />
                            </div>
                            <div className='sm:col-span-2 lg:col-span-3 rounded-md border bg-muted/20 p-3'>
                              <div className='flex flex-wrap items-center justify-between gap-2'>
                                <div>
                                  <p className='text-[10px] uppercase text-muted-foreground'>EX Boost</p>
                                  <p className='text-xs text-muted-foreground'>
                                    Status + Slot A + Slot B flow, matching the EX Boost maker layout.
                                  </p>
                                </div>
                                <div className='flex items-center gap-2'>
                                  <Button
                                    size='sm'
                                    className='h-8 bg-blue-600 text-white hover:bg-blue-500'
                                    onClick={() => randomizeCharacterExBoost(selectedCharacterId)}
                                    disabled={
                                      !saveDocument ||
                                      exBoostStatusOptions.length === 0 ||
                                      !exBoostAbilityOptions.some((entry) => entry.slot === 'slot_a') ||
                                      !exBoostAbilityOptions.some((entry) => entry.slot === 'slot_b')
                                    }
                                  >
                                    Randomize
                                  </Button>
                                  <label className='flex items-center gap-2 text-xs font-medium'>
                                    <input
                                      type='checkbox'
                                      checked={Boolean(selectedCharacterExBoost)}
                                      onChange={(event) =>
                                        handleCharacterExBoostEnabledChange(selectedCharacterId, event.target.checked)
                                      }
                                      disabled={!saveDocument}
                                    />
                                    Enabled
                                  </label>
                                </div>
                              </div>
                              {selectedCharacterExBoost ? (
                                <div className='mt-3 grid gap-3 lg:grid-cols-3'>
                                  <div className='space-y-3 rounded-md border bg-background/60 p-3'>
                                    <div className='flex items-center justify-between gap-2'>
                                      <p className='text-sm font-semibold'>Status</p>
                                      <Badge
                                        className={`border ${getExBoostRarityBadgeTone(selectedCharacterExBoostStatusRarity)}`}
                                      >
                                        {selectedCharacterExBoostStatusRarity}★
                                      </Badge>
                                    </div>
                                    <div className='space-y-1'>
                                      <p className='text-[10px] uppercase text-muted-foreground'>Rarity</p>
                                      <Select
                                        value={String(selectedCharacterExBoostStatusRarity)}
                                        onValueChange={(value) =>
                                          handleCharacterExBoostStatusRarityChange(
                                            selectedCharacterId,
                                            toExBoostRarity(value, selectedCharacterExBoostStatusRarity)
                                          )
                                        }
                                        disabled={!saveDocument}
                                      >
                                        <SelectTrigger className='h-9'>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {EX_BOOST_RARITIES.map((rarity) => (
                                            <SelectItem key={rarity} value={String(rarity)}>
                                              {rarity}★
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className='space-y-1'>
                                      <p className='text-[10px] uppercase text-muted-foreground'>Status Type</p>
                                      <Select
                                        value={String(selectedCharacterExBoost.statusId)}
                                        onValueChange={(value) => handleCharacterExBoostStatusChange(selectedCharacterId, value)}
                                        disabled={!saveDocument}
                                      >
                                        <SelectTrigger className='h-9'>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {!exBoostStatusOptionIdSet.has(selectedCharacterExBoost.statusId) && (
                                            <SelectItem value={String(selectedCharacterExBoost.statusId)}>
                                              Current: {selectedCharacterExBoost.statusId}
                                            </SelectItem>
                                          )}
                                          {exBoostStatusOptionsForSelectedRarity.map((option) => (
                                            <SelectItem key={option.id} value={String(option.id)}>
                                              {option.label} (HP +{option.hp} / ATK +{option.atk})
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {selectedCharacterExBoostStatusMeta ? (
                                      <div className='rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground'>
                                        <p className='font-medium text-foreground'>{selectedCharacterExBoostStatusMeta.label}</p>
                                        <p>ID {selectedCharacterExBoostStatusMeta.id}</p>
                                        <p>
                                          HP +{selectedCharacterExBoostStatusMeta.hp} | ATK +{selectedCharacterExBoostStatusMeta.atk}
                                        </p>
                                      </div>
                                    ) : (
                                      <div className='rounded-md border border-dashed p-2 text-xs text-muted-foreground'>
                                        Unknown status ID {selectedCharacterExBoost.statusId}
                                      </div>
                                    )}
                                  </div>

                                  <div className='space-y-3 rounded-md border bg-background/60 p-3'>
                                    <div className='flex items-center justify-between gap-2'>
                                      <p className='text-sm font-semibold'>Slot A</p>
                                      <Badge className={`border ${getExBoostRarityBadgeTone(selectedCharacterExBoostSlotARarity)}`}>
                                        {selectedCharacterExBoostSlotARarity}★
                                      </Badge>
                                    </div>
                                    <div className='space-y-1'>
                                      <p className='text-[10px] uppercase text-muted-foreground'>Rarity</p>
                                      <Select
                                        value={String(selectedCharacterExBoostSlotARarity)}
                                        onValueChange={(value) =>
                                          handleCharacterExBoostAbilityRarityChange(
                                            selectedCharacterId,
                                            0,
                                            toExBoostRarity(value, selectedCharacterExBoostSlotARarity)
                                          )
                                        }
                                        disabled={!saveDocument}
                                      >
                                        <SelectTrigger className='h-9'>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {EX_BOOST_RARITIES.map((rarity) => (
                                            <SelectItem key={rarity} value={String(rarity)}>
                                              {rarity}★
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className='space-y-1'>
                                      <p className='text-[10px] uppercase text-muted-foreground'>Ability</p>
                                      <Select
                                        value={String(selectedCharacterExBoost.abilityIds[0])}
                                        onValueChange={(value) =>
                                          handleCharacterExBoostAbilityChange(selectedCharacterId, 0, value)
                                        }
                                        disabled={!saveDocument}
                                      >
                                        <SelectTrigger className='h-9'>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {!exBoostAbilityOptionIdSet.has(selectedCharacterExBoost.abilityIds[0]) && (
                                            <SelectItem value={String(selectedCharacterExBoost.abilityIds[0])}>
                                              Current: {selectedCharacterExBoost.abilityIds[0]}
                                            </SelectItem>
                                          )}
                                          {exBoostSlotAOptionsForSelectedRarity.map((option) => (
                                            <SelectItem key={option.id} value={String(option.id)}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {selectedCharacterExBoostSlotAMeta ? (
                                      <div className='rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground'>
                                        <p className='font-medium text-foreground'>{selectedCharacterExBoostSlotAMeta.label}</p>
                                        <p>ID {selectedCharacterExBoostSlotAMeta.id}</p>
                                        <p>Value +{selectedCharacterExBoostSlotAMeta.value}</p>
                                      </div>
                                    ) : (
                                      <div className='rounded-md border border-dashed p-2 text-xs text-muted-foreground'>
                                        Unknown ability ID {selectedCharacterExBoost.abilityIds[0]}
                                      </div>
                                    )}
                                  </div>

                                  <div className='space-y-3 rounded-md border bg-background/60 p-3'>
                                    <div className='flex items-center justify-between gap-2'>
                                      <p className='text-sm font-semibold'>Slot B</p>
                                      <Badge className={`border ${getExBoostRarityBadgeTone(selectedCharacterExBoostSlotBRarity)}`}>
                                        {selectedCharacterExBoostSlotBRarity}★
                                      </Badge>
                                    </div>
                                    <div className='space-y-1'>
                                      <p className='text-[10px] uppercase text-muted-foreground'>Rarity</p>
                                      <Select
                                        value={String(selectedCharacterExBoostSlotBRarity)}
                                        onValueChange={(value) =>
                                          handleCharacterExBoostAbilityRarityChange(
                                            selectedCharacterId,
                                            1,
                                            toExBoostRarity(value, selectedCharacterExBoostSlotBRarity)
                                          )
                                        }
                                        disabled={!saveDocument}
                                      >
                                        <SelectTrigger className='h-9'>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {EX_BOOST_RARITIES.map((rarity) => (
                                            <SelectItem key={rarity} value={String(rarity)}>
                                              {rarity}★
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className='space-y-1'>
                                      <p className='text-[10px] uppercase text-muted-foreground'>Ability</p>
                                      <Select
                                        value={String(selectedCharacterExBoost.abilityIds[1])}
                                        onValueChange={(value) =>
                                          handleCharacterExBoostAbilityChange(selectedCharacterId, 1, value)
                                        }
                                        disabled={!saveDocument}
                                      >
                                        <SelectTrigger className='h-9'>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {!exBoostAbilityOptionIdSet.has(selectedCharacterExBoost.abilityIds[1]) && (
                                            <SelectItem value={String(selectedCharacterExBoost.abilityIds[1])}>
                                              Current: {selectedCharacterExBoost.abilityIds[1]}
                                            </SelectItem>
                                          )}
                                          {exBoostSlotBOptionsForSelectedRarity.map((option) => (
                                            <SelectItem key={option.id} value={String(option.id)}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {selectedCharacterExBoostSlotBMeta ? (
                                      <div className='rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground'>
                                        <p className='font-medium text-foreground'>{selectedCharacterExBoostSlotBMeta.label}</p>
                                        <p>ID {selectedCharacterExBoostSlotBMeta.id}</p>
                                        <p>Value +{selectedCharacterExBoostSlotBMeta.value}</p>
                                      </div>
                                    ) : (
                                      <div className='rounded-md border border-dashed p-2 text-xs text-muted-foreground'>
                                        Unknown ability ID {selectedCharacterExBoost.abilityIds[1]}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className='mt-2 text-xs text-muted-foreground'>
                                  Enable EX Boost to attach status and ability data for this unit.
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedCharacter && characterModalTab === 'abilities' && (
                          <div className='space-y-3 rounded-lg border bg-muted/10 p-3'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                              <div>
                                <p className='text-xs uppercase tracking-wide text-muted-foreground'>Ability Tracks</p>
                                <p className='text-xs text-muted-foreground'>
                                  Parsed from mana node slot indexes, matching the classic save editor flow.
                                </p>
                              </div>
                              <div className='flex flex-wrap gap-2'>
                                <Button
                                  size='sm'
                                  variant='secondary'
                                  onClick={() => setAllCharacterAbilityTracks(selectedCharacterId, 'max')}
                                  disabled={!saveDocument}
                                >
                                  Max Tracks
                                </Button>
                                <Button
                                  size='sm'
                                  variant='outline'
                                  onClick={() => setAllCharacterAbilityTracks(selectedCharacterId, 'clear')}
                                  disabled={!saveDocument}
                                >
                                  Clear Tracks
                                </Button>
                              </div>
                            </div>

                            <div className='grid gap-3 lg:grid-cols-2'>
                              {selectedCharacterAbilityTracks.map((track) => {
                                const maxLevel = track.availableNodeIds.length - 1;
                                return (
                                  <div key={track.key} className='rounded-md border bg-background/50 p-2'>
                                    <div className='mb-2 flex items-center justify-between gap-2'>
                                      <p className='text-sm font-semibold'>{track.label}</p>
                                      <Badge variant='outline'>
                                        {maxLevel >= 0 ? `${Math.max(track.currentLevel + 1, 0)}/${track.availableNodeIds.length}` : 'N/A'}
                                      </Badge>
                                    </div>
                                    {track.description && (
                                      <p className='mb-2 text-xs text-muted-foreground'>{track.description}</p>
                                    )}
                                    {track.availableNodeIds.length === 0 ? (
                                      <p className='text-xs text-muted-foreground'>Not available for this unit.</p>
                                    ) : (
                                      <div className='flex flex-wrap gap-1'>
                                        {track.availableNodeIds.map((nodeId, index) => {
                                          const active = track.currentLevel >= index;
                                          const nextLevel = active && track.currentLevel === index ? index - 1 : index;
                                          return (
                                            <button
                                              key={nodeId}
                                              type='button'
                                              className={`h-8 min-w-8 rounded-md border px-2 text-xs font-semibold transition ${
                                                active
                                                  ? 'border-primary/60 bg-primary/15 text-primary'
                                                  : 'border-border bg-background hover:bg-accent'
                                              }`}
                                              onClick={() => setCharacterAbilityTrackLevel(selectedCharacterId, track.slots, nextLevel)}
                                              disabled={!saveDocument}
                                              title={`Node ${nodeId}`}
                                            >
                                              {index}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {selectedCharacter && characterModalTab === 'nodes' && (
                          <div className='rounded-md border bg-muted/10 p-3'>
                            <p className='text-xs uppercase tracking-wide text-muted-foreground'>Raw Mana Board Nodes</p>
                            <p className='mb-2 text-xs text-muted-foreground'>Enter node IDs separated by commas or spaces.</p>
                            <textarea
                              value={characterNodeDraft}
                              onChange={(event) => setCharacterNodeDraft(event.target.value)}
                              className='h-36 w-full resize-y rounded-md border bg-background p-2 font-mono text-xs outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring'
                              placeholder='2201, 2202, 2203'
                              spellCheck={false}
                              disabled={!saveDocument}
                            />
                            <div className='mt-2 flex flex-wrap gap-2'>
                              <Button
                                size='sm'
                                onClick={() => updateCharacterNodes(selectedCharacterId, characterNodeDraft)}
                                disabled={!saveDocument}
                              >
                                Apply Nodes
                              </Button>
                              <Button
                                size='sm'
                                variant='outline'
                                onClick={() => {
                                  setCharacterNodeDraft('');
                                  updateCharacterNodes(selectedCharacterId, '');
                                }}
                                disabled={!saveDocument}
                              >
                                Clear Nodes
                              </Button>
                            </div>
                            {selectedCharacterBoardProgress.otherUnlocked > 0 && (
                              <p className='mt-2 text-xs text-amber-500'>
                                {selectedCharacterBoardProgress.otherUnlocked} node IDs do not match standard board ranges.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}
        {activeTab === 'items' && (
          <Card className='border-border/60 bg-background/90'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Items</CardTitle>
              <CardDescription>Item gallery with icon cards and quantity editing.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex flex-wrap gap-2'>
                <div className='relative min-w-[220px] flex-1'>
                  <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    placeholder='Search item ID or name...'
                    className='pl-9'
                    disabled={!saveDocument}
                  />
                </div>
                <Input
                  value={newItemId}
                  onChange={(event) => setNewItemId(event.target.value)}
                  placeholder='Item ID'
                  className='w-[140px]'
                  disabled={!saveDocument}
                />
                <Input
                  value={newItemQuantity}
                  onChange={(event) => setNewItemQuantity(event.target.value)}
                  placeholder='Qty'
                  className='w-[120px]'
                  disabled={!saveDocument}
                />
                <Button onClick={addItem} className='gap-2' disabled={!saveDocument}>
                  <Plus className='h-4 w-4' />
                  Set
                </Button>
                <Button variant='secondary' onClick={() => setVisibleItems(1)} disabled={!saveDocument}>
                  Set Visible 1
                </Button>
                <Button variant='secondary' onClick={() => setVisibleItems(9999)} disabled={!saveDocument}>
                  Set Visible 9999
                </Button>
                <Button variant='outline' onClick={() => setVisibleItems(0)} disabled={!saveDocument}>
                  Zero Visible
                </Button>
                <Button variant='outline' onClick={removeZeroQuantityItems} disabled={!saveDocument}>
                  Remove Zero Entries
                </Button>
                <div className='flex items-center gap-1 rounded-md border bg-muted/20 p-1'>
                  {([
                    { key: 'all', label: 'All', dot: 'bg-muted-foreground' },
                    { key: 'owned', label: 'Owned', dot: 'bg-emerald-400' },
                    { key: 'unowned', label: 'Unowned', dot: 'bg-slate-400' },
                  ] as Array<{ key: ItemOwnedFilter; label: string; dot: string }>).map((option) => (
                    <button
                      key={option.key}
                      type='button'
                      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition ${
                        itemOwnedFilter === option.key
                          ? 'bg-background font-semibold text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setItemOwnedFilter(option.key)}
                      disabled={!saveDocument}
                    >
                      <span className={`h-2 w-2 rounded-full ${option.dot}`} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className='grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12'>
                {visibleItemIds.map((id) => {
                  const quantity = itemQuantityById[id] ?? 0;
                  const owned = ownedItemIds.has(id);
                  const meta = itemMetaById[id];
                  const displayName = meta?.name || `Item ${id}`;
                  const thumbUrls = [toCdnUrl(meta?.thumbnail || ''), toCdnUrl(meta?.icon || '')].filter(Boolean);

                  return (
                    <button
                      key={id}
                      type='button'
                      onClick={() => openItemEditor(id)}
                      onContextMenu={(event) => openItemContextMenu(event, id)}
                      className={`group relative aspect-square overflow-hidden rounded-md border p-1 text-center transition ${
                        owned
                          ? 'border-primary/50 bg-primary/10 shadow-[0_0_0_1px_rgba(59,130,246,0.18)] hover:bg-primary/15'
                          : 'border-border/50 bg-muted/20 opacity-45 grayscale hover:opacity-80 hover:grayscale-0'
                      }`}
                      disabled={!saveDocument}
                      title={`ID ${id}`}
                    >
                      {owned && (
                        <span className='absolute right-1 top-1 inline-flex min-w-[44px] items-center justify-end rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-mono font-semibold leading-none tabular-nums text-foreground shadow-sm'>
                          x{quantity}
                        </span>
                      )}
                      <div className='flex h-full w-full flex-col items-center justify-center gap-1.5'>
                        <AssetThumb urls={thumbUrls} alt={displayName} size={60} pixelated />
                        <div className='w-full rounded bg-background/70 px-1 py-0.5'>
                          <p className='truncate text-[10px] font-medium leading-none tracking-tight text-foreground/90'>
                            {displayName}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {visibleItemIds.length === 0 && (
                  <div className='col-span-full rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
                    No matching items.
                  </div>
                )}
              </div>

              {itemContextMenuEntry && (
                <div
                  ref={itemContextMenuRef}
                  role='menu'
                  className='fixed z-[70] w-56 rounded-md border bg-background/95 p-1 shadow-2xl backdrop-blur'
                  style={{ left: itemContextMenuPosition.left, top: itemContextMenuPosition.top }}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <div className='px-2 py-1.5'>
                    <p className='truncate text-xs font-semibold'>{itemContextMenuEntry.name}</p>
                    <p className='font-mono text-[10px] text-muted-foreground'>
                      ID {itemContextMenuEntry.id}{' '}
                      {itemContextMenuEntry.owned ? `| x${itemContextMenuEntry.quantity}` : '| Unowned'}
                    </p>
                  </div>
                  <div className='my-1 h-px bg-border' />
                  <button
                    type='button'
                    className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent'
                    onClick={() => applyItemContextDelta(itemContextMenuEntry.id, 1)}
                  >
                    +1
                  </button>
                  <button
                    type='button'
                    className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent'
                    onClick={() => applyItemContextDelta(itemContextMenuEntry.id, -1)}
                  >
                    -1
                  </button>
                  <button
                    type='button'
                    className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent'
                    onClick={() => applyItemContextQuantity(itemContextMenuEntry.id, 0, `Item ${itemContextMenuEntry.id} set to 0.`)}
                  >
                    Set 0
                  </button>
                  <button
                    type='button'
                    className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent'
                    onClick={() =>
                      applyItemContextQuantity(itemContextMenuEntry.id, 99, `Item ${itemContextMenuEntry.id} set to 99.`)
                    }
                  >
                    Set 99
                  </button>
                  <button
                    type='button'
                    className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent'
                    onClick={() =>
                      applyItemContextQuantity(itemContextMenuEntry.id, 9999, `Item ${itemContextMenuEntry.id} set to 9999.`)
                    }
                  >
                    Set 9999
                  </button>
                  <div className='my-1 h-px bg-border' />
                  <button
                    type='button'
                    className='w-full rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50'
                    onClick={() => {
                      removeItemEntry(itemContextMenuEntry.id);
                      setNotice({ type: 'info', message: `Item ${itemContextMenuEntry.id} removed from save.` });
                      closeItemContextMenu();
                    }}
                    disabled={!itemContextMenuEntry.owned}
                  >
                    Remove Entry
                  </button>
                  <button
                    type='button'
                    className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent'
                    onClick={() => void copyItemIdToClipboard(itemContextMenuEntry.id)}
                  >
                    Copy ID
                  </button>
                </div>
              )}

              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                <p>
                  Owned in save (catalog list): {itemEntries.length} / {allItemIds.length} listed items
                </p>
              </div>

              <div className='flex items-center justify-between'>
                <p className='text-sm text-muted-foreground'>
                  Showing page {itemPage} / {itemTotalPages} ({filteredItemIds.length} matches)
                </p>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setItemPage((page) => Math.max(1, page - 1))}
                    disabled={itemPage <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setItemPage((page) => Math.min(itemTotalPages, page + 1))}
                    disabled={itemPage >= itemTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>

              <Dialog open={Boolean(selectedItemId)} onOpenChange={(open) => !open && setSelectedItemId(null)}>
                <DialogContent className='max-h-[88vh] overflow-y-auto sm:max-w-xl'>
                  {selectedItemId && (
                    <div className='space-y-4'>
                      <DialogHeader>
                        <DialogTitle>{selectedItemDisplayName}</DialogTitle>
                        <DialogDescription className='font-mono'>ID {selectedItemId}</DialogDescription>
                      </DialogHeader>

                      <div className='rounded-lg border bg-muted/20 p-3'>
                        <div className='flex flex-wrap items-start justify-between gap-3'>
                          <div className='flex items-start gap-3'>
                            <AssetThumb urls={selectedItemThumbUrls} alt={selectedItemDisplayName} size={92} pixelated />
                            <div className='space-y-2'>
                              <div className='flex flex-wrap gap-2'>
                                <Badge variant={selectedItemOwned ? 'default' : 'secondary'}>
                                  {selectedItemOwned ? 'Owned' : 'Unowned'}
                                </Badge>
                                <Badge variant='outline'>{selectedItemMeta?.type ?? 'item'}</Badge>
                              </div>
                              <p className='text-xs text-muted-foreground'>
                                Set quantity directly or use presets below.
                              </p>
                            </div>
                          </div>
                          <div className='flex flex-wrap gap-2'>
                            {!selectedItemOwned && (
                              <Button
                                size='sm'
                                onClick={() => {
                                  handleItemQuantityChange(selectedItemId, '1');
                                  setNotice({ type: 'success', message: `Item ${selectedItemId} added with quantity 1.` });
                                }}
                                disabled={!saveDocument}
                              >
                                Add To Save
                              </Button>
                            )}
                            {selectedItemOwned && (
                              <Button
                                size='sm'
                                variant='outline'
                                className='text-destructive hover:text-destructive'
                                onClick={() => {
                                  removeItemEntry(selectedItemId);
                                  setNotice({ type: 'info', message: `Item ${selectedItemId} removed from save.` });
                                }}
                                disabled={!saveDocument}
                              >
                                <Trash2 className='mr-2 h-4 w-4' />
                                Remove
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className='rounded-md border bg-muted/20 p-3'>
                        <p className='mb-1 text-[10px] uppercase tracking-wide text-muted-foreground'>Quantity</p>
                        <Input
                          type='number'
                          value={String(selectedItemQuantity)}
                          onChange={(event) => handleItemQuantityChange(selectedItemId, event.target.value)}
                          disabled={!saveDocument}
                        />
                        <div className='mt-2 grid grid-cols-5 gap-2'>
                          {([0, 1, 99, 999, 9999] as number[]).map((qty) => {
                            const active = selectedItemQuantity === qty;
                            return (
                              <button
                                key={qty}
                                type='button'
                                className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${
                                  active
                                    ? 'border-primary/60 bg-primary/15 text-primary'
                                    : 'border-border bg-background hover:bg-accent'
                                }`}
                                onClick={() => handleItemQuantityChange(selectedItemId, String(qty))}
                                disabled={!saveDocument}
                              >
                                {qty}
                              </button>
                            );
                          })}
                        </div>
                        <div className='mt-2 flex flex-wrap gap-2'>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() =>
                              handleItemQuantityChange(selectedItemId, String(Math.max(0, selectedItemQuantity - 1)))
                            }
                            disabled={!saveDocument}
                          >
                            -1
                          </Button>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => handleItemQuantityChange(selectedItemId, String(selectedItemQuantity + 1))}
                            disabled={!saveDocument}
                          >
                            +1
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {activeTab === 'equipment' && (
          <Card className='border-border/60 bg-background/90'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Equipment</CardTitle>
              <CardDescription>
                Icon collection view. Owned equipment is lit; unowned is dimmed. Click any icon to edit details.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex flex-wrap gap-2'>
                <div className='relative min-w-[220px] flex-1'>
                  <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    value={equipmentSearch}
                    onChange={(event) => setEquipmentSearch(event.target.value)}
                    placeholder='Search equipment ID or name...'
                    className='pl-9'
                    disabled={!saveDocument}
                  />
                </div>
                <Input
                  value={newEquipmentId}
                  onChange={(event) => setNewEquipmentId(event.target.value)}
                  placeholder='Equipment ID'
                  className='w-[160px]'
                  disabled={!saveDocument}
                />
                <Button onClick={addEquipment} className='gap-2' disabled={!saveDocument}>
                  <Plus className='h-4 w-4' />
                  Add
                </Button>
                <Button variant='secondary' onClick={maxVisibleEquipment} disabled={!saveDocument}>
                  Max Visible Owned
                </Button>
                <Button
                  variant='outline'
                  onClick={() => setVisibleOwnedEquipmentProtection(true)}
                  disabled={!saveDocument}
                >
                  Lock Visible Owned
                </Button>
                <Button
                  variant='outline'
                  onClick={() => setVisibleOwnedEquipmentProtection(false)}
                  disabled={!saveDocument}
                >
                  Unlock Visible Owned
                </Button>
                <div className='flex items-center gap-1 rounded-md border bg-muted/20 p-1'>
                  {([
                    { key: 'all', label: 'All', dot: 'bg-muted-foreground' },
                    { key: 'owned', label: 'Owned', dot: 'bg-emerald-400' },
                    { key: 'unowned', label: 'Unowned', dot: 'bg-slate-400' },
                  ] as Array<{ key: EquipmentOwnedFilter; label: string; dot: string }>).map((option) => (
                    <button
                      key={option.key}
                      type='button'
                      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition ${
                        equipmentOwnedFilter === option.key
                          ? 'bg-background font-semibold text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setEquipmentOwnedFilter(option.key)}
                      disabled={!saveDocument}
                    >
                      <span className={`h-2 w-2 rounded-full ${option.dot}`} />
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className='flex items-center gap-1 rounded-md border bg-muted/20 p-1'>
                  {([
                    { key: 'all', label: 'All Status', dot: 'bg-muted-foreground' },
                    { key: 'blue', label: 'Blue', dot: 'bg-sky-400' },
                    { key: 'red', label: 'Red', dot: 'bg-red-500' },
                    { key: 'gold', label: 'Gold', dot: 'bg-amber-400' },
                  ] as Array<{ key: EquipmentBorderFilter; label: string; dot: string }>).map((option) => (
                    <button
                      key={option.key}
                      type='button'
                      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition ${
                        equipmentBorderFilter === option.key
                          ? 'bg-background font-semibold text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setEquipmentBorderFilter(option.key)}
                      disabled={!saveDocument}
                    >
                      <span className={`h-2 w-2 rounded-full ${option.dot}`} />
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className='flex items-center gap-1 rounded-md border bg-muted/20 p-1'>
                  {([
                    { key: 'all', label: 'All Lock', dot: 'bg-muted-foreground' },
                    { key: 'protected', label: 'Locked', dot: 'bg-emerald-400' },
                    { key: 'unprotected', label: 'Unlocked', dot: 'bg-slate-400' },
                  ] as Array<{ key: EquipmentProtectionFilter; label: string; dot: string }>).map((option) => (
                    <button
                      key={option.key}
                      type='button'
                      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition ${
                        equipmentProtectionFilter === option.key
                          ? 'bg-background font-semibold text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setEquipmentProtectionFilter(option.key)}
                      disabled={!saveDocument}
                    >
                      <span className={`h-2 w-2 rounded-full ${option.dot}`} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className='grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12'>
                {visibleEquipmentIds.map((id) => {
                  const equipment = equipmentById[id];
                  const owned = ownedEquipmentIds.has(id);
                  const meta = itemMetaById[id];
                  const displayName = meta?.name || `Equipment ${id}`;
                  const thumbUrls = [toCdnUrl(meta?.thumbnail || ''), toCdnUrl(meta?.icon || '')].filter(Boolean);
                  const levelPoint = equipment
                    ? getEquipmentLevelPointFromSaveLevel(getNumberValue(equipment.level, EQUIPMENT_SAVE_LEVEL_MIN))
                    : 0;
                  const enhanceable = (equipmentEnhancementOptionsById[id] ?? []).length > 0;
                  const enhancementStatus = equipment ? getNumberValue(equipment.enhancement_level, 0) : 0;
                  const tone = equipmentBorderToneById[id] ?? 'default';
                  const ownedClass =
                    tone === 'gold'
                      ? 'border-amber-400/70 bg-amber-400/10 shadow-[0_0_0_1px_rgba(251,191,36,0.35)] hover:bg-amber-400/15'
                      : tone === 'red'
                        ? 'border-red-500/70 bg-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.35)] hover:bg-red-500/15'
                        : tone === 'blue'
                          ? 'border-sky-400/70 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.32)] hover:bg-sky-500/15'
                          : 'border-primary/50 bg-primary/10 shadow-[0_0_0_1px_rgba(59,130,246,0.18)] hover:bg-primary/15';

                  return (
                    <button
                      key={id}
                      type='button'
                      onClick={() => openEquipmentEditor(id)}
                      onContextMenu={(event) => openEquipmentContextMenu(event, id)}
                      className={`group flex flex-col items-center rounded-md border p-1 text-center transition ${
                        owned ? ownedClass : 'border-border/50 bg-muted/20 opacity-45 grayscale hover:opacity-80 hover:grayscale-0'
                      }`}
                      disabled={!saveDocument}
                      title={`ID ${id}`}
                    >
                      <AssetThumb urls={thumbUrls} alt={displayName} size={68} pixelated />
                      <p className='mt-1 w-full truncate text-[10px] text-muted-foreground'>{displayName}</p>
                      {equipment && (
                        <p className='text-[10px] text-muted-foreground'>
                          {levelPoint}/{EQUIPMENT_LEVEL_POINT_MAX}
                          {enhanceable ? ` | ${enhancementStatus === 0 ? 'Base' : `Enh ${enhancementStatus}`}` : ''}
                        </p>
                      )}
                    </button>
                  );
                })}
                {visibleEquipmentIds.length === 0 && (
                  <div className='col-span-full rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
                    No matching equipment.
                  </div>
                )}
              </div>

              {equipmentContextMenuEntry && (
                <div
                  ref={equipmentContextMenuRef}
                  role='menu'
                  className='fixed z-[70] w-72 rounded-md border bg-background/95 p-1 shadow-2xl backdrop-blur'
                  style={{ left: equipmentContextMenuPosition.left, top: equipmentContextMenuPosition.top }}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <div className='px-2 py-1.5'>
                    <p className='truncate text-xs font-semibold'>{equipmentContextMenuEntry.name}</p>
                    <p className='font-mono text-[10px] text-muted-foreground'>
                      ID {equipmentContextMenuEntry.id} |{' '}
                      {equipmentContextMenuEntry.owned
                        ? `${equipmentContextMenuEntry.levelPoint}/${EQUIPMENT_LEVEL_POINT_MAX}`
                        : 'Unowned'}{' '}
                      |{' '}
                      {equipmentContextMenuEntry.enhanceable
                        ? equipmentContextMenuEntry.enhancementStatus === 0
                          ? 'Base'
                          : `Enh ${equipmentContextMenuEntry.enhancementStatus}`
                        : 'No Enh'}
                    </p>
                  </div>
                  <div className='my-1 h-px bg-border' />
                  <button
                    type='button'
                    className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent'
                    onClick={() => {
                      openEquipmentEditor(equipmentContextMenuEntry.id);
                      closeEquipmentContextMenu();
                    }}
                    disabled={!saveDocument}
                  >
                    Open Full Editor
                  </button>
                  {!equipmentContextMenuEntry.owned ? (
                    <button
                      type='button'
                      className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent'
                      onClick={() => {
                        const added = addEquipmentById(equipmentContextMenuEntry.id);
                        if (added) {
                          setNotice({ type: 'success', message: `Equipment ${equipmentContextMenuEntry.id} added.` });
                        }
                        closeEquipmentContextMenu();
                      }}
                      disabled={!saveDocument}
                    >
                      Add To Save
                    </button>
                  ) : (
                    <button
                      type='button'
                      className='w-full rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10'
                      onClick={() => {
                        removeEquipment(equipmentContextMenuEntry.id);
                        setNotice({ type: 'info', message: `Equipment ${equipmentContextMenuEntry.id} removed.` });
                        closeEquipmentContextMenu();
                      }}
                      disabled={!saveDocument}
                    >
                      Remove Entry
                    </button>
                  )}
                  <button
                    type='button'
                    className='w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent'
                    onClick={() => void copyEquipmentIdToClipboard(equipmentContextMenuEntry.id)}
                  >
                    Copy ID
                  </button>
                  <div className='my-1 h-px bg-border' />
                  <div className='px-2 pb-1 pt-0.5'>
                    <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Preset</p>
                    <div className='mt-1 grid grid-cols-3 gap-1'>
                      <button
                        type='button'
                        className='rounded border px-1 py-1 text-[11px] hover:bg-accent'
                        onClick={() => applyEquipmentContextPreset(equipmentContextMenuEntry.id, 'min')}
                        disabled={!saveDocument}
                      >
                        Min
                      </button>
                      <button
                        type='button'
                        className='rounded border px-1 py-1 text-[11px] hover:bg-accent'
                        onClick={() => applyEquipmentContextPreset(equipmentContextMenuEntry.id, 'max')}
                        disabled={!saveDocument}
                      >
                        Max
                      </button>
                      <button
                        type='button'
                        className='rounded border px-1 py-1 text-[11px] hover:bg-accent'
                        onClick={() => applyEquipmentContextPreset(equipmentContextMenuEntry.id, 'max_lock')}
                        disabled={!saveDocument}
                      >
                        Max+Lock
                      </button>
                    </div>
                  </div>
                  <div className='my-1 h-px bg-border' />
                  <div className='px-2 pb-1 pt-0.5'>
                    <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Level Point</p>
                    <div className='mt-1 grid grid-cols-5 gap-1'>
                      {EQUIPMENT_LEVEL_POINTS.map((levelPoint) => {
                        const active = equipmentContextMenuEntry.levelPoint === levelPoint;
                        return (
                          <button
                            key={levelPoint}
                            type='button'
                            className={`rounded border px-1 py-1 text-[11px] transition ${
                              active
                                ? 'border-primary/70 bg-primary/15 text-primary'
                                : 'border-border bg-background/70 text-muted-foreground hover:bg-accent'
                            }`}
                            onClick={() => applyEquipmentContextLevelPoint(equipmentContextMenuEntry.id, levelPoint)}
                            disabled={!saveDocument}
                          >
                            {levelPoint}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className='my-1 h-px bg-border' />
                  <div className='px-2 pb-1 pt-0.5'>
                    <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>Enhancement</p>
                    {equipmentContextMenuEntry.enhanceable ? (
                      <div className='mt-1 grid grid-cols-6 gap-1'>
                        {equipmentContextMenuEntry.enhancementSelectableValues.map((status) => {
                          const active = equipmentContextMenuEntry.enhancementStatus === status;
                          return (
                            <button
                              key={status}
                              type='button'
                              className={`rounded border px-1 py-1 text-[11px] transition ${
                                active
                                  ? 'border-primary/70 bg-primary/15 text-primary'
                                  : 'border-border bg-background/70 text-muted-foreground hover:bg-accent'
                              }`}
                              onClick={() => applyEquipmentContextEnhancement(equipmentContextMenuEntry.id, status)}
                              disabled={!saveDocument}
                            >
                              {status === 0 ? 'B' : status}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className='mt-1 text-[11px] text-muted-foreground'>No enhancement options.</p>
                    )}
                  </div>
                  <div className='my-1 h-px bg-border' />
                  <div className='grid grid-cols-2 gap-1 px-2 pb-1 pt-0.5'>
                    <button
                      type='button'
                      className={`rounded border px-1 py-1 text-[11px] transition ${
                        equipmentContextMenuEntry.protected
                          ? 'border-emerald-500/70 bg-emerald-500/15 text-emerald-300'
                          : 'border-border bg-background/70 text-muted-foreground hover:bg-accent'
                      }`}
                      onClick={() => applyEquipmentContextProtection(equipmentContextMenuEntry.id, true)}
                      disabled={!saveDocument}
                    >
                      Lock
                    </button>
                    <button
                      type='button'
                      className={`rounded border px-1 py-1 text-[11px] transition ${
                        !equipmentContextMenuEntry.protected
                          ? 'border-primary/70 bg-primary/15 text-primary'
                          : 'border-border bg-background/70 text-muted-foreground hover:bg-accent'
                      }`}
                      onClick={() => applyEquipmentContextProtection(equipmentContextMenuEntry.id, false)}
                      disabled={!saveDocument}
                    >
                      Unlock
                    </button>
                  </div>
                  <div className='my-1 h-px bg-border' />
                  <div className='grid grid-cols-1 gap-1 px-2 pb-1 pt-0.5'>
                    <button
                      type='button'
                      className='rounded border px-1 py-1 text-left text-[11px] hover:bg-accent disabled:opacity-50'
                      onClick={() => {
                        maxVisibleEquipment();
                        closeEquipmentContextMenu();
                      }}
                      disabled={!saveDocument || visibleOwnedEquipmentIds.length === 0}
                    >
                      Max Visible Owned
                    </button>
                    <button
                      type='button'
                      className='rounded border px-1 py-1 text-left text-[11px] hover:bg-accent disabled:opacity-50'
                      onClick={() => {
                        setVisibleOwnedEquipmentProtection(true);
                        closeEquipmentContextMenu();
                      }}
                      disabled={!saveDocument || visibleOwnedEquipmentIds.length === 0}
                    >
                      Lock Visible Owned
                    </button>
                    <button
                      type='button'
                      className='rounded border px-1 py-1 text-left text-[11px] hover:bg-accent disabled:opacity-50'
                      onClick={() => {
                        setVisibleOwnedEquipmentProtection(false);
                        closeEquipmentContextMenu();
                      }}
                      disabled={!saveDocument || visibleOwnedEquipmentIds.length === 0}
                    >
                      Unlock Visible Owned
                    </button>
                  </div>
                </div>
              )}

              <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
                <span className='inline-flex items-center gap-1.5 rounded-md border px-2 py-1'>
                  <span className='h-2 w-2 rounded-full bg-sky-400' />
                  Blue: Level 4/4
                </span>
                <span className='inline-flex items-center gap-1.5 rounded-md border px-2 py-1'>
                  <span className='h-2 w-2 rounded-full bg-red-500' />
                  Red: Enhanced, level below 4/4
                </span>
                <span className='inline-flex items-center gap-1.5 rounded-md border px-2 py-1'>
                  <span className='h-2 w-2 rounded-full bg-amber-400' />
                  Gold: 4/4 and enhanced
                </span>
              </div>

              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                <p>
                  Owned in save (catalog list): {equipmentEntries.length} / {allEquipmentIds.length} listed equipment
                </p>
              </div>

              <div className='flex items-center justify-between'>
                <p className='text-sm text-muted-foreground'>
                  Showing page {equipmentPage} / {equipmentTotalPages} ({filteredEquipmentIds.length} matches)
                </p>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setEquipmentPage((page) => Math.max(1, page - 1))}
                    disabled={equipmentPage <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setEquipmentPage((page) => Math.min(equipmentTotalPages, page + 1))}
                    disabled={equipmentPage >= equipmentTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>

              <Dialog open={Boolean(selectedEquipmentId)} onOpenChange={(open) => !open && setSelectedEquipmentId(null)}>
                <DialogContent className='max-h-[88vh] overflow-y-auto sm:max-w-2xl'>
                  {selectedEquipmentId && (
                    <div className='space-y-4'>
                      <DialogHeader>
                        <DialogTitle>
                          {itemMetaById[selectedEquipmentId]?.name || `Equipment ${selectedEquipmentId}`}
                        </DialogTitle>
                        <DialogDescription className='font-mono'>ID {selectedEquipmentId}</DialogDescription>
                      </DialogHeader>

                      <div className='rounded-lg border bg-muted/20 p-3'>
                        <div className='flex flex-wrap items-start justify-between gap-3'>
                          <div className='flex items-start gap-3'>
                            <AssetThumb
                              urls={[
                                toCdnUrl(itemMetaById[selectedEquipmentId]?.thumbnail || ''),
                                toCdnUrl(itemMetaById[selectedEquipmentId]?.icon || ''),
                              ].filter(Boolean)}
                              alt={itemMetaById[selectedEquipmentId]?.name || `Equipment ${selectedEquipmentId}`}
                              size={92}
                              pixelated
                            />
                            <div className='space-y-2'>
                              <div className='flex flex-wrap gap-2'>
                                <Badge variant={selectedEquipment ? 'default' : 'secondary'}>
                                  {selectedEquipment ? 'Owned' : 'Unowned'}
                                </Badge>
                                <Badge variant='outline'>
                                  Tone {equipmentBorderToneById[selectedEquipmentId] ?? 'default'}
                                </Badge>
                              </div>
                              <p className='text-xs text-muted-foreground'>
                                Click presets for quick setup, or fine-tune with sliders below.
                              </p>
                            </div>
                          </div>
                          <div className='flex flex-wrap gap-2'>
                            {!selectedEquipment && (
                              <Button
                                size='sm'
                                onClick={() => {
                                  const added = addEquipmentById(selectedEquipmentId);
                                  if (added) {
                                    setNotice({ type: 'success', message: `Equipment ${selectedEquipmentId} added.` });
                                  }
                                }}
                                disabled={!saveDocument}
                              >
                                Add To Save
                              </Button>
                            )}
                            {selectedEquipment && (
                              <>
                                <Button
                                  size='sm'
                                  variant='secondary'
                                  onClick={() => applyEquipmentPreset(selectedEquipmentId, 'min')}
                                  disabled={!saveDocument}
                                >
                                  Min
                                </Button>
                                <Button
                                  size='sm'
                                  variant='secondary'
                                  onClick={() => applyEquipmentPreset(selectedEquipmentId, 'max')}
                                  disabled={!saveDocument}
                                >
                                  Max
                                </Button>
                                <Button
                                  size='sm'
                                  variant='secondary'
                                  onClick={() => applyEquipmentPreset(selectedEquipmentId, 'max_lock')}
                                  disabled={!saveDocument}
                                >
                                  Max + Lock
                                </Button>
                                <Button
                                  size='sm'
                                  variant='outline'
                                  className='text-destructive hover:text-destructive'
                                  onClick={() => {
                                    removeEquipment(selectedEquipmentId);
                                    setSelectedEquipmentId(null);
                                    setNotice({
                                      type: 'info',
                                      message: `Equipment ${selectedEquipmentId} removed from save.`,
                                    });
                                  }}
                                  disabled={!saveDocument}
                                >
                                  <Trash2 className='mr-2 h-4 w-4' />
                                  Remove
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {!selectedEquipment ? (
                        <div className='rounded-md border border-dashed p-3 text-sm text-muted-foreground'>
                          This equipment is not currently owned in the loaded save.
                        </div>
                      ) : (
                        <div className='space-y-3'>
                          <div className='rounded-md border bg-muted/20 p-3'>
                            <div className='mb-2 flex items-center justify-between'>
                              <p className='text-[10px] uppercase text-muted-foreground'>Level</p>
                              <Badge variant='outline'>
                                {selectedEquipmentLevelPoint}/{EQUIPMENT_LEVEL_POINT_MAX}
                              </Badge>
                            </div>
                            <Slider
                              min={0}
                              max={EQUIPMENT_LEVEL_POINT_MAX}
                              step={1}
                              value={[selectedEquipmentLevelPoint]}
                              onValueChange={(values) =>
                                handleEquipmentLevelPointChange(selectedEquipmentId, Math.floor(values[0] ?? 0))
                              }
                              disabled={!saveDocument}
                            />
                            <div className='mt-2 grid grid-cols-5 gap-1'>
                              {EQUIPMENT_LEVEL_POINTS.map((levelPoint) => {
                                const active = selectedEquipmentLevelPoint === levelPoint;
                                return (
                                  <button
                                    key={levelPoint}
                                    type='button'
                                    className={`rounded-md border px-1 py-1 text-[11px] font-semibold transition ${
                                      active
                                        ? 'border-primary/70 bg-primary/15 text-primary'
                                        : 'border-border bg-background/70 text-muted-foreground hover:bg-accent'
                                    }`}
                                    onClick={() => handleEquipmentLevelPointChange(selectedEquipmentId, levelPoint)}
                                    disabled={!saveDocument}
                                  >
                                    {levelPoint}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {selectedEquipmentEnhanceable ? (
                            <div className='rounded-md border bg-muted/20 p-3'>
                              <div className='mb-2 flex items-center justify-between'>
                                <p className='text-[10px] uppercase text-muted-foreground'>Enhancement</p>
                                <Badge variant='outline'>
                                  {selectedEquipmentEnhancement === 0 ? 'Base' : `Status ${selectedEquipmentEnhancement}`}
                                </Badge>
                              </div>
                              <Slider
                                min={0}
                                max={selectedEquipmentEnhancementSelectableValues.length - 1}
                                step={1}
                                value={[selectedEquipmentEnhancementSliderIndex]}
                                onValueChange={(values) => {
                                  const index = Math.max(
                                    0,
                                    Math.min(
                                      Math.floor(values[0] ?? 0),
                                      selectedEquipmentEnhancementSelectableValues.length - 1
                                    )
                                  );
                                  handleEquipmentEnhancementChange(
                                    selectedEquipmentId,
                                    selectedEquipmentEnhancementSelectableValues[index]
                                  );
                                }}
                                disabled={!saveDocument}
                              />
                              <div className='mt-2 grid grid-cols-6 gap-1'>
                                {selectedEquipmentEnhancementSelectableValues.map((status) => (
                                  <button
                                    key={status}
                                    type='button'
                                    className={`rounded-md border px-1 py-1 text-[11px] font-semibold transition ${
                                      selectedEquipmentEnhancement === status
                                        ? 'border-primary/70 bg-primary/15 text-primary'
                                        : 'border-border bg-background/70 text-muted-foreground hover:bg-accent'
                                    }`}
                                    onClick={() => handleEquipmentEnhancementChange(selectedEquipmentId, status)}
                                    disabled={!saveDocument}
                                  >
                                    {status === 0 ? 'Base' : status}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className='rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground'>
                              This equipment does not support enhancement.
                            </div>
                          )}

                          <div className='grid gap-3 sm:grid-cols-2'>
                            <div>
                              <p className='mb-1 text-[10px] uppercase text-muted-foreground'>Stack</p>
                              <Input
                                type='number'
                                value={String(getNumberValue(selectedEquipment.stack, 1))}
                                onChange={(event) =>
                                  handleEquipmentFieldChange(selectedEquipmentId, 'stack', event.target.value)
                                }
                                disabled={!saveDocument}
                              />
                            </div>
                            <label className='mt-5 flex items-center gap-2 text-xs'>
                              <input
                                type='checkbox'
                                checked={Boolean(selectedEquipment.protection)}
                                onChange={(event) =>
                                  handleEquipmentFieldChange(selectedEquipmentId, 'protection', event.target.checked)
                                }
                                disabled={!saveDocument}
                              />
                              Protection
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {activeTab === 'party' && (
          <Card className='border-border/60 bg-background/90'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Party Builder</CardTitle>
              <CardDescription>Grid editor for team name, mains, unisons, equipment, and souls.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex flex-wrap gap-2'>
                <div className='relative min-w-[220px] flex-1'>
                  <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    value={partySearch}
                    onChange={(event) => setPartySearch(event.target.value)}
                    placeholder='Search group, slot, party name, or character ID...'
                    className='pl-9'
                    disabled={!saveDocument}
                  />
                </div>
              </div>

              <div className='grid gap-3 lg:grid-cols-2 2xl:grid-cols-3'>
                {visiblePartyEntries.map((entry) => {
                  const partyName = getStringValue(entry.value.name);
                  const title = partyName || `Party ${entry.slotId}`;
                  const edited = Boolean(entry.value.edited);
                  const partySlotKey = `${entry.groupId}-${entry.slotId}`;
                  const importActive = partyImportSlotKey === partySlotKey;
                  const shareFeedbackVisible = partyShareFeedbackKey === partySlotKey;

                  return (
                    <div key={`${entry.groupId}-${entry.slotId}`} className='rounded-xl border border-border/70 bg-background/50 p-3'>
                      <div className='mb-2 flex items-start justify-between gap-2'>
                        <div className='min-w-0'>
                          <p className='truncate text-sm font-semibold'>{title}</p>
                          <p className='font-mono text-xs text-muted-foreground'>
                            Group {entry.groupId} - Slot {entry.slotId}
                          </p>
                        </div>
                        <Badge variant={edited ? 'default' : 'outline'}>{edited ? 'Edited' : 'Default'}</Badge>
                      </div>

                      <div className='mb-2'>
                        <p className='mb-1 text-[10px] uppercase text-muted-foreground'>Party Name</p>
                        <Input
                          value={partyName}
                          onChange={(event) =>
                            updatePartySlotField(entry.groupId, entry.slotId, 'name', null, event.target.value)
                          }
                          disabled={!saveDocument}
                        />
                      </div>

                      <div className='grid gap-2 sm:grid-cols-3'>
                        {[0, 1, 2].map((slotIndex) => {
                          const characterId = getArrayNumberAt(entry.value.character_ids, slotIndex);
                          const unisonId = getArrayNumberAt(entry.value.unison_character_ids, slotIndex);
                          const equipmentId = getArrayNumberAt(entry.value.equipment_ids, slotIndex);
                          const soulId = getArrayNumberAt(entry.value.ability_soul_ids, slotIndex);

                          const characterMeta = characterId > 0 ? characterMetaById[String(characterId)] : undefined;
                          const unisonMeta = unisonId > 0 ? characterMetaById[String(unisonId)] : undefined;
                          const equipmentMeta = equipmentId > 0 ? itemMetaById[String(equipmentId)] : undefined;
                          const soulMeta = soulId > 0 ? itemMetaById[String(soulId)] : undefined;

                          const characterName =
                            characterMeta?.nameEN || characterMeta?.nameJP || (characterId > 0 ? `Character ${characterId}` : 'No main');
                          const unisonName =
                            unisonMeta?.nameEN || unisonMeta?.nameJP || (unisonId > 0 ? `Character ${unisonId}` : 'No unison');
                          const equipmentName = equipmentMeta?.name || (equipmentId > 0 ? `Equipment ${equipmentId}` : 'No equipment');
                          const soulName = soulMeta?.name || (soulId > 0 ? `Soul ${soulId}` : 'No soul');

                          const characterThumbUrls = characterMeta ? buildCharacterThumbUrls(characterMeta.faceCode) : [];
                          const unisonThumbUrls = unisonMeta ? buildCharacterThumbUrls(unisonMeta.faceCode) : [];
                          const equipmentThumbUrls = [
                            toCdnUrl(equipmentMeta?.thumbnail || ''),
                            toCdnUrl(equipmentMeta?.icon || ''),
                          ].filter(Boolean);
                          const soulThumbUrls = [toCdnUrl(soulMeta?.thumbnail || ''), toCdnUrl(soulMeta?.icon || '')].filter(Boolean);

                          const slotFields: Array<{
                            key: PartyPickerField;
                            kind: PartyPickerKind;
                            label: string;
                            idValue: number;
                            name: string;
                            thumbUrls: string[];
                            pixelated: boolean;
                            pickerTitle: string;
                          }> = [
                            {
                              key: 'character_ids',
                              kind: 'character',
                              label: 'Main',
                              idValue: characterId,
                              name: characterName,
                              thumbUrls: characterThumbUrls,
                              pixelated: false,
                              pickerTitle: `Pick Main Unit - Group ${entry.groupId} Slot ${entry.slotId} #${slotIndex + 1}`,
                            },
                            {
                              key: 'unison_character_ids',
                              kind: 'character',
                              label: 'Unison',
                              idValue: unisonId,
                              name: unisonName,
                              thumbUrls: unisonThumbUrls,
                              pixelated: false,
                              pickerTitle: `Pick Unison - Group ${entry.groupId} Slot ${entry.slotId} #${slotIndex + 1}`,
                            },
                            {
                              key: 'equipment_ids',
                              kind: 'equipment',
                              label: 'Equipment',
                              idValue: equipmentId,
                              name: equipmentName,
                              thumbUrls: equipmentThumbUrls,
                              pixelated: true,
                              pickerTitle: `Pick Equipment - Group ${entry.groupId} Slot ${entry.slotId} #${slotIndex + 1}`,
                            },
                            {
                              key: 'ability_soul_ids',
                              kind: 'equipment',
                              label: 'Soul',
                              idValue: soulId,
                              name: soulName,
                              thumbUrls: soulThumbUrls,
                              pixelated: true,
                              pickerTitle: `Pick Soul - Group ${entry.groupId} Slot ${entry.slotId} #${slotIndex + 1}`,
                            },
                          ];

                          return (
                            <div key={slotIndex} className='rounded-lg border border-border/70 bg-background/60 p-2'>
                              <p className='mb-2 text-[10px] uppercase text-muted-foreground'>Slot {slotIndex + 1}</p>
                              <div className='space-y-1.5'>
                                {slotFields.map((field) => (
                                  <div key={field.key} className='space-y-1'>
                                    <p className='text-[10px] uppercase text-muted-foreground'>{field.label}</p>
                                    <button
                                      type='button'
                                      className='flex w-full items-center justify-center rounded-md border border-border/60 bg-background/85 p-1.5 text-left transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60'
                                      onClick={() =>
                                        openPartyPicker(
                                          entry.groupId,
                                          entry.slotId,
                                          slotIndex,
                                          field.key,
                                          field.kind,
                                          field.pickerTitle
                                        )
                                      }
                                      title={field.name}
                                      disabled={!saveDocument}
                                    >
                                      <AssetThumb
                                        urls={field.thumbUrls}
                                        alt={field.name}
                                        size={36}
                                        pixelated={field.pixelated}
                                      />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className='mt-3 flex items-center justify-between gap-2'>
                        <label className='flex items-center gap-2 text-xs text-muted-foreground'>
                          <input
                            type='checkbox'
                            checked={edited}
                            onChange={(event) => setPartySlotEdited(entry.groupId, entry.slotId, event.target.checked)}
                            disabled={!saveDocument}
                          />
                          Edited
                        </label>
                        <div className='flex items-center gap-2'>
                          {importActive ? (
                            <div className='flex w-[148px] items-center gap-1'>
                              <Input
                                key={partySlotKey}
                                ref={partyImportInputRef}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    confirmPartySlotLinkImport(entry.groupId, entry.slotId, event.currentTarget.value);
                                  } else if (event.key === 'Escape') {
                                    event.preventDefault();
                                    cancelPartySlotLinkImport();
                                  }
                                }}
                                placeholder='Paste link...'
                                className='h-8 min-w-0 flex-1 text-[11px]'
                                autoFocus
                                disabled={!saveDocument}
                              />
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={() => confirmPartySlotLinkImport(entry.groupId, entry.slotId)}
                                className='h-8 w-8 px-0'
                                disabled={!saveDocument}
                                title='Confirm import'
                              >
                                <CheckCircle2 className='h-4 w-4 text-emerald-400' />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => startPartySlotLinkImport(entry.groupId, entry.slotId)}
                              className='w-[148px]'
                              disabled={!saveDocument}
                            >
                              Import From Link
                            </Button>
                          )}
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => sharePartySlotAsLink(entry.groupId, entry.slotId)}
                            disabled={!saveDocument}
                          >
                            {shareFeedbackVisible ? (
                              <>
                                <CheckCircle2 className='mr-1 h-4 w-4 text-emerald-400' />
                                Copied
                              </>
                            ) : (
                              'Share'
                            )}
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => clearPartySlot(entry.groupId, entry.slotId)}
                            disabled={!saveDocument}
                          >
                            Clear Slot
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {visiblePartyEntries.length === 0 && (
                  <div className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
                    No party slots found in this save.
                  </div>
                )}
              </div>

              <div className='flex items-center justify-between'>
                <p className='text-sm text-muted-foreground'>
                  Showing page {partyPage} / {partyTotalPages} ({filteredPartyEntries.length} matches)
                </p>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setPartyPage((page) => Math.max(1, page - 1))}
                    disabled={partyPage <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setPartyPage((page) => Math.min(partyTotalPages, page + 1))}
                    disabled={partyPage >= partyTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>

              <Dialog open={Boolean(partyPicker)} onOpenChange={(open) => !open && closePartyPicker()}>
                <DialogContent className='max-h-[92vh] overflow-y-auto sm:max-w-4xl'>
                  {partyPicker && (
                    <>
                      <DialogHeader>
                        <DialogTitle>{partyPicker.title}</DialogTitle>
                        <DialogDescription>
                          {partyPicker.kind === 'character'
                            ? 'Pick a character from the global roster.'
                            : 'Pick equipment from available equipment metadata.'}
                        </DialogDescription>
                      </DialogHeader>

                      <div className='flex flex-wrap gap-2'>
                        <div className='relative min-w-[220px] flex-1'>
                          <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                          <Input
                            defaultValue=''
                            onChange={(event) => queuePartyPickerSearch(event.target.value)}
                            placeholder={
                              partyPicker.kind === 'character'
                                ? 'Search character ID, EN/JP name, or face code...'
                                : 'Search equipment ID or name...'
                            }
                            className='pl-9'
                            disabled={!saveDocument}
                          />
                        </div>
                      </div>

                      <p className='text-xs text-muted-foreground'>
                        Showing {partyPickerResultIds.length}{' '}
                        {partyPicker.kind === 'character' ? 'characters' : 'equipment'}.
                      </p>
                      {partyPickerRenderPending && (
                        <p className='text-[11px] text-muted-foreground'>
                          Loading icons {partyPickerVisibleIds.length}/{partyPickerResultIds.length}...
                        </p>
                      )}

                      <div className='grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10'>
                        <button
                          type='button'
                          className={`flex h-[74px] items-center justify-center rounded-md border transition ${
                            partyPickerCurrentValue === 0
                              ? 'border-destructive/70 bg-destructive/10 ring-1 ring-destructive/35'
                              : 'border-border bg-muted/10 hover:bg-accent'
                          }`}
                          onClick={() => applyPartyPickerValue(0)}
                          disabled={!saveDocument}
                          title='Clear selection'
                        >
                          <Trash2 className='h-5 w-5 text-destructive' />
                        </button>
                        {partyPickerVisibleIds.map((id) => {
                          const isSelected = getNumberValue(id, 0) === partyPickerCurrentValue;
                          if (partyPicker.kind === 'character') {
                            const meta = characterMetaById[id];
                            const displayName = meta?.nameEN || meta?.nameJP || meta?.faceCode || `Character ${id}`;
                            const thumbUrls = meta ? buildCharacterThumbUrls(meta.faceCode) : [];
                            return (
                              <button
                                key={`${partyPicker.kind}-${id}`}
                                type='button'
                                className={`rounded-md border p-1 text-left transition ${
                                  isSelected
                                    ? 'border-primary/70 bg-primary/15 ring-1 ring-primary/40'
                                    : 'border-border bg-muted/10 hover:bg-accent'
                                }`}
                                onClick={() => applyPartyPickerValue(id)}
                                disabled={!saveDocument}
                                title={displayName}
                              >
                                <AssetThumb urls={thumbUrls} alt={displayName} size={62} pixelated={false} />
                              </button>
                            );
                          }

                          const meta = itemMetaById[id];
                          const displayName = meta?.name || `Equipment ${id}`;
                          const thumbUrls = [toCdnUrl(meta?.thumbnail || ''), toCdnUrl(meta?.icon || '')].filter(Boolean);
                          return (
                            <button
                              key={`${partyPicker.kind}-${id}`}
                              type='button'
                              className={`rounded-md border p-1 text-left transition ${
                                isSelected
                                  ? 'border-primary/70 bg-primary/15 ring-1 ring-primary/40'
                                  : 'border-border bg-muted/10 hover:bg-accent'
                              }`}
                              onClick={() => applyPartyPickerValue(id)}
                              disabled={!saveDocument}
                              title={displayName}
                            >
                              <AssetThumb urls={thumbUrls} alt={displayName} size={62} pixelated />
                            </button>
                          );
                        })}
                      </div>

                      {partyPickerResultIds.length === 0 && (
                        <div className='rounded-md border border-dashed p-3 text-sm text-muted-foreground'>
                          No matches found for this picker.
                        </div>
                      )}
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {activeTab === 'story' && (
          <Card className='border-border/60 bg-background/90'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Story / Quest Progress</CardTitle>
              <CardDescription>
                EN-only quest cards from `quest_progress`, enriched via `datalist_en/quest/*.json` and related
                `.orderedmap` references.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex flex-wrap gap-2'>
                <div className='relative min-w-[220px] flex-1'>
                  <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    value={storySearch}
                    onChange={(event) => setStorySearch(event.target.value)}
                    placeholder='Search quest ID, title, chapter, or category...'
                    className='pl-9'
                    disabled={!saveDocument}
                  />
                </div>
                <div className='min-w-[220px] sm:w-[260px]'>
                  <Select value={storySourceFilter} onValueChange={(value) => setStorySourceFilter(value as StorySourceFilter)}>
                    <SelectTrigger disabled={!saveDocument}>
                      <SelectValue placeholder='Filter by quest source' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All Sources</SelectItem>
                      {storySourceFilterOptions.map((sourceKey) => (
                        <SelectItem key={sourceKey} value={sourceKey}>
                          {getStorySourceLabel(sourceKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                {visibleStoryEntries.map((entry) => (
                  <div key={`${entry.chapterId}-${entry.index}-${entry.questId}`} className='rounded-lg border bg-muted/15 p-3'>
                    <div className='mb-3 flex items-start gap-3'>
                      <AssetThumb
                        urls={buildStoryThumbUrls(entry.questId, entry.meta?.thumbnail ?? '')}
                        alt={entry.meta?.title || `Quest ${entry.questId}`}
                      />
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold'>{entry.meta?.title || `Quest ${entry.questId}`}</p>
                        <p className='font-mono text-xs text-muted-foreground' title={`Quest ID ${entry.questId}`}>
                          ID {entry.questId}
                        </p>
                        <div className='mt-1 flex flex-wrap gap-1'>
                          <Badge variant='outline' className='text-[10px]'>
                            {entry.categoryLabel}
                          </Badge>
                          {entry.meta?.sourceLabel && (
                            <Badge variant='secondary' className='text-[10px]'>
                              {entry.meta.sourceLabel}
                            </Badge>
                          )}
                          {entry.meta?.chapterLabel && (
                            <Badge variant='outline' className='text-[10px]'>
                              {entry.meta.chapterLabel}
                            </Badge>
                          )}
                        </div>
                        <p className='mt-1 truncate text-[10px] text-muted-foreground' title={entry.meta?.orderedMapPath ?? ''}>
                          {entry.meta?.orderedMapPath ? `orderedmap: ${entry.meta.orderedMapPath}` : `chapter key: ${entry.chapterId}`}
                        </p>
                      </div>
                    </div>
                    <div className='grid grid-cols-2 gap-2'>
                      <label className='col-span-2 flex items-center gap-2 text-xs'>
                        <input
                          type='checkbox'
                          checked={entry.finished}
                          onChange={(event) =>
                            updateStoryEntry(entry.chapterId, entry.index, (target) => {
                              target.finished = event.target.checked;
                            })
                          }
                          disabled={!saveDocument}
                        />
                        Finished
                      </label>
                      <div>
                        <p className='mb-1 text-[10px] uppercase text-muted-foreground'>Clear Rank</p>
                        <Input
                          type='number'
                          value={String(entry.clearRank)}
                          onChange={(event) =>
                            updateStoryEntry(entry.chapterId, entry.index, (target) => {
                              target.clear_rank = toNumeric(event.target.value, 0);
                            })
                          }
                          disabled={!saveDocument}
                        />
                      </div>
                      <div>
                        <p className='mb-1 text-[10px] uppercase text-muted-foreground'>High Score</p>
                        <Input
                          value={entry.highScore}
                          onChange={(event) =>
                            updateStoryEntry(entry.chapterId, entry.index, (target) => {
                              target.high_score = event.target.value;
                            })
                          }
                          disabled={!saveDocument}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {visibleStoryEntries.length === 0 && (
                  <div className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
                    <p>No story entries found in this save.</p>
                    {storyEntries.length === 0 && storySeedQuestCount > 0 && (
                      <Button
                        variant='outline'
                        size='sm'
                        className='mt-2'
                        onClick={initializeStoryProgressFromMetadata}
                        disabled={!saveDocument}
                      >
                        Initialize Story Progress (EN)
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className='flex items-center justify-between'>
                <p className='text-sm text-muted-foreground'>
                  Showing page {storyPage} / {storyTotalPages} ({filteredStoryEntries.length} matches)
                </p>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setStoryPage((page) => Math.max(1, page - 1))}
                    disabled={storyPage <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setStoryPage((page) => Math.min(storyTotalPages, page + 1))}
                    disabled={storyPage >= storyTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'raw' && (
          <Card className='border-border/60 bg-background/90'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Raw JSON</CardTitle>
              <CardDescription>Fallback mode for direct JSON editing and manual apply.</CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant={rawParsedState.isValid ? 'default' : 'destructive'} className='gap-1.5'>
                  {rawParsedState.isValid ? <CheckCircle2 className='h-3.5 w-3.5' /> : <AlertCircle className='h-3.5 w-3.5' />}
                  {rawParsedState.isValid ? 'Valid JSON' : 'Invalid JSON'}
                </Badge>
                <Badge variant={rawDirty ? 'secondary' : 'outline'}>{rawDirty ? 'Unsynced changes' : 'Synced'}</Badge>
                {!rawParsedState.isValid && rawParsedState.hasContent && (
                  <span className='text-xs text-destructive'>{rawParsedState.error}</span>
                )}
              </div>

              <div className='flex flex-wrap gap-2'>
                <div className='min-w-[220px] sm:w-[260px]'>
                  <Select
                    value={rawJumpSelection || undefined}
                    onValueChange={(value) => {
                      setRawJumpSelection(value);
                      jumpToRawSection(value);
                      setRawJumpSelection('');
                    }}
                    disabled={!rawText.trim()}
                  >
                    <SelectTrigger className='h-9'>
                      <SelectValue placeholder='Jump to section...' />
                    </SelectTrigger>
                    <SelectContent>
                      {RAW_SECTION_JUMPS.map((section) => (
                        <SelectItem key={section.key} value={section.key}>
                          {section.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={applyRawJson} disabled={!rawParsedState.isValid}>
                  Apply Raw JSON
                </Button>
                <Button variant='secondary' onClick={formatRawJson} disabled={!rawParsedState.isValid}>
                  Format
                </Button>
                <Button variant='secondary' onClick={minifyRawJson} disabled={!rawParsedState.isValid}>
                  Minify
                </Button>
                <Button variant='outline' onClick={resetRawFromStructured} disabled={!saveDocument}>
                  Reset From Structured
                </Button>
              </div>

              <div className='grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]'>
                <textarea
                  ref={rawTextAreaRef}
                  value={rawText}
                  onChange={(event) => {
                    setRawText(event.target.value);
                    setRawDirty(true);
                  }}
                  onSelect={syncRawSelectionFromTextarea}
                  onKeyUp={syncRawSelectionFromTextarea}
                  onClick={syncRawSelectionFromTextarea}
                  onFocus={syncRawSelectionFromTextarea}
                  placeholder='Load or upload a save to start editing raw JSON...'
                  spellCheck={false}
                  className='h-[70vh] w-full resize-none rounded-md border bg-background p-3 font-mono text-xs leading-relaxed outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring'
                />

                <div className='space-y-3 rounded-md border bg-muted/15 p-3'>
                  <div>
                    <p className='text-xs font-semibold uppercase tracking-wide'>Selection Inspector</p>
                    <p className='text-xs text-muted-foreground'>
                      Line {rawLineInfo.lineNumber}, Col {rawLineInfo.columnNumber}
                    </p>
                  </div>

                  <div className='space-y-1'>
                    <p className='text-[10px] uppercase text-muted-foreground'>Path</p>
                    <code className='block overflow-x-auto rounded bg-background/60 px-2 py-1 font-mono text-[11px]'>
                      {rawInspectorPathText}
                    </code>
                    <p className='text-[11px] text-muted-foreground'>
                      Node type: {rawInspectorNode?.kind ?? (rawParsedState.isValid ? 'unknown' : 'n/a')}
                    </p>
                    {rawParsedState.isValid && rawText.length > RAW_JSON_INSPECT_MAX_SIZE && (
                      <p className='text-[11px] text-amber-300'>
                        Inspector path parsing is disabled for large JSON files ({'>'}
                        {RAW_JSON_INSPECT_MAX_SIZE.toLocaleString()} chars).
                      </p>
                    )}
                  </div>

                  <div className='space-y-1'>
                    <p className='text-[10px] uppercase text-muted-foreground'>Selected Value</p>
                    <code className='block overflow-x-auto rounded bg-background/60 px-2 py-1 font-mono text-[11px]'>
                      {(rawSelectedText || rawInspectorToken || rawLineInfo.lineText || '(empty)').slice(0, 220)}
                      {(rawSelectedText || rawInspectorToken || rawLineInfo.lineText || '').length > 220 ? '...' : ''}
                    </code>
                  </div>

                  <div className='space-y-2'>
                    <p className='text-[10px] uppercase text-muted-foreground'>Resolved Context</p>
                    {rawInspectorPrimaryHit ? (
                      <>
                        <Badge variant='outline' className={`text-[11px] ${getRawInspectorKindClasses(rawInspectorPrimaryHit.kind)}`}>
                          {getRawInspectorKindLabel(rawInspectorPrimaryHit.kind)} ID {rawInspectorPrimaryHit.id}
                        </Badge>
                        <p className='text-sm font-medium leading-tight'>{rawInspectorPrimaryHit.label}</p>
                        <p className='text-xs text-muted-foreground'>{rawInspectorPrimaryHit.subtitle}</p>
                        {rawInspectorPrimaryHit.kind !== 'unknown' && (
                          <div className='pt-1'>
                            <AssetThumb
                              urls={rawInspectorPrimaryThumb.urls}
                              alt={rawInspectorPrimaryHit.label}
                              size={82}
                              pixelated={rawInspectorPrimaryThumb.pixelated}
                            />
                          </div>
                        )}
                        {rawInspectorPrimaryHit.kind !== 'unknown' && (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => openInspectorHitInEditor(rawInspectorPrimaryHit)}
                            className='w-full'
                          >
                            Open In {getRawInspectorKindLabel(rawInspectorPrimaryHit.kind)} Editor
                          </Button>
                        )}
                      </>
                    ) : (
                      <p className='text-xs text-muted-foreground'>No recognized ID at current cursor/selection.</p>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <p className='text-[10px] uppercase text-muted-foreground'>ID Highlights ({rawHighlightScope.label})</p>
                    <div className='max-h-32 overflow-auto rounded bg-background/60 px-2 py-1 font-mono text-[11px] leading-relaxed'>
                      {rawHighlightScope.text ? (
                        rawHighlightSegments.map((segment, index) =>
                          segment.match ? (
                            <mark
                              key={`${segment.match.id}-${index}`}
                              className={`rounded px-0.5 ${getRawInspectorKindClasses(segment.match.hit.kind)} text-inherit`}
                              title={`${getRawInspectorKindLabel(segment.match.hit.kind)} ${segment.match.id}: ${segment.match.hit.label}`}
                            >
                              {segment.text}
                            </mark>
                          ) : (
                            <span key={`plain-${index}`}>{segment.text}</span>
                          )
                        )
                      ) : (
                        <span className='text-muted-foreground'>(empty)</span>
                      )}
                    </div>
                    <div className='flex flex-wrap gap-1'>
                      {rawHighlightHits.length > 0 ? (
                        rawHighlightHits.map((hit) => (
                          <Badge
                            key={`${hit.kind}-${hit.id}`}
                            variant='outline'
                            className={`text-[10px] ${getRawInspectorKindClasses(hit.kind)}`}
                            title={hit.subtitle}
                          >
                            {getRawInspectorKindLabel(hit.kind)} {hit.id}
                          </Badge>
                        ))
                      ) : (
                        <span className='text-xs text-muted-foreground'>No recognizable IDs in this scope.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
