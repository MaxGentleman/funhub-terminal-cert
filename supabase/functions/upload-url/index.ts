// POST { terminal_id, test_code, ext } -> { path, token }
// Hands back a short-lived signed upload URL so the file goes straight from the
// phone to Storage. Nothing large passes through the function.
import { admin, PROOF_BUCKET } from "../_shared/db.ts";
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

  const db = admin();
  const { data: term, error } = await db
    .from("terminals").select("id, store_code, tests").eq("id", terminalId).maybeSingle();
  if (error) { console.error(error.message); return json({ error: "server_error" }, 500, origin); }
  if (!term) return json({ error: "unknown_terminal" }, 404, origin);
  if (!(term.tests as string[]).includes(testCode)) return json({ error: "test_not_on_terminal" }, 400, origin);
  if (!canWrite(scope, term.store_code)) return json({ error: "wrong_store" }, 403, origin);

  const { data: cycle } = await db.from("cycles").select("id").eq("is_current", true).maybeSingle();
  if (!cycle) return json({ error: "no_current_cycle" }, 409, origin);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `${cycle.id}/${term.store_code}/${terminalId}/${testCode}/${stamp}.${ext}`;

  const { data: signed, error: sErr } = await db.storage.from(PROOF_BUCKET).createSignedUploadUrl(path);
  if (sErr) { console.error("signed upload url failed", sErr.message); return json({ error: "server_error" }, 500, origin); }

  return json({ path, token: signed.token }, 200, origin);
});
