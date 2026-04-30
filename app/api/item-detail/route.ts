import { NextRequest, NextResponse } from 'next/server';
import { DATA_CACHE_HEADERS } from '@/lib/data-source';
import { getItemDetailData, type CatalogEntryType } from '@/lib/item-catalog';

function normalizeType(value: string | null): CatalogEntryType | null {
  if (value === 'item' || value === 'equipment') return value;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const type = normalizeType(request.nextUrl.searchParams.get('type'));
    const id = request.nextUrl.searchParams.get('id')?.trim() || '';

    if (!type) {
      return NextResponse.json({ error: 'type must be `item` or `equipment`' }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
    }

    const detail = await getItemDetailData(type, id);
    if (!detail) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json(detail, { headers: DATA_CACHE_HEADERS });
  } catch (error) {
    console.error('Failed to load item detail data:', error);
    return NextResponse.json({ error: 'Failed to load item detail data' }, { status: 500 });
  }
}
