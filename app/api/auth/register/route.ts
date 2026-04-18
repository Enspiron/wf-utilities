import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { registerSchema } from '@/lib/community/schemas';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid registration payload.', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const { email, password, displayName } = parsed.data;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const userId = data.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Registration failed: missing user id.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, userId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
