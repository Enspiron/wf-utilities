import type { Item } from '@/app/api/items/route';
import { buildCharacterSquareImageUrl } from '@/lib/character-assets';
import type { Character } from '@/lib/character-parser';
import type { ParsedItem } from '@/lib/json-parser';
import {
  createSearchDocument,
  expandAliasValue,
  normalizeSearchValue,
  type SearchDocument,
} from '@/lib/search/core';
import { isCommunityRouteDisabled } from '@/lib/community/availability';

export type AbilitySearchRow = {
  source: 'ability' | 'leader_ability' | 'ability_soul';
  id: string;
  key: string;
  trigger: string;
  faceCode: string;
  raw: unknown[];
};

export type AchievementSearchRow = {
  id: string;
  key: string;
  sortId: string;
  name: string;
  nameJp: string;
  criteria: string;
  category: string;
  prefix: string;
  raw: unknown[];
};

type SearchPage = {
  href: string;
  title: string;
  subtitle: string;
  group: string;
  priority: number;
  keywords: string[];
};

const WF_CDN_ROOT = 'https://wfjukebox.b-cdn.net';

const SEARCH_PAGES: SearchPage[] = [
  {
    href: '/',
    title: 'Home',
    subtitle: 'Landing dashboard and global toolkit command center',
    group: 'Navigation',
    priority: 120,
    keywords: ['home', 'dashboard', 'toolkit', 'overview'],
  },
  {
    href: '/search',
    title: 'Global Search',
    subtitle: 'Search across pages, characters, items, quests, abilities, and achievements',
    group: 'Navigation',
    priority: 119,
    keywords: ['search', 'global search', 'quick jump', 'find'],
  },
  {
    href: '/save-editor',
    title: 'Save Editor',
    subtitle: 'Load, edit, and export World Flipper save JSON data',
    group: 'Navigation',
    priority: 116,
    keywords: ['save', 'json', 'editor', 'account'],
  },
  {
    href: '/profile',
    title: 'Profile',
    subtitle: 'Community profile, permissions, and moderation status',
    group: 'Navigation',
    priority: 114,
    keywords: ['profile', 'account', 'community'],
  },
  {
    href: '/community',
    title: 'Community Feed',
    subtitle: 'Browse community teams, strategies, and submissions',
    group: 'Navigation',
    priority: 113,
    keywords: ['community', 'teams', 'builds', 'feed'],
  },
  {
    href: '/community/new',
    title: 'Submit Team',
    subtitle: 'Create and submit a community team entry',
    group: 'Navigation',
    priority: 112,
    keywords: ['submit', 'community', 'team'],
  },
  {
    href: '/saves',
    title: 'Save Shares',
    subtitle: 'Browse shared saves and cloneable save uploads',
    group: 'Navigation',
    priority: 111,
    keywords: ['saves', 'save share', 'clone', 'import'],
  },
  {
    href: '/community/moderation',
    title: 'Moderation',
    subtitle: 'Review pending community submissions',
    group: 'Navigation',
    priority: 110,
    keywords: ['moderation', 'approve', 'reject', 'queue'],
  },
  {
    href: '/login',
    title: 'Login',
    subtitle: 'Sign in to community features',
    group: 'Navigation',
    priority: 109,
    keywords: ['login', 'sign in', 'auth'],
  },
  {
    href: '/register',
    title: 'Register',
    subtitle: 'Create a community account',
    group: 'Navigation',
    priority: 108,
    keywords: ['register', 'sign up', 'auth'],
  },
  {
    href: '/characters',
    title: 'Characters',
    subtitle: 'Browse character data, portraits, filters, and details',
    group: 'Navigation',
    priority: 107,
    keywords: ['characters', 'units', 'roster', 'face code'],
  },
  {
    href: '/items',
    title: 'Items',
    subtitle: 'Browse items and equipment with filtering and detail pages',
    group: 'Navigation',
    priority: 106,
    keywords: ['items', 'equipment', 'weapons', 'materials'],
  },
  {
    href: '/quests',
    title: 'Quests',
    subtitle: 'Search quest data, source files, artwork, and BGM coverage',
    group: 'Navigation',
    priority: 105,
    keywords: ['quests', 'story', 'missions', 'event', 'bgm'],
  },
  {
    href: '/abilities',
    title: 'Abilities',
    subtitle: 'Inspect ability, leader ability, and soul ability rows',
    group: 'Navigation',
    priority: 104,
    keywords: ['abilities', 'leader ability', 'ability soul', 'face code'],
  },
  {
    href: '/achievements',
    title: 'Achievements',
    subtitle: 'Browse titles, criteria, and achievement families',
    group: 'Navigation',
    priority: 103,
    keywords: ['achievements', 'titles', 'degree', 'criteria', 'prefix'],
  },
  {
    href: '/calendar',
    title: 'Calendar',
    subtitle: 'Explore event schedules and date ranges',
    group: 'Navigation',
    priority: 102,
    keywords: ['calendar', 'events', 'schedule'],
  },
  {
    href: '/calendar-v2',
    title: 'Calendar V2',
    subtitle: 'Alternative event calendar and schedule view',
    group: 'Navigation',
    priority: 101,
    keywords: ['calendar', 'events', 'schedule', 'timeline'],
  },
  {
    href: '/feature-timeline',
    title: 'Feature Timeline',
    subtitle: 'Track announcements, banners, and home screen features',
    group: 'Navigation',
    priority: 98,
    keywords: ['feature', 'timeline', 'banner', 'announcement'],
  },
  {
    href: '/gacha',
    title: 'Gacha',
    subtitle: 'Inspect banner art, odds pools, and portals',
    group: 'Navigation',
    priority: 97,
    keywords: ['gacha', 'banner', 'odds', 'portal'],
  },
  {
    href: '/orderedmap',
    title: 'OrderedMap Explorer',
    subtitle: 'Navigate raw orderedmap category and file payloads',
    group: 'Navigation',
    priority: 95,
    keywords: ['orderedmap', 'json', 'datalist', 'assets'],
  },
  {
    href: '/manaboard',
    title: 'Mana Board',
    subtitle: 'Inspect mana board costs and node layouts',
    group: 'Navigation',
    priority: 92,
    keywords: ['mana board', 'nodes', 'materials'],
  },
  {
    href: '/exboost',
    title: 'EX Boost',
    subtitle: 'Inspect EX boost data and related utilities',
    group: 'Navigation',
    priority: 91,
    keywords: ['ex boost', 'boost'],
  },
  {
    href: '/fixed-party',
    title: 'Fixed Party',
    subtitle: 'Browse preset party and loadout data',
    group: 'Navigation',
    priority: 90,
    keywords: ['fixed party', 'preset team', 'loadout'],
  },
  {
    href: '/share',
    title: 'Share',
    subtitle: 'Inspect share/embed helpers and share pages',
    group: 'Navigation',
    priority: 89,
    keywords: ['share', 'embed', 'meta'],
  },
  {
    href: '/facebuilder',
    title: 'Face Builder',
    subtitle: 'Build and export face combinations',
    group: 'Navigation',
    priority: 88,
    keywords: ['face', 'builder', 'portrait'],
  },
  {
    href: '/music',
    title: 'Music',
    subtitle: 'Search and preview BGM and audio assets',
    group: 'Navigation',
    priority: 90,
    keywords: ['music', 'bgm', 'audio'],
  },
  {
    href: '/sprite-sheets',
    title: 'Sprite Sheets',
    subtitle: 'Inspect battle and animation sheet data',
    group: 'Navigation',
    priority: 88,
    keywords: ['sprites', 'animation', 'battle'],
  },
  {
    href: '/scenes',
    title: 'Scenes',
    subtitle: 'Reconstruct and inspect scene data',
    group: 'Navigation',
    priority: 87,
    keywords: ['scene', 'story', 'scenario'],
  },
  {
    href: '/voicedb',
    title: 'VoiceDB',
    subtitle: 'Search voice actor and cast data',
    group: 'Navigation',
    priority: 86,
    keywords: ['voice', 'voice actor', 'cast', 'seiyuu'],
  },
  {
    href: '/comics',
    title: 'Comics',
    subtitle: 'Browse comics and episode artwork',
    group: 'Navigation',
    priority: 84,
    keywords: ['comic', 'episode', 'manga'],
  },
];

