import { NextResponse } from 'next/server';

// For production on Vercel, use a pre-generated manifest
// For development, read filesystem
const USE_MANIFEST = process.env.VERCEL === '1';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'jp';
    
    if (USE_MANIFEST) {
      // In production, return a pre-cached structure
      // You'll need to generate this manifest file before deployment
      const manifestUrl = `https://wfjukebox.b-cdn.net/data/manifest_${lang}.json`;
      const response = await fetch(manifestUrl, { next: { revalidate: 3600 } });
      
      if (!response.ok) {
        return NextResponse.json({ error: 'Manifest not found' }, { status: 404 });
      }
      
      const data = await response.json();
     return NextResponse.json({ ...data, lang });
    } else {
      // Development: read from filesystem
      const fs = await import('fs');
      const path = await import('path');
      
      const dataFolder = lang === 'en' ? 'datalist_en' : 'datalist';
      const orderedmapDir = path.join(process.cwd(), 'public', 'data', dataFolder);
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
    }
  } catch (error) {
    console.error('Error listing orderedmap files:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
