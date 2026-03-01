import { NextRequest, NextResponse } from 'next/server';

const IS_PRODUCTION = process.env.VERCEL === '1';
const ORDEREDMAP_CDN_BASE = 'https://wfjukebox.b-cdn.net/orderedmaps';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const rawFile = searchParams.get('file');
    const lang = searchParams.get('lang') || 'jp';

    if (!category || !rawFile) {
      return NextResponse.json(
        { error: 'Category and file parameters are required' },
        { status: 400 }
      );
    }
    const file = rawFile.replace(/\.json$/i, '');

    const dataFolder = lang === 'en' ? 'datalist_en' : 'datalist';
    
    // In production, prefer Bunny CDN orderedmaps, then fallback to GitHub.
    if (IS_PRODUCTION) {
      const cdnUrl = `${ORDEREDMAP_CDN_BASE}/${dataFolder}/${category}/${file}.json`;
      const githubUrl = `${GITHUB_RAW_URL}/${dataFolder}/${category}/${file}.json`;
      const candidateUrls = [cdnUrl, githubUrl];

      for (const fileUrl of candidateUrls) {
        const response = await fetch(fileUrl, { next: { revalidate: 3600 } });
        if (!response.ok) continue;

        const jsonData = await response.json();
        return NextResponse.json({
          category,
          file,
          data: jsonData,
          lang,
          sourceUrl: fileUrl,
        });
      }

      return NextResponse.json({ error: 'File not found on CDN/GitHub' }, { status: 404 });
    }
    
    // Development: use local filesystem
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
  } catch (error) {
    console.error('Error reading orderedmap file:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
