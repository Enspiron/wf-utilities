import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAuthContext, isModeratorOrAdmin } from '@/lib/community/auth';

type TeamRow = {
  id: string;
  owner_id: string;
  publish_status: string;
  visibility: string;
  team_tags?: Array<{ tag?: string }>;
  [key: string]: unknown;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const auth = await getAuthContext();
    const isMod = auth ? isModeratorOrAdmin(auth.role) : false;

    const admin = createSupabaseAdminClient();

    const { data: team, error } = await admin
      .from('teams')
      .select(
        `
          id,
          owner_id,
          title,
          description,
          source_type,
          publish_status,
          visibility,
          target_id,
          boss_label,
          raw_snapshot,
          created_at,
          updated_at,
          team_builds(main_unit_ids, unison_unit_ids, equipment_ids, soul_ids, slot_meta),
          team_tags(tag),
          content_targets(kind, slug, label)
        `
      )
      .eq('id', id)
      .single();

    if (error || !team) {
      return NextResponse.json({ ok: false, error: 'Team not found.' }, { status: 404 });
    }

    const typedTeam = team as unknown as TeamRow;
    const isOwner = Boolean(auth && typedTeam.owner_id === auth.userId);
    const isPublicApproved = typedTeam.publish_status === 'approved' && typedTeam.visibility === 'public';

    if (!isOwner && !isMod && !isPublicApproved) {
      return NextResponse.json({ ok: false, error: 'You do not have access to this team.' }, { status: 403 });
    }

    const response: Record<string, unknown> = {
      ...typedTeam,
      tags: Array.isArray(typedTeam.team_tags)
        ? typedTeam.team_tags.map((entry) => (entry && typeof entry.tag === 'string' ? entry.tag : '')).filter(Boolean)
        : [],
    };

    if (isOwner || isMod) {
      const { data: moderationEvents } = await admin
        .from('moderation_events')
        .select('id, reviewer_id, action, note, created_at')
        .eq('team_id', typedTeam.id)
        .order('created_at', { ascending: false });
      response.moderationEvents = moderationEvents || [];
    }

    return NextResponse.json({ ok: true, team: response });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch team.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
