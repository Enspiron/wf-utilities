import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createReportSchema } from '@/lib/community/schemas';
import { getAuthContext } from '@/lib/community/auth';

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
    }

    const body = (await request.json()) as unknown;
    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload.', issues: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('reports')
      .insert({
        reporter_id: auth.userId,
        entity_type: parsed.data.entityType,
        entity_id: parsed.data.entityId,
        reason: parsed.data.reason,
        status: 'open',
      })
      .select('id, entity_type, entity_id, status, created_at')
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message || 'Failed to create report.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true, report: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create report.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
