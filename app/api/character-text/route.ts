import { NextRequest, NextResponse } from 'next/server';
import { fetchDatalistJson, DATA_CACHE_HEADERS } from '@/lib/data-source';

export async function GET(request: NextRequest) {
  try {
    const lang = request.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'jp';
    const dataFolder = lang === 'en' ? 'datalist_en' : 'datalist';

    try {
      const jsonData = await fetchDatalistJson(`${dataFolder}/character/character_text.json`);
      return NextResponse.json({ data: jsonData, lang }, { headers: DATA_CACHE_HEADERS });
    } catch {
      return NextResponse.json({ error: 'Character text file not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error reading character text file:', error);
    return NextResponse.json({ error: 'Failed to read character text' }, { status: 500 });
  }
}
