import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/supabase/env';

let cachedAdminClient: SupabaseClient | null = null;

export function createSupabaseAdminClient(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient;

  cachedAdminClient = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return cachedAdminClient;
}
