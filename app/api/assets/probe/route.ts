import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOST = 'wfjukebox.b-cdn.net';

function isAudioLike(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return normalized.includes('audio') || normalized.includes('octet-stream') || normalized === '';
}

export async function GET(request: NextRequest) {
  const encodedUrl = request.nextUrl.searchParams.get('url');
  if (!encodedUrl) {
    return NextResponse.json({ ok: false, error: 'missing_url' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(encodedUrl);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_url' }, { status: 400 });
  }

  if (target.protocol !== 'https:' || target.hostname !== ALLOWED_HOST) {
    return NextResponse.json({ ok: false, error: 'url_not_allowed' }, { status: 400 });
  }

  try {
    let response = await fetch(target.toString(), { method: 'HEAD', cache: 'no-store' });
    if (!response.ok) {
      response = await fetch(target.toString(), {
        headers: { Range: 'bytes=0-1' },
        cache: 'no-store',
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const ok = response.ok && isAudioLike(contentType);

    return NextResponse.json({
      ok,
      status: response.status,
      contentType,
    });
  } catch {
    return NextResponse.json({
      ok: false,
      status: 0,
      error: 'probe_failed',
    });
  }
}
