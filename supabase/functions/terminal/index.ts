// POST { terminal_id, active } -> archive or restore a terminal.
//
// Head office only. A store manager cannot make a terminal they are behind on
// disappear from their own register — that is exactly the hole this whole
// register exists to close. Nothing is deleted: `active` flips, the recorded
// results stay on the row, and the change is written to the audit log with the
// person who made it, so an archived terminal is a decision with a name on it.
import { currentCycle, terminalRef, setTerminalActive, logAudit } from "../_shared/db.ts";
import { bearer, verify, isAdmin } from "../_shared/session.ts";
import { json, preflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const origin = req.headers.get("origin");
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  const scope = await verify(bearer(req));
  if (!scope) return json({ error: "unauthorised" }, 401, origin);
  if (!isAdmin(scope)) return json({ error: "admin_only" }, 403, origin);

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* validated below */ }
  const terminalId = String(b.terminal_id ?? "");
  const active = b.active === true;
  const actor = String(b.actor ?? "").trim();
  const reason = String(b.reason ?? "").trim();

  if (!terminalId) return json({ error: "terminal_id_required" }, 400, origin);
  // Archiving is the destructive-looking direction, so it is the one that has
  // to be explained. Restoring needs no excuse.
  if (!active && !reason) return json({ error: "reason_required" }, 400, origin);

  try {
    const term = await terminalRef(terminalId);
    if (!term) return json({ error: "unknown_terminal" }, 404, origin);

    const row = await setTerminalActive(terminalId, active);
    if (!row) return json({ error: "unknown_terminal" }, 404, origin);

    const cycle = await currentCycle();
    await logAudit({
      cycle_id: cycle?.id ?? "",
      terminal_id: terminalId,
      test_code: "",
      store_code: term.store_code,
      action: active ? "restore" : "archive",
      result: null,
      actor: actor || "head office",
      detail: reason || null,
    });

    return json({ ok: true, terminal_id: row.id, active: row.active }, 200, origin);
  } catch (e) {
    console.error("terminal archive failed", String(e));
    return json({ error: "server_error" }, 500, origin);
  }
});
