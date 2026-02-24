import { NextResponse } from 'next/server';
import { parseCharacterAllData } from '@/lib/character-parser';

const USE_CDN = process.env.VERCEL === '1';
const CDN_BASE_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'both';

   if (USE_CDN) {
      // Fetch from CDN in production
      const characterUrl = `${CDN_BASE_URL}/characters_all.json`;

      const characterRes = await fetch(characterUrl, { next: { revalidate: 3600 } });
      const characterData = await characterRes.json();

      const characters = parseCharacterAllData(characterData);

      return NextResponse.json({
        characters,
        lang,
        count: characters.length,
      });
    } else {
      // Use local files in development
      const fs = await import('fs');
      const path = await import('path');

      const characterPath = path.join(process.cwd(), 'public', 'data', 'characters_all.json');
      const characterData = JSON.parse(fs.readFileSync(characterPath, 'utf-8'));

      const characters = parseCharacterAllData(characterData);

      return NextResponse.json({
        characters,
        lang,
        count: characters.length,
      });
    }
  } catch (error) {
    console.error('Error loading character data:', error);
    return NextResponse.json(
      { error: 'Failed to load character data' },
      { status: 500 }
    );
  }
}
