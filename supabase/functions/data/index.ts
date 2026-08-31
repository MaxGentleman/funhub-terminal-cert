// GET -> everything the signed-in scope may see.
// Terminals are visible to all scopes (managers can see other stores exist);
// what a scope may *write* is decided in result/index.ts.
import { admin } from "../_shared/db.ts";
import { bearer, verify, isAdmin } from "../_shared/session.ts";
import { json, preflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const origin = req.headers.get("origin");

  const scope = await verify(bearer(req));
  if (!scope) return json({ error: "unauthorised" }, 401, origin);

  const db = admin();
  const [cycleRes, termRes, foldRes] = await Promise.all([
    db.from("cycles").select("*").eq("is_current", true).maybeSingle(),
    db.from("terminals").select("*").eq("active", true).order("id"),
    db.from("terminal_test_folders").select("*"),
  ]);
  const bad = cycleRes.error ?? termRes.error ?? foldRes.error;
  if (bad) { console.error("data load failed", bad.message); return json({ error: "server_error" }, 500, origin); }

  const cycle = cycleRes.data;
  if (!cycle) return json({ error: "no_current_cycle" }, 409, origin);

  // A manager only needs their own store's results; head office needs all.
  let q = db.from("results").select("*").eq("cycle_id", cycle.id);
  if (!isAdmin(scope)) q = q.eq("store_code", scope);
  const { data: results, error: rErr } = await q;
  if (rErr) { console.error("results load failed", rErr.message); return json({ error: "server_error" }, 500, origin); }

  const folders: Record<string, Record<string, string>> = {};
  for (const f of foldRes.data ?? []) {
    (folders[f.terminal_id] ??= {})[f.test_code] = f.drive_folder_id;
  }

  return json({ scope, cycle, terminals: termRes.data, folders, results }, 200, origin);
});
