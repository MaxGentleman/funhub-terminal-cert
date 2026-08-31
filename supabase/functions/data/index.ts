// GET -> everything the signed-in scope may see.
// A store code sees its own store and nothing else — not other stores'
// terminals, not their results. Head office sees everything.
import { currentCycle, terminals, testFolders, results } from "../_shared/db.ts";
import { bearer, verify, isAdmin } from "../_shared/session.ts";
import { json, preflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const origin = req.headers.get("origin");

  const scope = await verify(bearer(req));
  if (!scope) return json({ error: "unauthorised" }, 401, origin);

  // null means "no store filter" — head office only.
  const only = isAdmin(scope) ? null : scope;

  try {
    const cycle = await currentCycle();
    if (!cycle) return json({ error: "no_current_cycle" }, 409, origin);

    const [terms, folderRows, rows] = await Promise.all([
      terminals(only),
      testFolders(),
      results(cycle.id, only),
    ]);

    const folders: Record<string, Record<string, string>> = {};
    for (const f of folderRows) {
      (folders[f.terminal_id] ??= {})[f.test_code] = f.drive_folder_id;
    }

    return json({ scope, cycle, terminals: terms, folders, results: rows }, 200, origin);
  } catch (e) {
    console.error("data load failed", String(e));
    return json({ error: "server_error" }, 500, origin);
  }
});
