// Google service-account auth, hand-rolled so nothing but Deno's own crypto is
// needed. The private key lives in a Supabase secret and is never logged.
//
// The service account has no Drive storage of its own — a service account gets
// zero personal quota — so it can only write inside a Shared Drive it has been
// added to. Add it as Content Manager on "PAYMENT TERMINALS"; the quota then
// belongs to the drive and no domain-wide delegation is needed.

const SCOPE = "https://www.googleapis.com/auth/drive";
const SECRET = "GOOGLE_SERVICE_ACCOUNT_TERMINAL_CERT_JSON";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function account(): ServiceAccount {
  const raw = Deno.env.get(SECRET);
  if (!raw) throw new Error(`${SECRET} is not set`);
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(raw);
  } catch {
    throw new Error(`${SECRET} is not valid JSON`);
  }
  if (!sa.client_email || !sa.private_key) throw new Error(`${SECRET} is missing client_email / private_key`);
  return sa;
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const b64urlText = (s: string) => b64url(new TextEncoder().encode(s));

/** PEM (PKCS#8) -> CryptoKey for RS256 signing. */
async function importKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----[A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

let cached: { token: string; exp: number } | null = null;

/** OAuth access token for the service account, cached until shortly before it expires. */
export async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;

  const sa = account();
  const header = b64urlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64urlText(JSON.stringify({
    iss: sa.client_email,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const key = await importKey(sa.private_key);
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`)),
  );
  const assertion = `${header}.${claims}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await res.json().catch(() => ({}));
  // Never echo the response body outward: a bad key produces errors that quote
  // the assertion back.
  if (!res.ok || !body.access_token) throw new Error(`google_token_failed_${res.status}`);

  cached = { token: body.access_token, exp: now + Number(body.expires_in ?? 3600) };
  return cached.token;
}

/** Multipart upload into a Shared Drive folder. Returns the new file id. */
export async function uploadToFolder(
  token: string,
  folderId: string,
  filename: string,
  contentType: string,
  bytes: Uint8Array,
): Promise<string> {
  const boundary = `cert${crypto.randomUUID().replace(/-/g, "")}`;
  const meta = JSON.stringify({ name: filename, parents: [folderId] });
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\ncontent-type: ${contentType}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.id) {
    const reason = out?.error?.message ?? `http_${res.status}`;
    throw new Error(String(reason).slice(0, 300));
  }
  return out.id as string;
}
