import { NextResponse } from 'next/server';
import { fetchDatalistJson, DATA_CACHE_HEADERS } from '@/lib/data-source';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const devnickname = searchParams.get('devnickname');

    if (!devnickname) {
      return NextResponse.json({ error: 'devnickname parameter is required' }, { status: 400 });
    }

    const bgmData = await fetchDatalistJson<Record<string, unknown>>(
      'datalist/asset/bgm_asset.json'
    );

    // Find all character theme songs for this devnickname
    const prefix = `bgm/character_unique/${devnickname}/`;
    const themes: { path: string; songName: string; url: string }[] = [];

    for (const key of Object.keys(bgmData)) {
      if (key.startsWith(prefix)) {
        const songName = key.substring(prefix.length);
        themes.push({
          path: key,
          songName,
          url: `https://wfjukebox.b-cdn.net/${key}.mp3`,
        });
      }
    }

    // If no themes found in bgm_asset.json, add fallback sources
    if (themes.length === 0) {
      themes.push({
        path: `character_unique/${devnickname}/${devnickname}`,
        songName: devnickname,
        url: `https://wfjukebox.b-cdn.net/music/character_unique/${devnickname}/${devnickname}.mp3`,
      });
    }

    return NextResponse.json(
      { devnickname, themes, count: themes.length },
      { headers: DATA_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error loading character theme:', error);
    return NextResponse.json({ error: 'Failed to load character theme data' }, { status: 500 });
  }
}
