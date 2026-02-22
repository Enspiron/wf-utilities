import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'jp';
    const dataFolder = lang === 'en' ? 'datalist_en' : 'datalist';
    
    const orderedmapDir = path.join(process.cwd(), 'app', 'api', 'orderedmap', dataFolder);
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
