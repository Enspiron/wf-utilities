import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (cachedClient) return cachedClient;

  cachedClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
  return cachedClient;
}