const ACHIEVEMENT_CATEGORY_LABELS: Record<string, string> = {
  '1': 'Story',
  '2': 'Character',
  '3': 'Combat',
  '4': 'Event',
  '5': 'Progression',
  '6': 'Special',
  '7': 'Anniversary',
  '8': 'Misc',
};

const ABILITY_SOURCE_LABELS: Record<AbilitySearchRow['source'], string> = {
  ability: 'Character Ability',
  leader_ability: 'Leader Ability',
  ability_soul: 'Ability Soul',
};

function buildItemImageUrl(item: Item): string | undefined {
  const raw = item.thumbnail || item.icon;
  if (!raw) return undefined;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${WF_CDN_ROOT}/${raw.replace(/^\/+/, '')}.png`;
}

function getQuestSourceFile(item: ParsedItem): string {
  const source = item.data._sourceFile;
  return typeof source === 'string' && source ? source : 'unknown';
}

function getQuestMode(sourceFile: string): 'main' | 'character' | 'event' {
  if (sourceFile.includes('main')) return 'main';
  if (sourceFile.includes('character')) return 'character';
  return 'event';
}

function normalizeAssetPath(value: string): string {
  return value.trim().replace(/^\/+/, '');
}

function resemblesDirectoryPath(value: string): boolean {
  if (!value || value.includes(' ')) return false;
  if (value.startsWith('http://') || value.startsWith('https://')) return false;
  const normalized = normalizeAssetPath(value);
  const segments = normalized.split('/').filter(Boolean);
  return segments.length >= 2;
}

function isLikelyImagePath(value: string): boolean {
  if (!value || value.includes(' ')) return false;
  if (value.startsWith('http://') || value.startsWith('https://')) return true;
  return (
    resemblesDirectoryPath(value) &&
    !value.startsWith('bgm/') &&
    !value.startsWith('voice/') &&
    !value.startsWith('se/')
  );
}

function toAlternateAssetPath(value: string): string {
  if (value.includes('quest/thumbnail/')) return value.replace('quest/thumbnail/', 'quest/');
  if (value.startsWith('quest/') && !value.startsWith('quest/thumbnail/')) {
    return value.replace(/^quest\//, 'quest/thumbnail/');
  }
  return '';
}

function collectDirectoryLikeStrings(value: unknown, out: Set<string>) {
  if (typeof value === 'string') {
    if (resemblesDirectoryPath(value)) out.add(normalizeAssetPath(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectDirectoryLikeStrings(entry, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) collectDirectoryLikeStrings(entry, out);
  }
}

function collectBgmPaths(value: unknown, out: Set<string>) {
  if (typeof value === 'string') {
    const normalized = normalizeAssetPath(value);
    if (normalized.startsWith('bgm/')) out.add(normalized);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectBgmPaths(entry, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) collectBgmPaths(entry, out);
  }
}

export function getQuestImageCandidates(item: ParsedItem): string[] {
  const rawCandidates: string[] = [];
  if (item.imageUrl) rawCandidates.push(item.imageUrl);

  const field2 = typeof item.data.field_2 === 'string' ? item.data.field_2 : '';
  const field1 = typeof item.data.field_1 === 'string' ? item.data.field_1 : '';
  if (field2 && isLikelyImagePath(field2)) rawCandidates.push(field2);
  if (field1 && isLikelyImagePath(field1)) rawCandidates.push(field1);

  const directoryLikeValues = new Set<string>();
  const visibleData = Object.fromEntries(Object.entries(item.data).filter(([key]) => !key.startsWith('_')));
  collectDirectoryLikeStrings(visibleData, directoryLikeValues);
  for (const entry of directoryLikeValues) {
    if (isLikelyImagePath(entry)) rawCandidates.push(entry);
  }

  const urls = new Set<string>();
  for (const candidate of rawCandidates) {
    if (!candidate) continue;
    if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
      urls.add(candidate);
      continue;
    }

    const normalized = normalizeAssetPath(candidate);
    urls.add(`${WF_CDN_ROOT}/${normalized}.png`);
    const alternate = toAlternateAssetPath(normalized);
    if (alternate) urls.add(`${WF_CDN_ROOT}/${alternate}.png`);
  }

  return [...urls];
}

export function getQuestBgmCandidates(item: ParsedItem): string[] {
  const bgmPaths = new Set<string>();
  collectBgmPaths(item.data, bgmPaths);
  return [...bgmPaths];
}

function stringifyQuestData(item: ParsedItem): string {
  return Object.values(item.data)
    .filter((value) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    .map((value) => String(value))
    .join(' ');
}

export function buildPageSearchDocuments(): SearchDocument[] {
  return SEARCH_PAGES.filter((page) => !isCommunityRouteDisabled(page.href)).map((page) =>
    createSearchDocument({
      id: `page:${page.href}`,
      kind: 'page',
      group: page.group,
      href: page.href,
      title: page.title,
      subtitle: page.subtitle,
      priority: page.priority,
      badges: ['Page'],
      fields: [
        { key: 'title', label: 'page title', text: page.title, weight: 10 },
        { key: 'subtitle', label: 'page details', text: page.subtitle, weight: 7 },
        {
          key: 'keywords',
          label: 'page keywords',
          text: page.keywords.join(' '),
          weight: 8,
        },
      ],
      filters: {
        type: 'page',
        category: page.group,
      },
    })
  );
}

export function buildCharacterSearchDocument(character: Character): SearchDocument {
  const title = character.nameEN || character.nameJP || character.faceCode;
  const subtitle = [
    'Character',
    character.id ? `ID ${character.id}` : '',
    character.faceCode,
    character.attribute,
    character.weaponType,
  ]
    .filter(Boolean)
    .join(' | ');

  const altNames = [
    character.nameJP,
    character.nameEN || '',
    character.subNameJP,
    character.subNameEN || '',
    character.titleJP,
    character.titleEN || '',
  ]
    .filter(Boolean)
    .join(' | ');

  return createSearchDocument({
    id: `character:${character.faceCode}`,
    kind: 'character',
    group: 'Characters',
    href: `/characters/${encodeURIComponent(character.faceCode)}`,
    title,
    subtitle,
    snippet: altNames || character.voiceActorJP || character.descriptionEN || character.descriptionJP,
    imageUrl: character.faceCode ? buildCharacterSquareImageUrl(character.faceCode) : undefined,
    imagePixelated: false,
    badges: [character.attribute, character.weaponType, `★${character.rarity}`],
    priority: 70,
    fields: [
      { key: 'title', label: 'character name', text: title, weight: 12 },
      { key: 'names', label: 'alt name', text: altNames, weight: 10 },
      {
        key: 'faceCode',
        label: 'face code',
        text: character.faceCode,
        searchText: expandAliasValue(character.faceCode).join(' '),
        weight: 16,
      },
      { key: 'id', label: 'id', text: character.id, weight: 18 },
      {
        key: 'voiceActor',
        label: 'voice actor',
        text: [character.voiceActorJP, character.voiceActorEN || ''].filter(Boolean).join(' | '),
        weight: 8,
      },
      {
        key: 'details',
        label: 'character details',
        text: [
          character.attribute,
          character.weaponType,
          character.race,
          character.gender,
          character.stance,
          character.skillNameJP,
          character.skillNameEN || '',
        ]
          .filter(Boolean)
          .join(' | '),
        weight: 7,
      },
    ],
    filters: {
      type: 'character',
      id: character.id,
      face: expandAliasValue(character.faceCode),
      rarity: character.rarity,
      attribute: character.attribute,
      weapon: character.weaponType,
      race: character.race.split('/').map((entry) => entry.trim()).filter(Boolean),
      stance: character.stance,
      va: [character.voiceActorJP, character.voiceActorEN || ''],
      has: character.faceCode ? ['img'] : [],
    },
  });
}

export function buildItemSearchDocument(item: Item): SearchDocument {
  const imageUrl = buildItemImageUrl(item);
  const typeLabel = item.type === 'equipment' ? 'Equipment' : 'Item';
  const badges = [typeLabel, item.category, `★${item.rarity}`];
  if (item.type === 'equipment' && item.sheetRegions?.length) {
    badges.push(...item.sheetRegions.map((region) => region.toUpperCase()));
  }

  return createSearchDocument({
    id: `${item.type}:${item.id}`,
    kind: item.type,
    group: 'Items',
    href: item.type === 'equipment' ? `/equip/${encodeURIComponent(item.id)}` : `/item/${encodeURIComponent(item.id)}`,
    title: item.name,
    subtitle: `${typeLabel} | ID ${item.id} | ${item.category}${item.devname ? ` | ${item.devname}` : ''}`,
    snippet: item.description || item.flavorText || undefined,
    imageUrl,
    imagePixelated: true,
    badges,
    priority: item.type === 'equipment' ? 68 : 66,
    fields: [
      { key: 'title', label: 'item name', text: item.name, weight: 12 },
      { key: 'id', label: 'id', text: item.id, weight: 18 },
      {
        key: 'devname',
        label: 'devname',
        text: item.devname,
        searchText: expandAliasValue(item.devname).join(' '),
        weight: 14,
      },
      { key: 'category', label: 'category', text: item.category, weight: 8 },
      {
        key: 'details',
        label: 'details',
        text: [item.description, item.flavorText || '', item.type, item.sheetRegions?.join(' ') || '']
          .filter(Boolean)
          .join(' | '),
        weight: 7,
      },
    ],
    filters: {
      type: item.type,
      id: item.id,
      rarity: String(item.rarity),
      category: item.category,
      source: item.sheetRegions || [],
      has: imageUrl ? ['img'] : [],
      missing: imageUrl ? [] : ['img'],
    },
  });
}

export function buildQuestSearchDocument(item: ParsedItem): SearchDocument {
  const sourceFile = getQuestSourceFile(item);
  const mode = getQuestMode(sourceFile);
  const imageCandidates = getQuestImageCandidates(item);
  const bgmCandidates = getQuestBgmCandidates(item);

  return createSearchDocument({
    id: `quest:${item.id}:${sourceFile}`,
    kind: 'quest',
    group: 'Quests',
    href: `/quests?q=${encodeURIComponent(`id:${item.id}`)}&source=${encodeURIComponent(sourceFile)}`,
    title: item.label,
    subtitle: `Quest | ID ${item.id} | ${sourceFile}`,
    snippet: stringifyQuestData(item),
    imageUrl: imageCandidates[0],
    imagePixelated: true,
    badges: [mode, ...(bgmCandidates.length > 0 ? ['BGM'] : []), ...(imageCandidates.length > 0 ? ['IMG'] : [])],
    priority: 64,
    fields: [
      { key: 'title', label: 'quest name', text: item.label, weight: 12 },
      { key: 'id', label: 'id', text: item.id, weight: 18 },
      { key: 'source', label: 'source file', text: sourceFile, weight: 14 },
      { key: 'details', label: 'quest fields', text: stringifyQuestData(item), weight: 7 },
    ],
    filters: {
      type: 'quest',
      id: item.id,
      source: sourceFile,
      mode,
      has: [
        ...(imageCandidates.length > 0 ? ['img'] : []),
        ...(bgmCandidates.length > 0 ? ['bgm'] : []),
      ],
      missing: [
        ...(imageCandidates.length === 0 ? ['img'] : []),
        ...(bgmCandidates.length === 0 ? ['bgm'] : []),
      ],
    },
  });
}

export function buildAbilitySearchDocument(row: AbilitySearchRow): SearchDocument {
  const title = row.key;
  const subtitle = `${ABILITY_SOURCE_LABELS[row.source]} | ID ${row.id} | ${row.faceCode}`;

  return createSearchDocument({
    id: `ability:${row.source}:${row.id}`,
    kind: 'ability',
    group: 'Systems',
    href: `/abilities?q=${encodeURIComponent(`id:${row.id}`)}`,
    title,
    subtitle,
    snippet: row.trigger || row.raw.map((cell) => String(cell)).join(' | '),
    badges: [ABILITY_SOURCE_LABELS[row.source], row.faceCode],
    priority: 58,
    fields: [
      { key: 'title', label: 'ability key', text: row.key, weight: 12 },
      { key: 'id', label: 'id', text: row.id, weight: 18 },
      {
        key: 'faceCode',
        label: 'face code',
        text: row.faceCode,
        searchText: expandAliasValue(row.faceCode).join(' '),
        weight: 15,
      },
      { key: 'source', label: 'source', text: row.source, weight: 8 },
      { key: 'trigger', label: 'trigger', text: row.trigger, weight: 7 },
    ],
    filters: {
      type: 'ability',
      id: row.id,
      source: row.source,
      face: expandAliasValue(row.faceCode),
    },
  });
}

export function buildAchievementSearchDocument(row: AchievementSearchRow): SearchDocument {
  const categoryLabel = ACHIEVEMENT_CATEGORY_LABELS[row.category] || `Category ${row.category}`;

  return createSearchDocument({
    id: `achievement:${row.id}`,
    kind: 'achievement',
    group: 'Systems',
    href: `/achievements?q=${encodeURIComponent(`id:${row.id}`)}`,
    title: row.name,
    subtitle: `Achievement | ID ${row.id} | ${categoryLabel} | ${row.prefix}`,
    snippet: row.criteria || row.nameJp || undefined,
    badges: [categoryLabel, row.prefix],
    priority: 56,
    fields: [
      { key: 'title', label: 'achievement title', text: row.name, weight: 12 },
      { key: 'jpTitle', label: 'japanese title', text: row.nameJp, weight: 8 },
      { key: 'id', label: 'id', text: row.id, weight: 18 },
      { key: 'prefix', label: 'family', text: row.prefix, weight: 12 },
      { key: 'criteria', label: 'criteria', text: row.criteria, weight: 8 },
      { key: 'key', label: 'internal key', text: row.key, weight: 7 },
    ],
    filters: {
      type: 'achievement',
      id: row.id,
      category: [row.category, categoryLabel],
      prefix: row.prefix,
    },
  });
}

export function rowsFromAbilityOrderedMap(
  map: Record<string, unknown>,
  source: AbilitySearchRow['source']
): AbilitySearchRow[] {
  const out: AbilitySearchRow[] = [];

  for (const [id, raw] of Object.entries(map)) {
    const cells = Array.isArray(raw) ? (Array.isArray(raw[0]) ? (raw[0] as unknown[]) : raw) : [];
    const key = String(cells[0] ?? '').trim();
    if (!key) continue;

    const faceCodeMatch = key.match(/^(.*?)_(\d+)$/);
    out.push({
      source,
      id,
      key,
      trigger: source === 'ability' ? String(cells[2] ?? '').trim() : '',
      faceCode: faceCodeMatch ? faceCodeMatch[1] : key,
      raw: cells,
    });
  }

  return out;
}

export function rowsFromAchievementOrderedMap(map: Record<string, unknown>): AchievementSearchRow[] {
  const out: AchievementSearchRow[] = [];

  for (const [id, raw] of Object.entries(map)) {
    const cells = Array.isArray(raw) ? (Array.isArray(raw[0]) ? (raw[0] as unknown[]) : raw) : [];
    if (!cells.length) continue;
    const key = String(cells[0] ?? '').trim();
    const prefix = normalizeSearchValue(key.replace(/^degree_/, '').replace(/_\d+$/, ''));
    out.push({
      id,
      key,
      sortId: String(cells[1] ?? '').trim(),
      name: String(cells[2] ?? '').trim(),
      nameJp: String(cells[3] ?? '').trim(),
      criteria: String(cells[4] ?? '').trim(),
      category: String(cells[5] ?? '').trim(),
      prefix,
      raw: cells,
    });
  }

  return out;
}
