// POST { terminal_id, test_code, ext } -> { path, token }
// Hands back a short-lived signed upload URL so the file goes straight from the
// phone to Storage. Nothing large passes through the function.
import { currentCycle, terminalRef, proofs } from "../_shared/db.ts";
import { bearer, verify, canWrite } from "../_shared/session.ts";
import { json, preflight } from "../_shared/cors.ts";

const EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "pdf"]);

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const origin = req.headers.get("origin");
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  const scope = await verify(bearer(req));
  if (!scope) return json({ error: "unauthorised" }, 401, origin);

  let body: { terminal_id?: string; test_code?: string; ext?: string } = {};
  try { body = await req.json(); } catch { /* validated below */ }
  const terminalId = String(body.terminal_id ?? "");
  const testCode = String(body.test_code ?? "");
  const ext = String(body.ext ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!terminalId || !testCode) return json({ error: "terminal_and_test_required" }, 400, origin);
  if (!EXT.has(ext)) return json({ error: "unsupported_file_type" }, 400, origin);

  try {
    const term = await terminalRef(terminalId);
    if (!term) return json({ error: "unknown_terminal" }, 404, origin);
    if (!term.tests.includes(testCode)) return json({ error: "test_not_on_terminal" }, 400, origin);
    if (!canWrite(scope, term.store_code)) return json({ error: "wrong_store" }, 403, origin);

    const cycle = await currentCycle();
    if (!cycle) return json({ error: "no_current_cycle" }, 409, origin);

    // The path is built here, never accepted from the client — it is what
    // result/ checks the saved proof against.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `${cycle.id}/${term.store_code}/${terminalId}/${testCode}/${stamp}.${ext}`;

    const { data: signed, error } = await proofs().createSignedUploadUrl(path);
    if (error || !signed) {
      console.error("signed upload url failed", error?.message);
      return json({ error: "server_error" }, 500, origin);
    }
    return json({ path, token: signed.token }, 200, origin);
  } catch (e) {
    console.error("upload-url failed", String(e));
    return json({ error: "server_error" }, 500, origin);
  }
});
