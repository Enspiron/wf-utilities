import { NextResponse } from 'next/server';
import { buildImageUrlFromPath as buildImageUrl, buildMusicFallbackUrls } from '@/lib/asset-url';
import { fetchDatalistJson, DATA_CACHE_HEADERS, ASSET_CDN_BASE as CDN_BASE_URL } from '@/lib/data-source';

type ArtworkKind = 'character' | 'event' | 'world' | 'quest' | 'fallback';

interface MusicTrack {
  path: string;
  name: string;
  category: string;
  subcategory: string;
  url: string;
  fallbackUrls: string[];
  artworkUrl: string | null;
  artworkUrls: string[];
  artworkKind: ArtworkKind;
  volume: number | null;
  bpm: number | null;
  trimStart: number | null;
  loopStart: number | null;
  loopEnd: number | null;
  timingGroup: number | null;
}

interface RawCharacter {
  DevNicknames?: unknown;
  ENName?: unknown;
  JPName?: unknown;
  songs?: unknown;
}

interface CharacterData {
  chars?: RawCharacter[];
}

interface ArtworkCandidate {
  urls: string[];
  kind: ArtworkKind;
}

interface CharacterArtwork {
  faceCode: string;
  label: string;
  url: string;
}

const CHARACTER_ART_BASE = `${CDN_BASE_URL}/wfjukebox/character/character_art`;
const FALLBACK_THUMBNAIL = 'quest/thumbnail/common/story';

const WORLD_THUMBNAILS: Record<string, string[]> = {
  world_grass: ['quest/thumbnail/world_tree/battle1_1_2'],
  world_desert: ['quest/thumbnail/world_sand/battle_2_1_2'],
  world_sea: ['quest/thumbnail/world_sea/battle_3_1_2'],
  world_beast: ['quest/thumbnail/world_beast/battle_4_1_2'],
  world_mecha: ['quest/thumbnail/world_mecha/battle_5_1_2'],
  world_japan: ['quest/thumbnail/world_japan/battle_6_1_2'],
  world_light: ['quest/thumbnail/world_light/battle_7_10_2'],
  world_hell: ['quest/thumbnail/world_hell/battle_8_1_2'],
  world_9: ['quest/thumbnail/world_9/battle_9_1_2'],
  world_10: ['quest/thumbnail/world_10/battle_10_1_3'],
  world_11: ['quest/thumbnail/world_11/battle_11_2_1'],
  world_12: ['quest/thumbnail/world_12/battle_12_1'],
  world_brave: ['quest/thumbnail/world_12/battle_12_1', 'quest/thumbnail/common/story'],
  world_boss_battle: ['quest/thumbnail/multi_battle/multi_pick_31_1'],
};

