import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createTeamSchema } from '@/lib/community/schemas';
import { getAuthContext, isModeratorOrAdmin } from '@/lib/community/auth';

const PAGE_SIZE = 20;

type TeamListRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  source_type: 'save_slot' | 'eliya_link' | 'custom';
  publish_status: string;
  visibility: string;
  target_id: number | null;
  boss_label: string | null;
  raw_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  team_builds?: unknown;
  team_tags?: Array<{ tag?: string }>;
  matched_tags?: Array<{ tag?: string }>;
  content_targets?: unknown;
};

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
    const parsed = createTeamSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload.', issues: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const admin = createSupabaseAdminClient();

    const { data: teamRow, error: teamError } = await admin
      .from('teams')
      .insert({
        owner_id: auth.userId,
        title: data.title,
        description: data.description || null,
        source_type: data.sourceType,
        publish_status: 'draft',
        visibility: 'public',
        target_id: data.targetId ?? null,
        boss_label: data.bossLabel || null,
        raw_snapshot: data.rawSnapshot,
      })
      .select('id, title, source_type, publish_status, created_at')
      .single();

    if (teamError || !teamRow) {
      return NextResponse.json({ ok: false, error: teamError?.message || 'Failed to create team.' }, { status: 400 });
    }

    const typedTeamRow = teamRow as unknown as { id: string; title: string; source_type: string; publish_status: string; created_at: string };
    const teamId = typedTeamRow.id;

    const { error: buildError } = await admin.from('team_builds').insert({
      team_id: teamId,
      main_unit_ids: data.build.mainUnitIds,
      unison_unit_ids: data.build.unisonUnitIds,
      equipment_ids: data.build.equipmentIds,
      soul_ids: data.build.soulIds,
      slot_meta: data.build.slotMeta || {},
    });

    if (buildError) {
      await admin.from('teams').delete().eq('id', teamId);
      return NextResponse.json({ ok: false, error: buildError.message }, { status: 400 });
    }

    const tags = Array.from(
      new Set(
        data.tags
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    if (tags.length > 0) {
      const payload = tags.map((tag) => ({ team_id: teamId, tag }));
      const { error: tagsError } = await admin.from('team_tags').insert(payload);
      if (tagsError) {
        await admin.from('team_builds').delete().eq('team_id', teamId);
        await admin.from('teams').delete().eq('id', teamId);
        return NextResponse.json({ ok: false, error: tagsError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true, team: typedTeamRow, tags });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create team.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await getAuthContext();
    const isMod = auth ? isModeratorOrAdmin(auth.role) : false;

    const requestedStatus = (searchParams.get('status') || '').trim();
    const requestedSourceType = (searchParams.get('sourceType') || '').trim();
    const requestedTag = (searchParams.get('tag') || '').trim().toLowerCase();
    const requestedQuery = (searchParams.get('q') || '').trim();
    const requestedTargetId = Number.parseInt(searchParams.get('targetId') || '', 10);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);

    const admin = createSupabaseAdminClient();
    const tagSelect = requestedTag ? 'team_tags(tag), matched_tags:team_tags!inner(tag)' : 'team_tags(tag)';

    let query = admin
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
          ${tagSelect},
          content_targets(kind, slug, label)
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (!isMod) {
      query = query.eq('publish_status', 'approved').eq('visibility', 'public');
    } else if (requestedStatus) {
      query = query.eq('publish_status', requestedStatus);
    }

    if (requestedSourceType) {
      query = query.eq('source_type', requestedSourceType);
    }

    if (Number.isFinite(requestedTargetId) && requestedTargetId > 0) {
      query = query.eq('target_id', requestedTargetId);
    }

    if (requestedQuery) {
      query = query.or(`title.ilike.%${requestedQuery}%,description.ilike.%${requestedQuery}%,boss_label.ilike.%${requestedQuery}%`);
    }

    if (requestedTag) {
      query = query.eq('matched_tags.tag', requestedTag);
    }

    const { data: rows, error, count } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const teams = ((rows || []) as unknown as TeamListRow[])
      .map((row) => {
        const tags = Array.isArray(row.team_tags)
          ? row.team_tags.map((entry) => (entry && typeof entry.tag === 'string' ? entry.tag : '')).filter(Boolean)
          : [];

        return {
          ...row,
          tags,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      teams,
      page,
      pageSize: PAGE_SIZE,
      total: count ?? teams.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list teams.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
