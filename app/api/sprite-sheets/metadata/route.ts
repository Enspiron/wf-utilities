import { NextRequest, NextResponse } from 'next/server';
import { DATA_CACHE_HEADERS } from '@/lib/data-source';

const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;

function normalizeBase(raw: string): string {
  const trimmed = raw.trim().split(/[?#]/)[0].replace(/[),.;]+$/, '');
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'wfjukebox.b-cdn.net') return '';
    return `${CDN_ROOT}${parsed.pathname.replace(IMAGE_EXT_RE, '').replace(/\/+$/, '')}`;
  }

  return `${CDN_ROOT}/${trimmed.replace(/^\/+/, '').replace(IMAGE_EXT_RE, '').replace(/\/+$/, '')}`;
}

async function readJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    cache: 'force-cache',
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  const rawBase = request.nextUrl.searchParams.get('base');
  if (!rawBase) {
    return NextResponse.json({ error: 'Missing base parameter' }, { status: 400 });
  }

  let base = '';
  try {
    base = normalizeBase(rawBase);
  } catch {
    return NextResponse.json({ error: 'Invalid base parameter' }, { status: 400 });
  }

  if (!base) {
    return NextResponse.json({ error: 'Invalid base parameter' }, { status: 400 });
  }

  const urls = {
    atlas: `${base}.atlas.json`,
    timeline: `${base}.timeline.json`,
    parts: `${base}.parts.json`,
  };

  try {
    const [atlas, timeline, parts] = await Promise.all([
      readJson(urls.atlas),
      readJson(urls.timeline),
      readJson(urls.parts),
    ]);

    return NextResponse.json(
      {
        base,
        urls,
        atlas,
        timeline,
        parts,
      },
      { headers: DATA_CACHE_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Metadata companions were not found for this sprite sheet',
        base,
        urls,
        detail: error instanceof Error ? error.message : 'Unknown metadata fetch error',
      },
      { status: 404 }
    );
  }
}
