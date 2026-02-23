import { NextResponse } from 'next/server';

const IS_PRODUCTION = process.env.VERCEL === '1';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'jp';
    
    // In production, fetch from GitHub
    if (IS_PRODUCTION) {
      const manifestUrl = `${GITHUB_RAW_URL}/manifest_${lang}.json`;
      const response = await fetch(manifestUrl, { next: { revalidate: 3600 } });
      
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({ ...data, lang });
      } else {
        return NextResponse.json({ error: 'Manifest not found on GitHub' }, { status: 404 });
      }
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
