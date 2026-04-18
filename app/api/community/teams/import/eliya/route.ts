import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/community/auth';
import { importEliyaSchema } from '@/lib/community/schemas';
import { importTeamFromEliyaLink } from '@/lib/community/team-import';

function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get('content-type') || '';
  return contentType.toLowerCase().includes('application/json');
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    if (!isJsonRequest(request)) {
      return NextResponse.json({ ok: false, error: 'Content-Type must be application/json.' }, { status: 415 });
    }

    const body = (await request.json()) as unknown;
    const parsed = importEliyaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload.', issues: parsed.error.flatten() }, { status: 400 });
    }

    const payload = await importTeamFromEliyaLink(parsed.data.link);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import Eliya link.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
