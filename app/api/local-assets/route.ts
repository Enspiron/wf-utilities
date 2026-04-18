import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Dev-only: this route serves files from a hardcoded local datamining
// directory that only exists on the maintainer's workstation. It must never
// be reachable in production — the path is Windows-specific and would 500
// noisily on Vercel — so we hard-fail unless explicitly opted in via env.
const LOCAL_ASSETS_ENABLED =
  process.env.NODE_ENV !== 'production' || process.env.LOCAL_ASSETS_ENABLED === '1';
const LOCAL_ASSETS_DIR = process.env.LOCAL_ASSETS_DIR ?? 'E:\\WFDatamine\\output\\assets';

export async function GET(request: NextRequest) {
  if (!LOCAL_ASSETS_ENABLED) {
    return NextResponse.json({ error: 'Local asset serving is disabled' }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const assetPath = searchParams.get('path');

    if (!assetPath) {
      return NextResponse.json(
        { error: 'Path parameter is required' },
        { status: 400 }
      );
    }

    // Construct the full local path
    const localDir = LOCAL_ASSETS_DIR;
    const fullPath = path.join(localDir, assetPath);

    // Security check - ensure the path is within the allowed directory
    if (!fullPath.startsWith(localDir)) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 403 }
      );
    }

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read the file
    const fileBuffer = fs.readFileSync(fullPath);
    
    // Determine content type based on extension
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.mp3': 'audio/mpeg',
    };
    
    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving local asset:', error);
    return NextResponse.json(
      { error: 'Failed to serve asset' },
      { status: 500 }
    );
  }
}
