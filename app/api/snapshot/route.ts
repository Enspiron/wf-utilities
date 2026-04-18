import { NextResponse } from 'next/server';
import { getCatalogEntriesForApi } from '@/lib/item-catalog';
import { fetchDatalistJson, IS_PRODUCTION, DATA_CDN_BASE, DATA_CACHE_HEADERS } from '@/lib/data-source';

// Cache this aggregate for an hour on the CDN. The underlying datasets only
// change when the game data is re-exported, so this is plenty fresh.
export const revalidate = 3600;

type SnapshotResponse = {
  generatedAt: string;
  orderedmapCategories: number;
  orderedmapFiles: number;
  questFiles: number;
  itemEntries: number;
  musicTracks: number;
};

const ORDEREDMAP_CDN_MANIFESTS = [
  'https://wfjukebox.b-cdn.net/orderedmaps/manifest_en.json',
  `${DATA_CDN_BASE}/manifest_en.json`,
];

async function countOrderedMap(): Promise<{ categories: number; files: number }> {
  if (IS_PRODUCTION) {
    for (const url of ORDEREDMAP_CDN_MANIFESTS) {
      try {
        const response = await fetch(url, { next: { revalidate: 3600 } });
        if (!response.ok) continue;
        const data = (await response.json()) as {
          categories?: unknown[];
          filesByCategory?: Record<string, unknown>;
        };
        const filesByCategory = data.filesByCategory ?? {};
        const files = Object.values(filesByCategory).reduce<number>((total, value) => {
          return total + (Array.isArray(value) ? value.length : 0);
        }, 0);
        return {
          categories: Array.isArray(data.categories)
            ? data.categories.length
            : Object.keys(filesByCategory).length,
          files,
        };
      } catch {
        // try next
      }
    }
    return { categories: 0, files: 0 };
  }

  // Dev: scan the public/data tree directly.
  const fs = await import('fs/promises');
  const path = await import('path');
  const root = path.join(process.cwd(), 'public', 'data', 'datalist_en');
  try {
    const categories = await fs.readdir(root, { withFileTypes: true });
    const dirs = categories.filter((entry) => entry.isDirectory());
    let files = 0;
    for (const dir of dirs) {
      const entries = await fs.readdir(path.join(root, dir.name));
      files += entries.filter((name) => name.endsWith('.json')).length;
    }
    return { categories: dirs.length, files };
  } catch {
    return { categories: 0, files: 0 };
  }
}

async function countQuests(): Promise<number> {
  if (IS_PRODUCTION) {
    try {
      const manifest = (await fetchDatalistJson<{
        filesByCategory?: Record<string, unknown>;
      }>('manifest_en.json')) ?? {};
      const quests = manifest.filesByCategory?.quest;
      if (Array.isArray(quests)) return quests.length;
    } catch {
      return 0;
    }
    return 0;
  }

  const fs = await import('fs/promises');
  const path = await import('path');
  const baseDir = path.join(process.cwd(), 'public', 'data', 'datalist_en', 'quest');
  try {
    const walk = async (dir: string): Promise<number> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      let total = 0;
      for (const entry of entries) {
        if (entry.isDirectory()) total += await walk(path.join(dir, entry.name));
        else if (entry.isFile() && entry.name.endsWith('.json')) total += 1;
      }
      return total;
    };
    return await walk(baseDir);
  } catch {
    return 0;
  }
}

async function countMusic(): Promise<number> {
  try {
    const bgm = await fetchDatalistJson<Record<string, unknown>>(
      'datalist/asset/bgm_asset.json'
    );
    return Object.keys(bgm).length;
  } catch {
    return 0;
  }
}

async function countItems(): Promise<number> {
  try {
    const items = await getCatalogEntriesForApi();
    return items.length;
  } catch {
    return 0;
  }
}

export async function GET(): Promise<NextResponse<SnapshotResponse>> {
  const [orderedMap, questFiles, itemEntries, musicTracks] = await Promise.all([
    countOrderedMap(),
    countQuests(),
    countItems(),
    countMusic(),
  ]);

  const payload: SnapshotResponse = {
    generatedAt: new Date().toISOString(),
    orderedmapCategories: orderedMap.categories,
    orderedmapFiles: orderedMap.files,
    questFiles,
    itemEntries,
    musicTracks,
  };

  return NextResponse.json(payload, { headers: DATA_CACHE_HEADERS });
}
