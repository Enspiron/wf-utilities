import { NextResponse } from 'next/server';

const IS_PRODUCTION = process.env.VERCEL === '1';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }
  if (typeof value === 'string' && value.length > 0) return [value];
  return [];
};

const extractQuestFilesFromManifest = (manifest: unknown): string[] => {
  if (!manifest || typeof manifest !== 'object') return [];
  const filesByCategory = (manifest as Record<string, unknown>).filesByCategory;
  if (!filesByCategory || typeof filesByCategory !== 'object') return [];
  const questEntry = (filesByCategory as Record<string, unknown>).quest;
  return toStringArray(questEntry);
};

const fetchQuestFilesFromGithubManifest = async (lang: string): Promise<string[]> => {
  const manifestUrls = [
    `${GITHUB_RAW_URL}/manifest_${lang}.json`,
    `${GITHUB_RAW_URL}/manifest.json`,
  ];

  for (const manifestUrl of manifestUrls) {
    try {
      const resp = await fetch(manifestUrl, { next: { revalidate: 3600 } });
      if (!resp.ok) continue;
      const manifest = await resp.json();
      const files = extractQuestFilesFromManifest(manifest);
      if (files.length > 0) return files;
    } catch {
      // Try next source.
    }
  }

  return [];
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'en';

    if (IS_PRODUCTION) {
      const files = await fetchQuestFilesFromGithubManifest(lang);
      if (files.length === 0) {
        return NextResponse.json(
          { error: 'Quest manifest not found or did not contain quest files' },
          { status: 404 }
        );
      }
      return NextResponse.json({ files });
    }

    const fs = await import('fs');
    const path = await import('path');

    const dataFolder = lang === 'en' ? 'datalist_en' : 'datalist';
    const baseDir = path.join(process.cwd(), 'public', 'data', dataFolder, 'quest');

    if (!fs.existsSync(baseDir)) {
      return NextResponse.json({ error: 'Quest data folder not found' }, { status: 404 });
    }

    const files: string[] = [];

    const walk = (dir: string, relative = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const resPath = path.join(dir, entry.name);
        const relPath = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(resPath, relPath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          files.push(relPath.replace(/\.json$/, ''));
        }
      }
    };

    walk(baseDir);

    return NextResponse.json({ files });
  } catch (err) {
    console.error('Error listing quest files:', err);
    return NextResponse.json({ error: 'Failed to list quest files' }, { status: 500 });
  }
}
