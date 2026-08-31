import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** Service-role client. The browser never gets a key that can read cert.* */
export function admin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "cert" },
  });
}

export const PROOF_BUCKET = "cert-proofs";
