// Sessions are a signed { scope, exp } blob. Deliberately not a Supabase auth
// user: with a shared store code there is no person to authenticate, so the
// token asserts a scope and nothing more.
const enc = new TextEncoder();

function secret(): string {
  const s = Deno.env.get("CERT_SESSION_SECRET");
  if (!s || s.length < 32) {
    throw new Error("CERT_SESSION_SECRET missing or shorter than 32 chars");
  }
  return s;
}

const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b as ArrayBuffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export const SESSION_HOURS = 12;

export async function issue(scope: string): Promise<{ token: string; expires: string }> {
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  const payload = b64url(enc.encode(JSON.stringify({ scope, exp })));
  return { token: `${payload}.${await hmac(payload)}`, expires: new Date(exp).toISOString() };
}

/** Returns the scope, or null if the token is missing, tampered with or stale. */
export async function verify(token: string | null): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = await hmac(payload);
  // Constant-time-ish compare: same length, XOR every byte.
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;

  try {
    const { scope, exp } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof scope !== "string" || typeof exp !== "number" || Date.now() > exp) return null;
    return scope;
  } catch {
    return null;
  }
}

export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

export const isAdmin = (scope: string) => scope === "ADMIN";

/** Head office writes anywhere; a store code writes only to its own store. */
export const canWrite = (scope: string, storeCode: string) =>
  isAdmin(scope) || scope === storeCode;
