import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isModeratorOrAdmin } from '@/lib/community/auth';
import { moderationNoteSchema } from '@/lib/community/schemas';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    if (!isModeratorOrAdmin(auth.role)) {
      return NextResponse.json({ ok: false, error: 'Moderator role required.' }, { status: 403 });
    }

    const body = (await request.json()) as unknown;
    const parsed = moderationNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload.', issues: parsed.error.flatten() }, { status: 400 });
    }

    const { id } = await context.params;
    const admin = createSupabaseAdminClient();

    const { data: updatedTeam, error: updateError } = await admin
      .from('teams')
      .update({ publish_status: 'approved' })
      .eq('id', id)
      .select('id, publish_status, updated_at')
      .single();

    if (updateError || !updatedTeam) {
      return NextResponse.json({ ok: false, error: updateError?.message || 'Failed to approve team.' }, { status: 400 });
    }

    await admin.from('moderation_events').insert({
      team_id: id,
      reviewer_id: auth.userId,
      action: 'approve',
      note: parsed.data.note || null,
    });

    return NextResponse.json({ ok: true, team: updatedTeam });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to approve team.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
