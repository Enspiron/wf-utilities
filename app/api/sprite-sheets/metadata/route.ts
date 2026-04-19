import { NextRequest, NextResponse } from 'next/server';
import { DATA_CACHE_HEADERS } from '@/lib/data-source';
import { ASSET_CDN_ROOT, normalizeAssetPath } from '@/lib/asset-url';

const CDN_ROOT = ASSET_CDN_ROOT;
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;

type AtlasEntry = {
  n?: string;
};

type TimelinePayload = {
  sequences?: Array<{
    begin?: number | string;
    end?: number | string;
  }>;
};

function normalizeBase(raw: string): string {
  const trimmed = raw.trim().split(/[?#]/)[0].replace(/[),.;]+$/, '');
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'wfjukebox.b-cdn.net') return '';
    return `${CDN_ROOT}/${normalizeAssetPath(parsed.pathname).replace(IMAGE_EXT_RE, '').replace(/\/+$/, '')}`;
  }

  return `${CDN_ROOT}/${normalizeAssetPath(trimmed).replace(IMAGE_EXT_RE, '').replace(/\/+$/, '')}`;
}

function getPixelartMetadataInfo(base: string) {
  const assetPath = normalizeAssetPath(base).replace(IMAGE_EXT_RE, '').replace(/\/+$/, '').toLowerCase();
  const match = assetPath.match(/^character\/[^/]+\/pixelart\/(sprite_sheet|special_sprite_sheet)$/);
  if (!match) return null;

  const directory = assetPath.split('/').slice(0, -1).join('/');
  const prefix = match[1] === 'special_sprite_sheet' ? 'special' : 'pixelart';
  return {
    assetPath,
    prefix,
    urls: {
      atlas: `${CDN_ROOT}/${assetPath}.atlas.json`,
      timeline: `${CDN_ROOT}/${directory}/${prefix}.timeline.json`,
      frame: `${CDN_ROOT}/${directory}/${prefix}.frame.json`,
    },
  };
}

function toNumber(value: number | string | undefined, fallback: number | string = 0): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;
  const fallbackParsed = Number(fallback);
  return Number.isFinite(fallbackParsed) ? fallbackParsed : 0;
}

function getTimelineEnd(timeline: unknown): number {
  const sequences = Array.isArray((timeline as TimelinePayload | null)?.sequences)
    ? (timeline as TimelinePayload).sequences || []
    : [];
  return Math.max(
    1,
    ...sequences.map((sequence) => Math.floor(toNumber(sequence.end, sequence.begin || 1)))
  );
}

function getAtlasFrameStart(entry: AtlasEntry, prefix: string): number | null {
  const name = typeof entry.n === 'string' ? entry.n : '';
  const match = name.match(new RegExp(`${prefix}(\\d+)$`, 'i'));
  if (!match) return null;
  return Math.max(0, Number.parseInt(match[1], 10) - 2);
}

function buildFramePartsFromAtlas(atlas: unknown, timeline: unknown, prefix: string) {
  if (!Array.isArray(atlas)) return null;

  const ordered = (atlas as AtlasEntry[])
    .map((entry, index) => ({
      index,
      start: getAtlasFrameStart(entry, prefix),
    }))
    .filter((entry): entry is { index: number; start: number } => entry.start !== null)
    .sort((a, b) => a.start - b.start || a.index - b.index);

  if (!ordered.length) return null;

  ordered[0].start = 0;
  const totalFrames = Math.max(getTimelineEnd(timeline), (ordered.at(-1)?.start ?? 0) + 1);
  const segments = ordered
    .filter((entry) => entry.start < totalFrames)
    .map((entry, index) => {
      const nextStart = ordered[index + 1]?.start ?? totalFrames;
      return {
        s: entry.start,
        i: entry.index,
        l: [{ t: Math.max(1, nextStart - entry.start) }],
      };
    });

  return {
    i: (atlas as AtlasEntry[]).map((entry) => ({ p: entry.n })),
    g: [{ t: totalFrames, s: segments }],
  };
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

function getPublicAssetUrl(request: NextRequest, assetPath: string): string {
  return new URL(`/assets/${normalizeAssetPath(assetPath)}`, request.nextUrl.origin).toString();
}

async function readPixelartJson(request: NextRequest, assetPath: string, cdnUrl: string): Promise<unknown> {
  try {
    return await readJson(getPublicAssetUrl(request, assetPath));
  } catch {
    return readJson(cdnUrl);
  }
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

  const pixelart = getPixelartMetadataInfo(base);
  const urls = {
    atlas: `${base}.atlas.json`,
    timeline: `${base}.timeline.json`,
    parts: `${base}.parts.json`,
  };

  try {
    if (pixelart) {
      const directory = pixelart.assetPath.split('/').slice(0, -1).join('/');
      const [atlas, timeline, frame] = await Promise.all([
        readPixelartJson(request, `${pixelart.assetPath}.atlas.json`, pixelart.urls.atlas),
        readPixelartJson(request, `${directory}/${pixelart.prefix}.timeline.json`, pixelart.urls.timeline),
        readPixelartJson(request, `${directory}/${pixelart.prefix}.frame.json`, pixelart.urls.frame),
      ]);
      const parts = buildFramePartsFromAtlas(atlas, timeline, pixelart.prefix);
      if (!parts) throw new Error('Could not build frame parts from pixelart atlas');

      return NextResponse.json(
        {
          base,
          urls: {
            ...pixelart.urls,
            parts: 'generated from frame atlas',
          },
          atlas,
          timeline,
          parts,
          frame,
          metadataKind: 'frame',
        },
        { headers: DATA_CACHE_HEADERS }
      );
    }

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
