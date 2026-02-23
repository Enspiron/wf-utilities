import { NextResponse } from 'next/server';

// Use manifest files for better performance
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'jp';
    
    // Try to use manifestfile first (works locally and on Vercel)
    try {
      const manifestResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/data/manifest_${lang}.json`
      );
      
      if (manifestResponse.ok) {
        const data = await manifestResponse.json();
        return NextResponse.json({ ...data, lang });
      }
    } catch (e) {
      console.log('Manifest fetch failed, trying filesystem');
    }
    
    // Fallback to filesystem (development only)
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
