// POST { code } -> { token, scope, expires }
import { admin } from "../_shared/db.ts";
import { issue } from "../_shared/session.ts";
import { json, preflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const origin = req.headers.get("origin");
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  let code = "";
  try { code = String((await req.json()).code ?? "").trim(); } catch { /* handled below */ }
  if (!code) return json({ error: "code_required" }, 400, origin);

  // bcrypt compare happens in Postgres; the hash never leaves the database.
  const { data, error } = await admin().rpc("check_access_code", { p_code: code });
  if (error) {
    console.error("check_access_code failed", error.message);
    return json({ error: "server_error" }, 500, origin);
  }
  if (!data) {
    // Same shape and timing regardless of which part was wrong.
    return json({ error: "bad_code" }, 401, origin);
  }

  const { token, expires } = await issue(data as string);
  return json({ token, scope: data, expires }, 200, origin);
});
