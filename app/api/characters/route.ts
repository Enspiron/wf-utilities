import { NextResponse } from 'next/server';
import { parseCharacterData } from '@/lib/character-parser';

const USE_CDN = process.env.VERCEL === '1';
const CDN_BASE_URL = 'https://wfjukebox.b-cdn.net/data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'both';

   if (USE_CDN) {
      // Fetch from CDN in production
      const characterUrl = `${CDN_BASE_URL}/datalist/character/character.json`;
      const characterTextUrl = `${CDN_BASE_URL}/datalist/character/character_text.json`;
      const characterTextEnUrl = `${CDN_BASE_URL}/datalist_en/character/character_text.json`;

      const [characterRes, characterTextRes, characterTextEnRes] = await Promise.all([
        fetch(characterUrl, { next: { revalidate: 3600 } }),
        fetch(characterTextUrl, { next: { revalidate: 3600 } }),
        (lang === 'en' || lang === 'both') 
          ? fetch(characterTextEnUrl, { next: { revalidate: 3600 } }).catch(() => null)
          : Promise.resolve(null),
      ]);

      const characterData = await characterRes.json();
      const characterTextData = await characterTextRes.json();
      const characterTextDataEN = characterTextEnRes ? await characterTextEnRes.json() : undefined;

      const characters = parseCharacterData(
        characterData,
        characterTextData,
        characterTextDataEN
      );

      return NextResponse.json({
        characters,
        lang,
        count: characters.length,
      });
    } else {
      // Use local files in development
      const fs = await import('fs');
      const path = await import('path');

      const datalistPath = path.join(process.cwd(), 'public', 'data', 'datalist');
      const datalistEnPath = path.join(process.cwd(), 'public', 'data', 'datalist_en');

      const characterPath = path.join(datalistPath, 'character', 'character.json');
      const characterData = JSON.parse(fs.readFileSync(characterPath, 'utf-8'));

      const characterTextPath = path.join(datalistPath, 'character', 'character_text.json');
      const characterTextData = JSON.parse(fs.readFileSync(characterTextPath, 'utf-8'));

      let characterTextDataEN;
      if (lang === 'en' || lang === 'both') {
        const characterTextEnPath = path.join(datalistEnPath, 'character', 'character_text.json');
        if (fs.existsSync(characterTextEnPath)) {
          characterTextDataEN = JSON.parse(fs.readFileSync(characterTextEnPath, 'utf-8'));
        }
      }

      const characters = parseCharacterData(
        characterData,
        characterTextData,
        characterTextDataEN
      );

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
