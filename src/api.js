/* The only way this app touches data. Five calls, one token.

   The token is an HMAC-signed { scope, exp } issued by the auth function — not
   a Supabase session, because a code shared by a whole store has no person to
   authenticate. It says which store you are, and the server decides the rest. */
import { API } from "./config.js";

const TOKEN_KEY = "fh_token";

export function token() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
function setToken(v) {
  try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
}
export function signOut() { setToken(""); }

/** Thrown for any non-2xx; `code` is the server's error string. */
export class ApiError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

async function call(path, { method = "POST", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (auth) headers.authorization = `Bearer ${token()}`;

  let res;
  try {
    res = await fetch(`${API}/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("offline", 0);
  }

  const out = await res.json().catch(() => ({}));
  /* Our own errors come back as { error }. The Supabase gateway rejects some
     requests before they ever reach the function and answers with { code } —
     surfacing that instead of a bare http_401 is the difference between "check
     the JWT setting on this function" and "something went wrong". */
  if (!res.ok) throw new ApiError(out.error || out.code || `http_${res.status}`, res.status);
  return out;
}

/** Exchange a store code for a session. */
export async function signIn(code) {
  const out = await call("auth", { body: { code }, auth: false });
  setToken(out.token);
  return out.scope;
}

/** The register for this scope. */
export function load() {
  return call("data", { method: "GET" });
}

/**
 * Put the proof in Storage and return its path.
 *
 * The path is chosen by the server, not here — it is what the result call
 * checks the file against, so a client that picks its own path proves nothing.
 */
export async function uploadProof(terminalId, testCode, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const { path, token: uploadToken } = await call("upload-url", {
    body: { terminal_id: terminalId, test_code: testCode, ext },
  });

  const url = `${API.replace("/functions/v1", "")}/storage/v1/object/upload/sign/cert-proofs/${path}?token=${encodeURIComponent(uploadToken)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new ApiError("upload_failed", res.status);
  return path;
}

/** Record the test. The server re-checks the proof actually exists. */
export function record(row) {
  return call("result", { body: row });
}

/**
 * Archive or restore a terminal. Head office only — the server checks the
 * scope again, so a store code cannot reach this even if the button is forged.
 */
export function setTerminalActive(terminalId, active, reason, actor) {
  return call("terminal", {
    body: { terminal_id: terminalId, active: active, reason: reason || "", actor: actor || "" },
  });
}

/**
 * Mirror new proofs into Drive. Never awaited by anything the manager is
 * waiting on: Drive being slow must not make finishing a test feel slow.
 */
export function syncDrive() {
  return call("drive-sync", {}).catch(() => {});
}
