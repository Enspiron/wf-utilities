import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSaveShareSchema } from '@/lib/community/schemas';
import { getAuthContext } from '@/lib/community/auth';
import { sanitizeSaveJson } from '@/lib/community/save-sanitizer';
import { getAppBaseUrl } from '@/lib/supabase/env';

type SaveShareListRow = {
  id: string;
  slug: string;
  visibility: 'private' | 'unlisted' | 'public';
  expires_at: string | null;
  download_count: number;
  created_at: string;
  updated_at: string;
};

function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get('content-type') || '';
  return contentType.toLowerCase().includes('application/json');
}

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('save_shares')
      .select('id, slug, visibility, expires_at, download_count, created_at, updated_at')
      .eq('owner_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, saveShares: (data || []) as unknown as SaveShareListRow[] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list save shares.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
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
    const parsed = createSaveShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload.', issues: parsed.error.flatten() }, { status: 400 });
    }

    const sanitized = await sanitizeSaveJson(parsed.data.saveJson);
    if (!sanitized.ok) {
      return NextResponse.json({ ok: false, error: sanitized.error }, { status: 400 });
    }

    const slug = nanoid(12);
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json({ ok: false, error: 'Invalid expiresAt value.' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: saveShare, error } = await admin
      .from('save_shares')
      .insert({
        owner_id: auth.userId,
        slug,
        visibility: parsed.data.visibility,
        sanitized_save: sanitized.sanitized,
        sanitized_hash: sanitized.hash,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      })
      .select('id, slug, visibility, expires_at, download_count, created_at, updated_at')
      .single();

    if (error || !saveShare) {
      return NextResponse.json({ ok: false, error: error?.message || 'Failed to create save share.' }, { status: 400 });
    }

    const typedSaveShare = saveShare as unknown as SaveShareListRow;

    await admin.from('save_share_events').insert({
      save_share_id: typedSaveShare.id,
      actor_id: auth.userId,
      action: 'create',
    });

    const shareUrl = `${getAppBaseUrl().replace(/\/$/, '')}/save-editor?importShare=${encodeURIComponent(typedSaveShare.slug)}`;

    return NextResponse.json({
      ok: true,
      slug: typedSaveShare.slug,
      visibility: typedSaveShare.visibility,
      warnings: sanitized.warnings,
      hash: sanitized.hash,
      shareUrl,
      saveShare: typedSaveShare,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create save share.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
