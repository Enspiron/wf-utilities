import { NextRequest, NextResponse } from 'next/server';
import { DATA_CACHE_HEADERS } from '@/lib/data-source';
import { searchGlobalIndex } from '@/lib/search/global-index';

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q') || '';
    const limitParam = Number.parseInt(request.nextUrl.searchParams.get('limit') || '40', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 80) : 40;

    const { results, operators } = await searchGlobalIndex(query, limit);

    return NextResponse.json(
      {
        query,
        results,
        operators,
        count: results.length,
      },
      { headers: DATA_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Global search failed:', error);
    return NextResponse.json({ error: 'Failed to perform global search.' }, { status: 500 });
  }
}
