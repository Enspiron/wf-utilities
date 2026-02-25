import { NextResponse } from 'next/server';

const USE_CDN = process.env.VERCEL === '1';
const CDN_BASE_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const devnickname = searchParams.get('devnickname');

    if (!devnickname) {
      return NextResponse.json(
        { error: 'devnickname parameter is required' },
        { status: 400 }
      );
    }

    let bgmData: Record<string, unknown>;

    if (USE_CDN) {
      // Fetch from CDN in production
      const bgmUrl = `${CDN_BASE_URL}/datalist/asset/bgm_asset.json`;
      const response = await fetch(bgmUrl, { next: { revalidate: 3600 } });
      bgmData = await response.json();
    } else {
      // Use local files in development
      const fs = await import('fs');
      const path = await import('path');
      const bgmPath = path.join(process.cwd(), 'public', 'data', 'datalist', 'asset', 'bgm_asset.json');
      bgmData = JSON.parse(fs.readFileSync(bgmPath, 'utf-8'));
    }

    // Find all character theme songs for this devnickname
    const prefix = `bgm/character_unique/${devnickname}/`;
    const themes: { path: string; songName: string; url: string }[] = [];

    for (const [key] of Object.entries(bgmData)) {
      if (key.startsWith(prefix)) {
        const songName = key.substring(prefix.length);
        themes.push({
          path: key,
          songName,
          url: `https://wfjukebox.b-cdn.net/${key}.mp3`,
        });
      }
    }

    return NextResponse.json({
      devnickname,
      themes,
      count: themes.length,
    });
  } catch (error) {
    console.error('Error loading character theme:', error);
    return NextResponse.json(
      { error: 'Failed to load character theme data' },
      { status: 500 }
    );
  }
}
