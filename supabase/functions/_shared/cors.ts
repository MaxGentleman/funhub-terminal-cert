// The app is served from Vercel and talks to Supabase on another origin.
const ALLOWED = (Deno.env.get("CERT_ALLOWED_ORIGINS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  // With no allow-list configured, fall back to the requesting origin so local
  // dev works. Set CERT_ALLOWED_ORIGINS in production.
  const allow = !ALLOWED.length ? (origin ?? "*")
    : ALLOWED.includes(origin ?? "") ? (origin as string)
    : ALLOWED[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "content-type": "application/json" },
  });
}

export function preflight(req: Request) {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}
