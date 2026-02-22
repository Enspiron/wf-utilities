import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lang = searchParams.get('lang') || 'jp';

    const dataFolder = lang === 'en' ? 'datalist_en' : 'datalist';
    const filePath = path.join(
      process.cwd(),
      'app',
      'api',
      'orderedmap',
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
  } catch (error) {
    console.error('Error reading character text file:', error);
    return NextResponse.json({ error: 'Failed to read character text' }, { status: 500 });
  }
}
