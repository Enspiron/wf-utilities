import { NextResponse } from 'next/server';
import { buildManaBoardListPayload, loadManaBoardDatasets } from '../_data';

export async function GET() {
  try {
    const datasets = await loadManaBoardDatasets();
    const payload = buildManaBoardListPayload(datasets);

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Failed to load mana board list:', error);
    return NextResponse.json({ error: 'Failed to load mana board list' }, { status: 500 });
  }
}

