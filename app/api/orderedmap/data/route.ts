import { NextRequest, NextResponse } from 'next/server';
import { fetchOrderedMapJson, DATA_CACHE_HEADERS } from '@/lib/data-source';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const rawFile = searchParams.get('file');
    const lang = searchParams.get('lang') === 'en' ? 'en' : 'jp';

    if (!category || !rawFile) {
      return NextResponse.json(
        { error: 'Category and file parameters are required' },
        { status: 400 }
      );
    }

    const file = rawFile.replace(/\.json$/i, '');
    const dataFolder = lang === 'en' ? 'datalist_en' : 'datalist';
    const relativePath = `${dataFolder}/${category}/${file}.json`;

    const jsonData = await fetchOrderedMapJson(relativePath);
    if (jsonData === null) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json(
      { category, file, data: jsonData, lang },
      { headers: DATA_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error reading orderedmap file:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