const EVENT_THUMBNAILS: Record<string, string[]> = {
  '2halfanv': [
    'quest/thumbnail/world_story_event/single_battle/2halfanv/2halfanv_single_battle',
    'quest/thumbnail/world_story_event/multi_battle/2halfanv/2halfanv_multi_boss_1',
  ],
  anv1: [
    'quest/thumbnail/world_story_event/single_battle/anv1/anv1_battle_14',
    'quest/thumbnail/world_story_event/multi_battle/anv1/multi_big_boss_anv1_1',
  ],
  anv1_countdown_event: ['quest/thumbnail/story_event/anv1_countdown_event/anv1_countdown_event_01'],
  anv2: [
    'quest/thumbnail/world_story_event/single_battle/anv2/anv2_battle_11',
    'quest/thumbnail/world_story_event/multi_battle/anv2/anv2_multi_boss_1',
  ],
  anv3: [
    'quest/thumbnail/world_story_event/single_battle/anv3/anv3_battle_8_expert',
    'quest/thumbnail/world_story_event/multi_battle/anv3/big_boss_1',
  ],
  anv3half: [
    'quest/thumbnail/world_story_event/single_battle/anv3half/anv3half_single_battle_expert',
    'quest/thumbnail/world_story_event/multi_battle/anv3half/big_boss_1',
  ],
  boss_battle_multi_pickup: ['quest/thumbnail/multi_battle/multi_pick_22_1'],
  boss_epuration_event: ['quest/thumbnail/advent_event/boss_epuration_event/1'],
  challenge_dungeon: ['quest/thumbnail/challenge_dungeon_event/challenge_dungeon_dark_1'],
  crown_beasts: [
    'quest/thumbnail/world_story_event/single_battle/crown_beasts/single_1',
    'quest/thumbnail/world_story_event/multi_battle/crown_beasts/big_boss_1',
  ],
  cyberpunk01: [
    'quest/thumbnail/world_story_event/single_battle/cyberpunk01/single_03',
    'quest/thumbnail/world_story_event/multi_battle/cyberpunk01/multi_conductor_strong',
  ],
  cyberpunk02_hero: [
    'quest/thumbnail/world_story_event/single_battle/cyberpunk02_hero/single_03',
    'quest/thumbnail/world_story_event/multi_battle/cyberpunk02_hero/multi_boss1_strong',
  ],
  desert_bonds_01: [
    'quest/thumbnail/world_story_event/single_battle/desert_bonds_01/single_03',
    'quest/thumbnail/world_story_event/multi_battle/desert_bonds_01/multi_big_boss_1',
  ],
  expert_single_event_01: ['quest/thumbnail/expert_single_event/administrator_100'],
  expert_single_side_story_01: ['quest/thumbnail/expert_single_side_story/big_boss_2halfanv'],
  fakeprincess01: [
    'quest/thumbnail/world_story_event/single_battle/fake_princess_01/single_10',
    'quest/thumbnail/world_story_event/multi_battle/fake_princess01/multi_simon_golem_1',
  ],
  haniwa_carnival: ['quest/thumbnail/haniwa_carnival/haniwa_carnival_01_red_01'],
  labyrinth_of_fluctuation: ['quest/thumbnail/tower_dungeon/low_area/low_area_1'],
  new_year_event_01: ['quest/thumbnail/story_event/story_event_new_year_01/story_event_new_year_01_01'],
  raid_event: ['quest/thumbnail/raid_event/raid_event_quest_thumbnail_01_001'],
  ranking_event: ['quest/thumbnail/time_attack_event/time_attack_event_01'],
  rush_battle_event: ['quest/thumbnail/rush_event/combat_diver_01/combat_diver_01_1'],
  score_attack_event: ['quest/thumbnail/score_attack_event/dragon_thunder'],
  solo_timeattack: ['quest/thumbnail/solo_time_attack/administrator_black'],
  summer_2020: [
    'quest/thumbnail/world_story_event/single_battle/summer_2020/main_boss_scenario',
    'quest/thumbnail/world_story_event/multi_battle/summer_2020/main_boss_1',
  ],
  summer_2021: [
    'quest/thumbnail/world_story_event/single_battle/summer_2021/single_12',
    'quest/thumbnail/world_story_event/multi_battle/summer_2021/big_boss_1',
  ],
  summer_2022: [
    'quest/thumbnail/world_story_event/single_battle/summer_2022/single_8',
    'quest/thumbnail/world_story_event/multi_battle/summer_2022/big_boss_1',
  ],
  tower_dungeon: ['quest/thumbnail/tower_dungeon/202007/area_6'],
  valen_2020: ['quest/thumbnail/story_event/valen_20/valen_20_01'],
  valentine2022: [
    'quest/thumbnail/world_story_event/single_battle/vt22/vt22_battle_8',
    'quest/thumbnail/world_story_event/multi_battle/vt22/vt22_multi_boss_1',
  ],
  vcollabo_towa: ['quest/thumbnail/story_event/vcollabo_towa/vcollabo_towa_10'],
  'xm19-event': ['quest/thumbnail/story_event/xm19/xmas19_battle_20'],
  yokai_emaki_01: [
    'quest/thumbnail/world_story_event/single_battle/yokai_emaki_01/single_03',
    'quest/thumbnail/world_story_event/multi_battle/yokai_emaki_01/multi_big_boss_1',
  ],
};

