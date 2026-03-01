import { NextRequest, NextResponse } from 'next/server';

type ComicLanguage = 'en' | 'jp' | 'cn' | 'kr' | 'th';

interface ComicEpisode {
  episode: number;
  title: string;
  commenceTime: string | null;
}

const CDN_ROOT = 'https://wfjukebox.b-cdn.net';

const COMIC_SOURCES: Record<
  ComicLanguage,
  { folder: string; metadataUrls: string[]; displayName: string }
> = {
  en: {
    folder: 'comics-en',
    metadataUrls: [`${CDN_ROOT}/comics/comics-en/metadata.json`, `${CDN_ROOT}/comics/en-comics.json`],
    displayName: 'English',
  },
  jp: {
    folder: 'comics-jp',
    metadataUrls: [`${CDN_ROOT}/comics/jp-comics.json`],
    displayName: 'Japanese',
  },
  cn: {
    folder: 'comics-cn',
    metadataUrls: [`${CDN_ROOT}/comics/cn-comics.json`],
    displayName: 'Chinese',
  },
  kr: {
    folder: 'comics-kr',
    metadataUrls: [`${CDN_ROOT}/comics/comics-kr/metadata.json`],
    displayName: 'Korean',
  },
  th: {
    folder: 'comics-thai',
    metadataUrls: [`${CDN_ROOT}/comics/comics-thai/metadata.json`],
    displayName: 'Thai',
  },
};

function parseEpisode(value: unknown): number | null {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function parseTitle(value: unknown, episode: number): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `Episode ${episode}`;
}

function parseCommenceTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  return token.length > 0 ? token : null;
}

function normalizeEpisodes(payload: unknown): ComicEpisode[] {
  if (!Array.isArray(payload)) return [];

  const results: ComicEpisode[] = [];
  for (const row of payload) {
    if (!row || typeof row !== 'object') continue;
    const obj = row as Record<string, unknown>;
    const episode = parseEpisode(obj.episode);
    if (!episode) continue;

    results.push({
      episode,
      title: parseTitle(obj.title, episode),
      commenceTime: parseCommenceTime(obj.commenceTime),
    });
  }

  return results.sort((a, b) => {
    const aTime = a.commenceTime ? Date.parse(a.commenceTime.replace(' ', 'T')) : Number.NaN;
    const bTime = b.commenceTime ? Date.parse(b.commenceTime.replace(' ', 'T')) : Number.NaN;
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
      return aTime - bTime;
    }
    return a.episode - b.episode;
  });
}

async function fetchEpisodesForLanguage(lang: ComicLanguage): Promise<{ episodes: ComicEpisode[]; sourceUrl: string }> {
  const source = COMIC_SOURCES[lang];
  for (const url of source.metadataUrls) {
    try {
      const response = await fetch(url, {
        next: { revalidate: 3600 },
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const episodes = normalizeEpisodes(payload);
      if (episodes.length > 0) {
        return { episodes, sourceUrl: url };
      }
    } catch {
      // Try the next source URL.
    }
  }

  return { episodes: [], sourceUrl: source.metadataUrls[0] ?? '' };
}

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('lang')?.toLowerCase() ?? 'en';
  const lang: ComicLanguage = requested in COMIC_SOURCES ? (requested as ComicLanguage) : 'en';
  const config = COMIC_SOURCES[lang];

  try {
    const { episodes, sourceUrl } = await fetchEpisodesForLanguage(lang);
    return NextResponse.json(
      {
        lang,
        languageLabel: config.displayName,
        folder: config.folder,
        sourceUrl,
        count: episodes.length,
        episodes,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('Failed to load comics metadata', error);
    return NextResponse.json(
      {
        error: 'Failed to load comics metadata',
        lang,
        languageLabel: config.displayName,
        folder: config.folder,
        sourceUrl: null,
        count: 0,
        episodes: [],
      },
      { status: 500 }
    );
  }
}
