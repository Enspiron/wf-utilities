import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthContext } from '@/lib/community/auth';

type SaveShareCloneRow = {
  id: string;
  owner_id: string;
  slug: string;
  visibility: 'private' | 'unlisted' | 'public';
  sanitized_save: unknown;
  expires_at: string | null;
};

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= Date.now();
}

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const auth = await getAuthContext();
    const admin = createSupabaseAdminClient();

    const { data: row, error } = await admin
      .from('save_shares')
      .select('id, owner_id, slug, visibility, sanitized_save, expires_at')
      .eq('slug', slug)
      .single();

    if (error || !row) {
      return NextResponse.json({ ok: false, error: 'Save share not found.' }, { status: 404 });
    }

    const typedRow = row as unknown as SaveShareCloneRow;

    if (isExpired(typedRow.expires_at)) {
      return NextResponse.json({ ok: false, error: 'This save share has expired.' }, { status: 410 });
    }

    const isOwner = Boolean(auth && typedRow.owner_id === auth.userId);
    if (typedRow.visibility === 'private' && !isOwner) {
      return NextResponse.json({ ok: false, error: 'Private save share.' }, { status: 403 });
    }

    await admin.from('save_share_events').insert({
      save_share_id: typedRow.id,
      actor_id: auth?.userId ?? null,
      action: 'clone',
    });

    return NextResponse.json({
      ok: true,
      slug: typedRow.slug,
      save: typedRow.sanitized_save,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clone save share.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
