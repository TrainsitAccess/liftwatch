import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side client using the service role key. Returns null when env is not
// configured, which puts the poller into dry-run mode (fetch + normalize, no
// writes) so it can be exercised before a Supabase project exists.
export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
