// POST { terminal_id, test_code, result, tester_name, reference, notes, proof_path }
// The gates that make this register worth having live here, not in the browser:
//   - pass  needs a reference and a proof file that actually exists
//   - fail  needs a written explanation and a proof file that actually exists
//   - the timestamp comes from the database, never from the client
import { currentCycle, terminalRef, proofs, saveResult, logAudit } from "../_shared/db.ts";
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

  try {
    const term = await terminalRef(terminalId);
    if (!term) return json({ error: "unknown_terminal" }, 404, origin);
    if (!term.tests.includes(testCode)) return json({ error: "test_not_on_terminal" }, 400, origin);
    if (!canWrite(scope, term.store_code)) return json({ error: "wrong_store" }, 403, origin);

    const cycle = await currentCycle();
    if (!cycle) return json({ error: "no_current_cycle" }, 409, origin);

    // The proof claim is checked, not trusted. Ticking a box without doing the
    // thing is the exact failure this register exists to stop, so "I uploaded
    // it" is not something a client gets to assert.
    if (!proofPath.startsWith(`${cycle.id}/${term.store_code}/${terminalId}/${testCode}/`)) {
      return json({ error: "proof_path_mismatch" }, 400, origin);
    }
    const cut = proofPath.lastIndexOf("/");
    const dir = proofPath.slice(0, cut);
    const file = proofPath.slice(cut + 1);
    const { data: listed, error: lErr } = await proofs().list(dir, { search: file });
    if (lErr) { console.error("storage list failed", lErr.message); return json({ error: "server_error" }, 500, origin); }
    if (!listed?.some((o) => o.name === file)) return json({ error: "proof_not_uploaded" }, 400, origin);

    const saved = await saveResult({
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
    });

    await logAudit({
      cycle_id: cycle.id, terminal_id: terminalId, test_code: testCode,
      store_code: term.store_code, action: "recorded", result: outcome,
      actor: tester, detail: outcome === "pass" ? reference : notes,
    });

    return json({ ok: true, result: saved }, 200, origin);
  } catch (e) {
    console.error("save failed", String(e));
    return json({ error: "server_error" }, 500, origin);
  }
});
