import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { normalizeAssetPath } from '@/lib/asset-url';

// Dev/local route for datamined assets. Production must explicitly opt in so
// deployed hosts do not expose filesystem paths by accident.
const LOCAL_ASSETS_ENABLED =
  process.env.NODE_ENV !== 'production' || process.env.LOCAL_ASSETS_ENABLED === '1';

function getLocalAssetsDir(): string {
  return path.resolve(
    process.env.LOCAL_ASSETS_DIR ??
      process.env.WF_ASSET_ROOT ??
      path.join(process.cwd(), '..', 'WFDatamine', 'output', 'assets')
  );
}

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

    const localDir = getLocalAssetsDir();
    const relativePath = normalizeAssetPath(assetPath);
    const fullPath = path.resolve(localDir, ...relativePath.split('/'));

    if (fullPath !== localDir && !fullPath.startsWith(`${localDir}${path.sep}`)) {
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
