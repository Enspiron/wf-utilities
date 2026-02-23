import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    
    // Use local files from public folder (works in both dev and production)
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
