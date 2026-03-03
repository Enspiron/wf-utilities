import type { Metadata } from 'next';
import { Suspense } from 'react';
import ComicsClient from './comics-client';

type SearchParamValue = string | string[] | undefined;
type ComicLanguage = 'en' | 'jp' | 'cn' | 'kr' | 'th';

type ComicsPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

interface ComicEpisodeMeta {
  episode: number;
  title: string;
  commenceTime: string | null;
}

const CDN_ROOT = 'https://wfjukebox.b-cdn.net';
const DEFAULT_DESCRIPTION =
  'Browse World Flipper comic episodes and open a specific episode with shareable deep links.';

const COMIC_SOURCES: Record<
  ComicLanguage,
  { folder: string; displayName: string; metadataUrls: string[] }
> = {
  en: {
    folder: 'comics-en',
    displayName: 'English',
    metadataUrls: [`${CDN_ROOT}/comics/comics-en/metadata.json`, `${CDN_ROOT}/comics/en-comics.json`],
  },
  jp: {
    folder: 'comics-jp',
    displayName: 'Japanese',
    metadataUrls: [`${CDN_ROOT}/comics/jp-comics.json`],
  },
  cn: {
    folder: 'comics-cn',
    displayName: 'Chinese',
    metadataUrls: [`${CDN_ROOT}/comics/cn-comics.json`],
  },
  kr: {
    folder: 'comics-kr',
    displayName: 'Korean',
    metadataUrls: [`${CDN_ROOT}/comics/comics-kr/metadata.json`],
  },
  th: {
    folder: 'comics-thai',
    displayName: 'Thai',
    metadataUrls: [`${CDN_ROOT}/comics/comics-thai/metadata.json`],
  },
};

function getSiteBaseUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (explicit) {
    try {
      return new URL(explicit);
    } catch {
      // ignore malformed env value
    }
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return new URL('http://localhost:3000');
}

function getFirstParam(value: SearchParamValue): string | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function parseLanguage(value: string | null): ComicLanguage {
  if (!value) return 'en';
  const normalized = value.trim().toLowerCase();
  return normalized in COMIC_SOURCES ? (normalized as ComicLanguage) : 'en';
}

function parseEpisode(value: unknown): number | null {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value.trim(), 10)
        : Number.NaN;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function parseTitle(value: unknown, fallbackEpisode: number): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `Episode ${fallbackEpisode}`;
}

function parseCommenceTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  return token.length > 0 ? token : null;
}

function formatDateLabel(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const withZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = new Date(withZone);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

async function findEpisodeMetadata(
  lang: ComicLanguage,
  episodeNumber: number
): Promise<ComicEpisodeMeta | null> {
  const source = COMIC_SOURCES[lang];
  for (const url of source.metadataUrls) {
    try {
      const response = await fetch(url, { next: { revalidate: 3600 } });
      if (!response.ok) continue;
      const payload = await response.json();
      if (!Array.isArray(payload)) continue;

      for (const row of payload) {
        if (!row || typeof row !== 'object') continue;
        const candidate = row as Record<string, unknown>;
        const episode = parseEpisode(candidate.episode);
        if (!episode || episode !== episodeNumber) continue;

        return {
          episode,
          title: parseTitle(candidate.title, episode),
          commenceTime: parseCommenceTime(candidate.commenceTime),
        };
      }
    } catch {
      // Try next metadata source.
    }
  }
  return null;
}

export async function generateMetadata({ searchParams }: ComicsPageProps): Promise<Metadata> {
  const query = await searchParams;
  const lang = parseLanguage(getFirstParam(query.lang));
  const source = COMIC_SOURCES[lang];
  const requestedEpisode = parseEpisode(getFirstParam(query.episode) ?? getFirstParam(query.ep));
  const siteBase = getSiteBaseUrl();

  if (!requestedEpisode) {
    const title = `Comics Browser (${source.displayName}) - World Flipper Tools`;
    const imageUrl = `${CDN_ROOT}/comics/${source.folder}/1/small.png`;
    const baseImageUrl = `${CDN_ROOT}/comics/${source.folder}/1/base.png`;
    const canonicalPath = lang === 'en' ? '/comics' : `/comics?lang=${lang}`;
    const canonicalUrl = new URL(canonicalPath, siteBase).toString();

    return {
      title,
      description: DEFAULT_DESCRIPTION,
      alternates: { canonical: canonicalPath },
      openGraph: {
        type: 'website',
        title,
        description: DEFAULT_DESCRIPTION,
        url: canonicalUrl,
        siteName: 'World Flipper Tools',
        images: [{ url: imageUrl, alt: title }, { url: baseImageUrl, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: DEFAULT_DESCRIPTION,
        images: [imageUrl, baseImageUrl],
      },
    };
  }

  const episodeMeta = await findEpisodeMetadata(lang, requestedEpisode);
  const episodeLabel = episodeMeta
    ? `Episode ${requestedEpisode}: ${episodeMeta.title}`
    : `Episode ${requestedEpisode}`;
  const publishedDate = formatDateLabel(episodeMeta?.commenceTime ?? null);
  const description = publishedDate
    ? `${source.displayName} comic ${episodeLabel}. Published ${publishedDate}.`
    : `${source.displayName} comic ${episodeLabel}.`;
  const imageUrl = `${CDN_ROOT}/comics/${source.folder}/${requestedEpisode}/small.png`;
  const baseImageUrl = `${CDN_ROOT}/comics/${source.folder}/${requestedEpisode}/base.png`;
  const canonicalPath = `/comics?lang=${lang}&episode=${requestedEpisode}`;
  const canonicalUrl = new URL(canonicalPath, siteBase).toString();
  const title = `${episodeLabel} - World Flipper Comics`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonicalUrl,
      siteName: 'World Flipper Tools',
      images: [{ url: imageUrl, alt: episodeLabel }, { url: baseImageUrl, alt: episodeLabel }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl, baseImageUrl],
    },
  };
}

export default function ComicsPage() {
  return (
    <Suspense fallback={null}>
      <ComicsClient />
    </Suspense>
  );
}
