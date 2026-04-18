import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('content_targets')
      .select('id, kind, slug, label, is_active')
      .eq('is_active', true)
      .order('kind', { ascending: true })
      .order('label', { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, targets: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load content targets.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
