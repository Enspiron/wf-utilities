import { NextResponse } from 'next/server';

const IS_PRODUCTION = process.env.VERCEL === '1';
const ORDEREDMAP_CDN_BASE = 'https://wfjukebox.b-cdn.net/orderedmaps';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

function normalizeFilesByCategory(input: unknown): Record<string, string[]> {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const output: Record<string, string[]> = {};
  const entries = Object.entries(input as Record<string, unknown>);

  for (const [category, value] of entries) {
    if (Array.isArray(value)) {
      output[category] = value
        .filter((file): file is string => typeof file === 'string')
        .map((file) => file.replace(/\.json$/i, ''));
      continue;
    }

    if (typeof value === 'string') {
      output[category] = [value.replace(/\.json$/i, '')];
      continue;
    }

    output[category] = [];
  }

  return output;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'jp';
    
    // In production, prefer Bunny CDN orderedmaps manifest, then fallback to GitHub.
    if (IS_PRODUCTION) {
      const candidateManifestUrls = [
        `${ORDEREDMAP_CDN_BASE}/manifest_${lang}.json`,
        `${GITHUB_RAW_URL}/manifest_${lang}.json`,
      ];

      for (const manifestUrl of candidateManifestUrls) {
        const response = await fetch(manifestUrl, { next: { revalidate: 3600 } });
        if (!response.ok) continue;

        const data = await response.json();
        const filesByCategory = normalizeFilesByCategory(
          data?.filesByCategory && typeof data.filesByCategory === 'object' ? data.filesByCategory : {}
        );
        const categories = Array.isArray(data?.categories)
          ? data.categories.filter((category: unknown): category is string => typeof category === 'string')
          : Object.keys(filesByCategory);

        return NextResponse.json({ categories, filesByCategory, lang, sourceUrl: manifestUrl });
      }

      return NextResponse.json({ error: 'Manifest not found on CDN/GitHub' }, { status: 404 });
    }
    
    // Development: use local filesystem
    const fs = await import('fs');
    const path = await import('path');
    
    const dataFolder = lang === 'en' ? 'datalist_en' : 'datalist';
    const orderedmapDir = path.join(process.cwd(), 'public', 'data', dataFolder);
    
    if (!fs.existsSync(orderedmapDir)) {
      return NextResponse.json({ error: 'Data folder not found' }, { status: 404 });
    }
    
    const categories = fs.readdirSync(orderedmapDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    const filesByCategory: Record<string, string[]> = {};

    categories.forEach(category => {
      const categoryPath = path.join(orderedmapDir, category);
      const files = fs.readdirSync(categoryPath)
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
      
      filesByCategory[category] = files;
    });

    return NextResponse.json({ categories, filesByCategory, lang });
  } catch (error) {
    console.error('Error listing orderedmap files:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
