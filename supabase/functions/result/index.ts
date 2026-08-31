// POST { terminal_id, test_code, result, tester_name, reference, notes, proof_path }
// The gates that make this register worth having live here, not in the browser:
//   - pass  needs a reference and a proof file that actually exists
//   - fail  needs a written explanation and a proof file that actually exists
//   - the timestamp is set by the database, never sent by the client
import { admin, PROOF_BUCKET } from "../_shared/db.ts";
import { bearer, verify, canWrite } from "../_shared/session.ts";
import { json, preflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const origin = req.headers.get("origin");
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  const scope = await verify(bearer(req));
  if (!scope) return json({ error: "unauthorised" }, 401, origin);

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* validated below */ }
  const terminalId = String(b.terminal_id ?? "");
  const testCode   = String(b.test_code ?? "");
  const outcome    = String(b.result ?? "");
  const tester     = String(b.tester_name ?? "").trim();
  const reference  = String(b.reference ?? "").trim();
  const notes      = String(b.notes ?? "").trim();
  const proofPath  = String(b.proof_path ?? "").trim();

  if (!["pass", "fail"].includes(outcome)) return json({ error: "result_must_be_pass_or_fail" }, 400, origin);
  if (!tester) return json({ error: "tester_name_required" }, 400, origin);
  if (outcome === "pass" && !reference) return json({ error: "reference_required_for_pass" }, 400, origin);
  if (outcome === "fail" && !notes)     return json({ error: "notes_required_for_fail" }, 400, origin);
  if (!proofPath) return json({ error: "proof_required" }, 400, origin);

  const db = admin();
  const { data: term } = await db
    .from("terminals").select("id, store_code, tests").eq("id", terminalId).maybeSingle();
  if (!term) return json({ error: "unknown_terminal" }, 404, origin);
  if (!(term.tests as string[]).includes(testCode)) return json({ error: "test_not_on_terminal" }, 400, origin);
  if (!canWrite(scope, term.store_code)) return json({ error: "wrong_store" }, 403, origin);

  const { data: cycle } = await db.from("cycles").select("id").eq("is_current", true).maybeSingle();
  if (!cycle) return json({ error: "no_current_cycle" }, 409, origin);

  // The proof claim is checked, not trusted. A tick box in a browser is exactly
  // what this whole system exists to stop.
  if (!proofPath.startsWith(`${cycle.id}/${term.store_code}/${terminalId}/${testCode}/`)) {
    return json({ error: "proof_path_mismatch" }, 400, origin);
  }
  const dir = proofPath.slice(0, proofPath.lastIndexOf("/"));
  const file = proofPath.slice(proofPath.lastIndexOf("/") + 1);
  const { data: listed, error: lErr } = await db.storage.from(PROOF_BUCKET).list(dir, { search: file });
  if (lErr) { console.error("storage list failed", lErr.message); return json({ error: "server_error" }, 500, origin); }
  if (!listed?.some((o) => o.name === file)) return json({ error: "proof_not_uploaded" }, 400, origin);

  const row = {
    cycle_id: cycle.id,
    terminal_id: terminalId,
    test_code: testCode,
    store_code: term.store_code,
    result: outcome,
    tester_name: tester,
    reference: reference || null,
    notes: notes || null,
    proof_path: proofPath,
    proof_filename: file,
    // re-testing replaces the result and clears the previous Drive mirror
    drive_file_id: null,
    drive_synced_at: null,
    drive_error: null,
    recorded_at: new Date().toISOString(),
  };

  const { data: saved, error } = await db
    .from("results").upsert(row, { onConflict: "cycle_id,terminal_id,test_code" }).select().single();
  if (error) { console.error("save failed", error.message); return json({ error: "server_error" }, 500, origin); }

  await db.from("audit_log").insert({
    cycle_id: cycle.id, terminal_id: terminalId, test_code: testCode,
    store_code: term.store_code, action: "recorded", result: outcome,
    actor: tester, detail: outcome === "pass" ? reference : notes,
  });

  return json({ ok: true, result: saved }, 200, origin);
});
