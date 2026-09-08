// The one endpoint head office writes fleet changes through. Dispatches on
// `action`:
//   archive  { terminal_id, active, reason, actor }  archive or restore
//   merchant { merchant_id, patch, actor }           edit a merchant account
//   owner    { terminal_id, ownership, monthly_rental, actor }
//
// One function rather than three because every one of these is the same
// decision — head office changing a fact about the fleet — and each new Edge
// Function is another JWT setting to remember to turn off.
//
// Head office only. A store manager cannot make a terminal they are behind on
// disappear from their own register — that is exactly the hole this whole
// register exists to close. Nothing is deleted: `active` flips, the recorded
// results stay on the row, and the change is written to the audit log with the
// person who made it, so an archived terminal is a decision with a name on it.
import { currentCycle, terminalRef, setTerminalActive, setMerchantAccount,
         setTerminalOwnership, logAudit } from "../_shared/db.ts";
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

  // Absent action means the original archive call, so older clients keep working.
  const action = String(b.action ?? "archive");
  const cycleNow = await currentCycle();

  if (action === "merchant") {
    const merchantId = String(b.merchant_id ?? "");
    const patch = (b.patch ?? {}) as Record<string, unknown>;
    if (!merchantId) return json({ error: "merchant_id_required" }, 400, origin);
    try {
      const row = await setMerchantAccount(merchantId, patch);
      if (!row) return json({ error: "nothing_to_change" }, 400, origin);
      await logAudit({
        cycle_id: cycleNow?.id ?? "", terminal_id: "", test_code: "",
        store_code: String(row.store_code ?? ""), action: "merchant_edit", result: null,
        actor: String(b.actor ?? "").trim() || "head office",
        detail: `${row.label ?? merchantId}: ${Object.keys(patch).join(", ")}`,
      });
      return json({ ok: true, merchant: row }, 200, origin);
    } catch (e) {
      console.error("merchant edit failed", String(e));
      return json({ error: "server_error" }, 500, origin);
    }
  }

  if (action === "owner") {
    const tid = String(b.terminal_id ?? "");
    const own = b.ownership === "owned" || b.ownership === "rented" ? String(b.ownership) : null;
    const rentRaw = b.monthly_rental;
    const rent = rentRaw === "" || rentRaw == null ? null : Number(rentRaw);
    if (!tid) return json({ error: "terminal_id_required" }, 400, origin);
    if (rent !== null && !Number.isFinite(rent)) return json({ error: "bad_rental" }, 400, origin);
    try {
      const row = await setTerminalOwnership(tid, own, rent);
      if (!row) return json({ error: "unknown_terminal" }, 404, origin);
      await logAudit({
        cycle_id: cycleNow?.id ?? "", terminal_id: tid, test_code: "",
        store_code: row.store_code, action: "ownership", result: null,
        actor: String(b.actor ?? "").trim() || "head office",
        detail: own ? `${own}${rent !== null ? ` · $${rent}/mo` : ""}` : "cleared",
      });
      return json({ ok: true, terminal_id: row.id }, 200, origin);
    } catch (e) {
      console.error("ownership edit failed", String(e));
      return json({ error: "server_error" }, 500, origin);
    }
  }

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

    await logAudit({
      cycle_id: cycleNow?.id ?? "",
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
