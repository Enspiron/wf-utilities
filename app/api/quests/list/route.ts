import { NextResponse } from 'next/server';

const IS_PRODUCTION = process.env.VERCEL === '1';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'en';

    if (IS_PRODUCTION) {
      // In production, attempt to fetch a manifest from GitHub
      const manifestUrl = `${GITHUB_RAW_URL}/manifest_${lang}.json`;
      const resp = await fetch(manifestUrl);
      if (!resp.ok) return NextResponse.json({ error: 'Manifest not found' }, { status: 404 });
      await resp.json();
      // manifest contains listing information — try to extract quest files
      // Fallback: return empty
      return NextResponse.json({ files: [] });
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
          // store without .json
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

