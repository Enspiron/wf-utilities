import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isModeratorOrAdmin } from '@/lib/community/auth';
import { rejectNoteSchema } from '@/lib/community/schemas';

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
    const parsed = rejectNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload.', issues: parsed.error.flatten() }, { status: 400 });
    }

    const { id } = await context.params;
    const admin = createSupabaseAdminClient();

    const { data: updatedTeam, error: updateError } = await admin
      .from('teams')
      .update({ publish_status: 'rejected' })
      .eq('id', id)
      .select('id, publish_status, updated_at')
      .single();

    if (updateError || !updatedTeam) {
      return NextResponse.json({ ok: false, error: updateError?.message || 'Failed to reject team.' }, { status: 400 });
    }

    await admin.from('moderation_events').insert({
      team_id: id,
      reviewer_id: auth.userId,
      action: 'reject',
      note: parsed.data.note,
    });

    return NextResponse.json({ ok: true, team: updatedTeam });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reject team.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
