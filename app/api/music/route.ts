import { NextResponse } from 'next/server';

const USE_CDN = process.env.VERCEL === '1';
const CDN_BASE_URL = 'https://wfjukebox.b-cdn.net';

interface MusicTrack {
  path: string;
  name: string;
  category: string;
  subcategory: string;
  url: string;
  fallbackUrls: string[];
  volume: number | null;
  bpm: number | null;
  trimStart: number | null;
  loopStart: number | null;
  loopEnd: number | null;
  timingGroup: number | null;
}

function humanizeSegment(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function generateFallbackUrls(path: string): string[] {
  const CDN_BASE = 'https://wfjukebox.b-cdn.net/music';
  const fallbacks: string[] = [];
  
  // bgm/world_12/story/world_12_story_its_not_over → music/StoryBGM/world_12/story/world_12_story_its_not_over.mp3
  if (path.startsWith('bgm/world_')) {
    fallbacks.push(`${CDN_BASE}/StoryBGM/${path.replace('bgm/', '')}.mp3`);
  }
  
  // bgm/event/2halfanv/battle/2halfanv_battle_zako → music/event/2halfanv/battle/2halfanv_battle_zako.mp3
  if (path.startsWith('bgm/event/')) {
    fallbacks.push(`${CDN_BASE}/${path.replace('bgm/', '')}.mp3`);
  }
  
  // bgm/common/* → music/common/*
  if (path.startsWith('bgm/common/')) {
    fallbacks.push(`${CDN_BASE}/${path.replace('bgm/', '')}.mp3`);
  }
  
  // Generic fallback pattern
  if (fallbacks.length === 0) {
    fallbacks.push(`${CDN_BASE}/${path.replace('bgm/', '')}.mp3`);
  }
  
  return fallbacks;
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
    name
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
    let bgmData: Record<string, unknown>;

    if (USE_CDN) {
      // Fetch from CDN in production
      const bgmUrl = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data/datalist/asset/bgm_asset.json';
      const response = await fetch(bgmUrl, { next: { revalidate: 3600 } });
      bgmData = await response.json();
    } else {
      // Use local files in development
      const fs = await import('fs');
      const path = await import('path');
      const bgmPath = path.join(process.cwd(), 'public', 'data', 'datalist', 'asset', 'bgm_asset.json');
      bgmData = JSON.parse(fs.readFileSync(bgmPath, 'utf-8'));
    }

    const tracks: MusicTrack[] = [];

    for (const [path, rawValue] of Object.entries(bgmData)) {
      const parsed = parseTrackPath(path);
      if (parsed) {
        const timing = parseTimingMeta(rawValue);
        tracks.push({
          path,
          name: parsed.name,
          category: parsed.category,
          subcategory: parsed.subcategory,
          url: `${CDN_BASE_URL}/${path}.mp3`,
          fallbackUrls: generateFallbackUrls(path),
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

    return NextResponse.json({
      tracks,
      count: tracks.length
    });
  } catch (error) {
    console.error('Error loading music data:', error);
    return NextResponse.json(
      { error: 'Failed to load music data', tracks: [] },
      { status: 500 }
    );
  }
}
