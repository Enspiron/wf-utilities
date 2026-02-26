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
  // Ignore character_unique tracks
  if (path.includes('character_unique')) {
    return null;
  }

  // Remove 'bgm/' prefix
  const cleanPath = path.replace(/^bgm\//, '');
  const parts = cleanPath.split('/');

  if (parts.length < 2) {
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
    category = `World: ${worldName.charAt(0).toUpperCase() + worldName.slice(1)}`;
    subcategory = parts[1] || 'Other';
    name = parts.slice(2).join('/') || parts[1];
  } else {
    return null;
  }

  return {
    category,
    subcategory: subcategory.charAt(0).toUpperCase() + subcategory.slice(1),
    name
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

    for (const path of Object.keys(bgmData)) {
      const parsed = parseTrackPath(path);
      if (parsed) {
        tracks.push({
          path,
          name: parsed.name,
          category: parsed.category,
          subcategory: parsed.subcategory,
          url: `${CDN_BASE_URL}/${path}.mp3`,
          fallbackUrls: generateFallbackUrls(path)
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
