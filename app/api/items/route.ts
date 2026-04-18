import { NextResponse } from 'next/server';
import { getCatalogEntriesForApi, type ItemCatalogEntry } from '@/lib/item-catalog';
import { DATA_CACHE_HEADERS } from '@/lib/data-source';

export type Item = ItemCatalogEntry;

export async function GET() {
  try {
    const items = await getCatalogEntriesForApi();

    return NextResponse.json(
      { items, count: items.length },
      { headers: DATA_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Error loading items:', error);
    return NextResponse.json({ error: 'Failed to load items' }, { status: 500 });
  }
}
