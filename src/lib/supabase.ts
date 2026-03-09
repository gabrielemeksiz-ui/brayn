import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (supabase) {
    return supabase;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("Supabase env vars missing", {
      hasUrl: !!url,
      hasServiceRoleKey: !!serviceRoleKey,
    });
    throw new Error("Supabase environment variables are missing");
  }

  supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return supabase;
}

// alias pratique que tu peux utiliser dans tes routes
export const supabaseServer = getSupabaseServerClient();
