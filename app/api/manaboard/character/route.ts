import { NextRequest, NextResponse } from 'next/server';
import { buildManaBoardCharacterPayload, loadManaBoardDatasets } from '../_data';

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')?.trim();
    if (!id) {
      return NextResponse.json({ error: 'Character id is required' }, { status: 400 });
    }

    const datasets = await loadManaBoardDatasets();
    const payload = buildManaBoardCharacterPayload(id, datasets);

    if (!payload) {
      return NextResponse.json({ error: 'Mana board data not found for character' }, { status: 404 });
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Failed to load mana board detail:', error);
    return NextResponse.json({ error: 'Failed to load mana board detail' }, { status: 500 });
  }
}

