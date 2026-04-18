import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthContext } from '@/lib/community/auth';

type TeamSubmitRow = {
  id: string;
  owner_id: string;
  publish_status: string;
};

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    const { id } = await context.params;
    const admin = createSupabaseAdminClient();

    const { data: team, error: teamError } = await admin
      .from('teams')
      .select('id, owner_id, publish_status')
      .eq('id', id)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ ok: false, error: 'Team not found.' }, { status: 404 });
    }

    const typedTeam = team as unknown as TeamSubmitRow;

    if (typedTeam.owner_id !== auth.userId) {
      return NextResponse.json({ ok: false, error: 'Only the owner can submit this team.' }, { status: 403 });
    }

    if (!['draft', 'pending', 'rejected'].includes(typedTeam.publish_status)) {
      return NextResponse.json({ ok: false, error: 'This team cannot be submitted in its current status.' }, { status: 400 });
    }

    const { data: updatedTeam, error: updateError } = await admin
      .from('teams')
      .update({ publish_status: 'pending' })
      .eq('id', id)
      .select('id, publish_status, updated_at')
      .single();

    if (updateError || !updatedTeam) {
      return NextResponse.json({ ok: false, error: updateError?.message || 'Failed to update team status.' }, { status: 400 });
    }

    await admin.from('moderation_events').insert({
      team_id: id,
      reviewer_id: auth.userId,
      action: 'submit',
      note: 'Submitted for moderation',
    });

    return NextResponse.json({ ok: true, team: updatedTeam });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit team.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