function humanizeSegment(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function uniqueUrls(values: string[]): string[] {
  return [...new Set(values.filter((value) => Boolean(value)))];
}

function normalizeLookupKey(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.mp3$/i, '');
}

function splitDevNicknames(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(/[;,/\n]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildCharacterArtworkMap(characters: RawCharacter[]): Map<string, CharacterArtwork> {
  const map = new Map<string, CharacterArtwork>();

  for (const character of characters) {
    const nicknames = splitDevNicknames(character.DevNicknames);
    const faceCode = nicknames[0];
    if (!faceCode) continue;

    const artwork: CharacterArtwork = {
      faceCode,
      label:
        typeof character.ENName === 'string' && character.ENName.trim()
          ? character.ENName.replace(/\s+/g, ' ').trim()
          : typeof character.JPName === 'string'
            ? character.JPName
            : faceCode,
      url: `${CHARACTER_ART_BASE}/${faceCode}/ui/square_0.png`,
    };

    for (const nickname of nicknames) {
      map.set(normalizeLookupKey(nickname), artwork);
    }

    if (Array.isArray(character.songs)) {
      for (const song of character.songs) {
        map.set(normalizeLookupKey(song), artwork);
      }
    }
  }

  return map;
}

function parseTrackPath(path: string): { category: string; subcategory: string; name: string } | null {
  // Remove 'bgm/' prefix
  const cleanPath = path.replace(/^bgm\//, '');
  const parts = cleanPath.split('/');

  if (parts.length < 1 || !parts[0]) {
    return null;
  }

  let category = '';
  let subcategory = '';
  let name = '';

  // Parse based on structure
  if (parts[0] === 'common') {
    category = 'Common';
    if (parts.length === 2) {
      // bgm/common/event_open_guild
      subcategory = 'General';
      name = parts[1];
    } else {
      // bgm/common/ambient/ambient_birdforest
      subcategory = parts[1];
      name = parts[2];
    }
  } else if (parts[0] === 'event') {
    category = 'Events';
    // bgm/event/labyrinth_of_fluctuation/labyrinth_of_fluctuation_normal_normal
    subcategory = parts[1];
    name = parts.slice(2).join('/');
  } else if (parts[0].startsWith('world_')) {
    // bgm/world_grass/battle/grass_battle_boss_boss
    const worldName = parts[0].replace('world_', '');
    category = `World: ${humanizeSegment(worldName)}`;
    subcategory = parts[1] || 'Other';
    name = parts.slice(2).join('/') || parts[1];
  } else if (parts[0] === 'character_unique') {
    // bgm/character_unique/alk/alk_ceremony
    category = 'Character Unique';
    subcategory = parts[1] || 'General';
    name = parts.slice(2).join('/') || parts[1] || cleanPath;
  } else {
    // Keep unknown roots visible instead of dropping them.
    category = humanizeSegment(parts[0]);
    subcategory = parts[1] || 'General';
    name = parts.slice(2).join('/') || parts[1] || cleanPath;
  }

  return {
    category,
    subcategory: humanizeSegment(subcategory),
    name,
  };
}

function getCharacterArtwork(path: string, characterArtworkByKey: Map<string, CharacterArtwork>): CharacterArtwork | null {
  const parts = path.split('/');
  if (parts[0] !== 'bgm' || parts[1] !== 'character_unique') return null;

  const folderKey = normalizeLookupKey(parts[2]);
  const songKey = normalizeLookupKey(parts[parts.length - 1]);
  const lookupKeys = [
    folderKey,
    songKey,
    folderKey.replace(/_(?:noroop|premaster)$/i, ''),
    songKey.replace(/_(?:noroop|premaster)$/i, ''),
  ];
  for (const key of lookupKeys) {
    const artwork = characterArtworkByKey.get(key);
    if (artwork) return artwork;
  }
  return null;
}

function getAdventEventCandidates(parts: string[], fullPath: string): string[] {
  const subevent = parts[2] || '';
  const normalized = fullPath.toLowerCase();
  const candidates: string[] = [];

  const pushIf = (needle: string, thumbnail: string) => {
    if (normalized.includes(needle)) candidates.push(thumbnail);
  };

  pushIf('z_collabo', 'quest/thumbnail/advent_event/Zcollab/1');
  pushIf('u_collabo', 'quest/thumbnail/advent_event/u_collabo/1');
  pushIf('s_collabo', 'quest/thumbnail/advent_event/scollab/1');
  pushIf('r_collabo', 'quest/thumbnail/advent_event/Rcollab/1');
  pushIf('k_collabo', 'quest/thumbnail/advent_event/k_collabo/1');
  pushIf('g_collabo', 'quest/thumbnail/advent_event/Gcollab/1');
  pushIf('b_collabo', 'quest/thumbnail/advent_event/b_collabo/1');
  pushIf('hw20', 'quest/thumbnail/advent_event/hw20/1');
  pushIf('xm20', 'quest/thumbnail/advent_event/xm20/1');
  pushIf('dark', 'quest/thumbnail/advent_event/dragon_dark/1');
  pushIf('fire', 'quest/thumbnail/advent_event/dragon_fire/1');
  pushIf('light', 'quest/thumbnail/advent_event/dragon_light/1');
  pushIf('thunder', 'quest/thumbnail/advent_event/dragon_thunder/1');
  pushIf('water', 'quest/thumbnail/advent_event/dragon_water/1');
  pushIf('wind', 'quest/thumbnail/advent_event/dragon_wind/1');

  if (subevent.includes('007')) candidates.push('quest/thumbnail/advent_event/dragon_wind/1');
  if (subevent.includes('005')) candidates.push('quest/thumbnail/advent_event/dragon_water/1');
  if (subevent.includes('004')) candidates.push('quest/thumbnail/advent_event/dragon_dark/1');
  if (subevent.includes('003')) candidates.push('quest/thumbnail/advent_event/dragon_light/1');
  if (subevent.includes('002')) candidates.push('quest/thumbnail/advent_event/dragon_fire/1');
  if (subevent.includes('001')) candidates.push('quest/thumbnail/advent_event/dragon_thunder/1');

  candidates.push('quest/thumbnail/advent_event/dragon_fire/1');
  return candidates;
}

function getSpiritBeastCandidates(parts: string[]): string[] {
  const subevent = (parts[2] || '').replace('darkness', 'dark');
  const known = [
    'spirit_beast_storm',
    'spirit_beast_water',
    'spirit_beast_thunder',
    'spirit_beast_light',
    'spirit_beast_fire',
    'spirit_beast_dark',
  ];
  const match = known.find((key) => subevent.includes(key));
  return [match ? `quest/thumbnail/advent_event/${match}/1` : 'quest/thumbnail/advent_event/spirit_beast_fire/1'];
}

function getSteamRobotCandidates(parts: string[]): string[] {
  const subevent = parts[2] || '';
  const elements = ['another', 'dark', 'fire', 'light', 'thunder', 'water', 'wind'];
  const match = elements.find((element) => subevent.includes(element));
  return [
    match
      ? `quest/thumbnail/advent_event/steam_robot_${match}/1`
      : 'quest/thumbnail/advent_event/steam_robot_fire/1',
  ];
}

function getEventArtworkCandidates(parts: string[], path: string): string[] {
  const eventKey = parts[1] || '';
  if (eventKey === 'advent_event') return getAdventEventCandidates(parts, path);
  if (eventKey === 'advent_event_spirit_beast') return getSpiritBeastCandidates(parts);
  if (eventKey === 'advent_steam_robot') return getSteamRobotCandidates(parts);
  return EVENT_THUMBNAILS[eventKey] || [];
}

function resolveArtwork(path: string, characterArtworkByKey: Map<string, CharacterArtwork>): ArtworkCandidate {
  const characterArtwork = getCharacterArtwork(path, characterArtworkByKey);
  if (characterArtwork) {
    return {
      kind: 'character',
      urls: uniqueUrls([characterArtwork.url, buildImageUrl(FALLBACK_THUMBNAIL)]),
    };
  }

  const cleanPath = path.replace(/^bgm\//, '');
  const parts = cleanPath.split('/');
  const root = parts[0] || '';

  if (root === 'event') {
    const eventCandidates = getEventArtworkCandidates(parts, path);
    if (eventCandidates.length === 0) {
      return {
        kind: 'fallback',
        urls: [buildImageUrl(FALLBACK_THUMBNAIL)],
      };
    }

    return {
      kind: 'event',
      urls: uniqueUrls([...eventCandidates.map(buildImageUrl), buildImageUrl(FALLBACK_THUMBNAIL)]),
    };
  }

  if (root.startsWith('world_')) {
    return {
      kind: 'world',
      urls: uniqueUrls([...(WORLD_THUMBNAILS[root] || []).map(buildImageUrl), buildImageUrl(FALLBACK_THUMBNAIL)]),
    };
  }

  if (root === 'common') {
    return {
      kind: 'quest',
      urls: uniqueUrls([buildImageUrl(path.includes('tutorial') ? 'quest/thumbnail/common/tutorial' : FALLBACK_THUMBNAIL)]),
    };
  }

  return {
    kind: 'fallback',
    urls: [buildImageUrl(FALLBACK_THUMBNAIL)],
  };
}

function parseNumberToken(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;
  const token = value.trim();
  if (!token || token === '(None)') return null;
  const parsed = Number(token);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTimingMeta(raw: unknown): {
  volume: number | null;
  bpm: number | null;
  trimStart: number | null;
  loopStart: number | null;
  loopEnd: number | null;
  timingGroup: number | null;
} {
  if (!Array.isArray(raw)) {
    return {
      volume: null,
      bpm: null,
      trimStart: null,
      loopStart: null,
      loopEnd: null,
      timingGroup: null,
    };
  }

  return {
    volume: parseNumberToken(raw[0]),
    bpm: parseNumberToken(raw[1]),
    trimStart: parseNumberToken(raw[2]),
    loopStart: parseNumberToken(raw[3]),
    loopEnd: parseNumberToken(raw[4]),
    timingGroup: parseNumberToken(raw[5]),
  };
}

export async function GET() {
  try {
    const [bgmData, characterData] = await Promise.all([
      fetchDatalistJson<Record<string, unknown>>('datalist/asset/bgm_asset.json'),
      fetchDatalistJson<CharacterData>('characters_all.json').catch(() => ({ chars: [] })),
    ]);
    const characterArtworkByKey = buildCharacterArtworkMap(characterData.chars || []);

    const tracks: MusicTrack[] = [];

    for (const [path, rawValue] of Object.entries(bgmData)) {
      const parsed = parseTrackPath(path);
      if (parsed) {
        const timing = parseTimingMeta(rawValue);
        const artwork = resolveArtwork(path, characterArtworkByKey);
        tracks.push({
          path,
          name: parsed.name,
          category: parsed.category,
          subcategory: parsed.subcategory,
          url: `${CDN_BASE_URL}/${path}.mp3`,
          fallbackUrls: buildMusicFallbackUrls(path, { includePrimary: false }),
          artworkUrl: artwork.urls[0] || null,
          artworkUrls: artwork.urls,
          artworkKind: artwork.kind,
          ...timing,
        });
      }
    }

    // Sort by category, then subcategory, then name
    tracks.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.subcategory !== b.subcategory) return a.subcategory.localeCompare(b.subcategory);
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ tracks, count: tracks.length }, { headers: DATA_CACHE_HEADERS });
  } catch (error) {
    console.error('Error loading music data:', error);
    return NextResponse.json({ error: 'Failed to load music data', tracks: [] }, { status: 500 });
  }
}
