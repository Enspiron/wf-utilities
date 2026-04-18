/**
 * Centralised helpers for resolving World Flipper data files.
 *
 * Historically every route copied the same two-liner:
 *   const USE_CDN = process.env.VERCEL === '1';
 *   const CDN_BASE_URL = 'https://raw.githubusercontent.com/...';
 *
 * …and then duplicated the `if (USE_CDN) fetch(...) else fs.readFile(...)`
 * branch. Put it here once.
 *
 * Server-only: this module imports `fs/promises` lazily, so it must never be
 * bundled into a client component.
 */

export const IS_PRODUCTION = process.env.VERCEL === '1';

/** GitHub raw mirror for the `public/data/...` tree. */
export const DATA_CDN_BASE = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

/** Bunny CDN that hosts the generated orderedmap JSON set. */
export const ORDEREDMAP_CDN_BASE = 'https://wfjukebox.b-cdn.net/orderedmaps';

/** Public asset root on Bunny. */
export const ASSET_CDN_BASE = 'https://wfjukebox.b-cdn.net';

function joinPath(relativePath: string): string {
  return relativePath.replace(/^\/+/, '');
}

/**
 * Resolve a `public/data/<…>` URL. In production this points at the CDN; in
 * development the caller should read the local file system instead.
 */
export function resolveDataUrl(relativePath: string): string {
  return `${DATA_CDN_BASE}/${joinPath(relativePath)}`;
}

/**
 * Fetch a JSON file from the shared `public/data` mirror.
 *
 * - In production: GET from the GitHub raw CDN with Next's `revalidate` cache.
 * - In development: read it off disk so editors don't need network access.
 */
export async function fetchDatalistJson<T = unknown>(
  relativePath: string,
  options?: { revalidate?: number }
): Promise<T> {
  if (IS_PRODUCTION) {
    const url = resolveDataUrl(relativePath);
    const response = await fetch(url, {
      next: { revalidate: options?.revalidate ?? 3600 },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${relativePath}: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  const fs = await import('fs/promises');
  const path = await import('path');
  const segments = joinPath(relativePath).split('/');
  const fullPath = path.join(process.cwd(), 'public', 'data', ...segments);
  const file = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(file) as T;
}

/**
 * Fetch an orderedmap JSON file, preferring the Bunny CDN and falling back to
 * the GitHub raw mirror. The caller supplies e.g. `datalist_en/quest/foo.json`.
 */
export async function fetchOrderedMapJson<T = unknown>(
  relativePath: string,
  options?: { revalidate?: number }
): Promise<T | null> {
  const rel = joinPath(relativePath);
  const revalidate = options?.revalidate ?? 3600;

  if (IS_PRODUCTION) {
    const primary = `${ORDEREDMAP_CDN_BASE}/${rel}`;
    const fallback = `${DATA_CDN_BASE}/${rel}`;
    const primaryRes = await fetch(primary, { next: { revalidate } });
    if (primaryRes.ok) {
      return (await primaryRes.json()) as T;
    }
    const fallbackRes = await fetch(fallback, { next: { revalidate } });
    if (fallbackRes.ok) {
      return (await fallbackRes.json()) as T;
    }
    return null;
  }

  try {
    return await fetchDatalistJson<T>(rel);
  } catch {
    return null;
  }
}

/**
 * A consistent `Cache-Control` header for data-ish API routes.
 * `s-maxage` dictates shared (CDN) cache TTL and `stale-while-revalidate`
 * lets Vercel serve slightly-stale bytes while refreshing in the background.
 */
export const DATA_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
} as const;
