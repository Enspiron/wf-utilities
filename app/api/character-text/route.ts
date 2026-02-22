import { NextRequest, NextResponse } from 'next/server';

const USE_CDN = process.env.VERCEL === '1';
const CDN_BASE_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lang = searchParams.get('lang') || 'jp';
    const dataFolder = lang === 'en' ? 'datalist_en' : 'datalist';

    if (USE_CDN) {
      // Fetch from CDN in production
      const cdnUrl = `${CDN_BASE_URL}/${dataFolder}/character/character_text.json`;
      const response = await fetch(cdnUrl, { next: { revalidate: 3600 } });
      
      if (!response.ok) {
        return NextResponse.json({ error: 'Character text file not found' }, { status: 404 });
      }
      
      const jsonData = await response.json();
      
      return NextResponse.json({
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
        'character',
        'character_text.json'
      );

      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Character text file not found' }, { status: 404 });
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const jsonData = JSON.parse(fileContent);

      return NextResponse.json({
        data: jsonData,
        lang,
      });
    }
  } catch (error) {
    console.error('Error reading character text file:', error);
    return NextResponse.json({ error: 'Failed to read character text' }, { status: 500 });
  }
}
