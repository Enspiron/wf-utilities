import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parseCharacterData } from '@/lib/character-parser';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'both';

    const datalistPath = path.join(process.cwd(), 'app', 'api', 'orderedmap', 'datalist');
    const datalistEnPath = path.join(process.cwd(), 'app', 'api', 'orderedmap', 'datalist_en');

    // Read character.json
    const characterPath = path.join(datalistPath, 'character', 'character.json');
    const characterData = JSON.parse(fs.readFileSync(characterPath, 'utf-8'));

    // Read character_text.json (JP)
    const characterTextPath = path.join(datalistPath, 'character', 'character_text.json');
    const characterTextData = JSON.parse(fs.readFileSync(characterTextPath, 'utf-8'));

    // Read character_text.json (EN) if available
    let characterTextDataEN;
    if (lang === 'en' || lang === 'both') {
      const characterTextEnPath = path.join(datalistEnPath, 'character', 'character_text.json');
      if (fs.existsSync(characterTextEnPath)) {
        characterTextDataEN = JSON.parse(fs.readFileSync(characterTextEnPath, 'utf-8'));
      }
    }

    // Parse character data
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
  } catch (error) {
    console.error('Error loading character data:', error);
    return NextResponse.json(
      { error: 'Failed to load character data' },
      { status: 500 }
    );
  }
}
