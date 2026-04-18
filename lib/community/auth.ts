import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AppRole } from '@/lib/community/types';

export type AuthContext = {
  userId: string;
  email: string;
  role: AppRole;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = ((profile?.role as AppRole | undefined) || 'user') as AppRole;

  return {
    userId: user.id,
    email: user.email || '',
    role,
  };
}

export function isModeratorOrAdmin(role: AppRole): boolean {
  return role === 'moderator' || role === 'admin';
}
