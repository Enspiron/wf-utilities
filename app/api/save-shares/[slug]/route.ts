import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthContext } from '@/lib/community/auth';

const updateSaveShareSchema = z.object({
  visibility: z.enum(['private', 'unlisted', 'public']).optional(),
  expiresAt: z.union([z.string().datetime(), z.null()]).optional(),
});

type SaveShareRow = {
  id: string;
  owner_id: string;
  slug: string;
  visibility: 'private' | 'unlisted' | 'public';
  sanitized_save?: unknown;
  sanitized_hash?: string;
  expires_at: string | null;
  download_count: number;
  created_at: string;
  updated_at: string;
};

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= Date.now();
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const auth = await getAuthContext();
    const admin = createSupabaseAdminClient();

    const { data: row, error } = await admin
      .from('save_shares')
      .select('id, owner_id, slug, visibility, sanitized_save, sanitized_hash, expires_at, download_count, created_at, updated_at')
      .eq('slug', slug)
      .single();

    if (error || !row) {
      return NextResponse.json({ ok: false, error: 'Save share not found.' }, { status: 404 });
    }

    const typedRow = row as unknown as SaveShareRow;

    if (isExpired(typedRow.expires_at)) {
      return NextResponse.json({ ok: false, error: 'This save share has expired.' }, { status: 410 });
    }

    const isOwner = Boolean(auth && typedRow.owner_id === auth.userId);
    if (typedRow.visibility === 'private' && !isOwner) {
      return NextResponse.json({ ok: false, error: 'Private save share.' }, { status: 403 });
    }

    await admin
      .from('save_shares')
      .update({ download_count: (typedRow.download_count || 0) + 1 })
      .eq('id', typedRow.id);

    await admin.from('save_share_events').insert({
      save_share_id: typedRow.id,
      actor_id: auth?.userId ?? null,
      action: 'download',
    });

    return NextResponse.json({
      ok: true,
      saveShare: {
        id: typedRow.id,
        slug: typedRow.slug,
        visibility: typedRow.visibility,
        sanitizedHash: typedRow.sanitized_hash,
        expiresAt: typedRow.expires_at,
        downloadCount: (typedRow.download_count || 0) + 1,
        createdAt: typedRow.created_at,
        updatedAt: typedRow.updated_at,
      },
      save: typedRow.sanitized_save,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load save share.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    const { slug } = await context.params;
    const body = (await request.json()) as unknown;
    const parsed = updateSaveShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid payload.', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: row, error: rowError } = await admin
      .from('save_shares')
      .select('id, owner_id, slug, visibility, expires_at, download_count, created_at, updated_at')
      .eq('slug', slug)
      .single();

    if (rowError || !row) {
      return NextResponse.json({ ok: false, error: 'Save share not found.' }, { status: 404 });
    }

    const typedRow = row as unknown as SaveShareRow;
    if (typedRow.owner_id !== auth.userId) {
      return NextResponse.json({ ok: false, error: 'Only the owner can update this save share.' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.visibility) {
      updates.visibility = parsed.data.visibility;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, 'expiresAt')) {
      updates.expires_at = parsed.data.expiresAt ? parsed.data.expiresAt : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: 'No changes provided.' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await admin
      .from('save_shares')
      .update(updates)
      .eq('id', typedRow.id)
      .select('id, slug, visibility, expires_at, download_count, created_at, updated_at')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ ok: false, error: updateError?.message || 'Failed to update save share.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, saveShare: updated as unknown as SaveShareRow });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update save share.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    const { slug } = await context.params;
    const admin = createSupabaseAdminClient();
    const { data: row, error: rowError } = await admin
      .from('save_shares')
      .select('id, owner_id')
      .eq('slug', slug)
      .single();

    if (rowError || !row) {
      return NextResponse.json({ ok: false, error: 'Save share not found.' }, { status: 404 });
    }

    const typedRow = row as unknown as Pick<SaveShareRow, 'id' | 'owner_id'>;
    if (typedRow.owner_id !== auth.userId) {
      return NextResponse.json({ ok: false, error: 'Only the owner can delete this save share.' }, { status: 403 });
    }

    const { error: deleteError } = await admin.from('save_shares').delete().eq('id', typedRow.id);
    if (deleteError) {
      return NextResponse.json({ ok: false, error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete save share.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
