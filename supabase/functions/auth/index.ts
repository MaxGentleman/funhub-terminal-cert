// POST { code } -> { token, scope, expires }
import { checkAccessCode } from "../_shared/db.ts";
import { issue } from "../_shared/session.ts";
import { json, preflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const origin = req.headers.get("origin");
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  let code = "";
  try { code = String((await req.json()).code ?? "").trim(); } catch { /* handled below */ }
  if (!code) return json({ error: "code_required" }, 400, origin);

  let scope: string | null;
  try {
    scope = await checkAccessCode(code);
  } catch (e) {
    console.error("check_access_code failed", String(e));
    return json({ error: "server_error" }, 500, origin);
  }
  // Same shape and message whichever part was wrong.
  if (!scope) return json({ error: "bad_code" }, 401, origin);

  const { token, expires } = await issue(scope);
  return json({ token, scope, expires }, 200, origin);
});
