import { NextRequest, NextResponse } from 'next/server';

const IS_PRODUCTION = process.env.VERCEL === '1';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/Enspiron/wf-utilities/main/public/data';

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
    
    // In production, fetch from GitHub
    if (IS_PRODUCTION) {
      const fileUrl = `${GITHUB_RAW_URL}/${dataFolder}/${category}/${file}.json`;
      const response = await fetch(fileUrl);
      
      if (response.ok) {
        const jsonData = await response.json();
        return NextResponse.json({
          category,
          file,
          data: jsonData,
          lang,
        });
      } else {
        return NextResponse.json({ error: 'File not found on GitHub' }, { status: 404 });
      }
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
