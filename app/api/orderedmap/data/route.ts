import { NextRequest, NextResponse } from 'next/server';

// Use CDN for production, local files for development
const USE_CDN = process.env.VERCEL === '1';
const CDN_BASE_URL = 'https://wfjukebox.b-cdn.net/data';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const file = searchParams.get('file');
    const lang = searchParams.get('lang') || 'jp';

    if (!category || !file) {
      return NextResponse.json(
        { error: 'Category and file parameters are required' },
        { status: 400 }
      );
    }

    const dataFolder = lang === 'en' ? 'datalist_en' : 'datalist';

    if (USE_CDN) {
      // Fetch from CDN in production
      const cdnUrl = `${CDN_BASE_URL}/${dataFolder}/${category}/${file}.json`;
      const response = await fetch(cdnUrl);
      
      if (!response.ok) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      
      const jsonData = await response.json();
      
      return NextResponse.json({
        category,
        file,
        data: jsonData,
        lang,
      });
    } else {
      // Use local files in development
      const fs = await import('fs');
      const path = await import('path');
      
      const filePath = path.join(
        process.cwd(),
        'public',
        'data',
        dataFolder,
        category,
        `${file}.json`
      );

      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const jsonData = JSON.parse(fileContent);

      return NextResponse.json({
        category,
        file,
        data: jsonData,
        lang,
      });
    }
  } catch (error) {
    console.error('Error reading orderedmap file:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
