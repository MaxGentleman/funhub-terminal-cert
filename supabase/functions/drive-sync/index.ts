// Mirrors proof files from Supabase Storage into the Drive folder tree.
//
// This runs AFTER a result is saved and is deliberately not on the critical
// path. Drive being slow, rate-limited or misconfigured must never stop a
// manager finishing a test — a sync that can block the job gets worked around,
// and a system people work around stops being evidence. A failed mirror leaves
// the result recorded and flagged unsynced; the next run retries it.
//
// Called two ways:
//   - by the app right after a save (session token), fire-and-forget
//   - by a schedule or by hand with the x-cert-sync-key header
import { admin, PROOF_BUCKET } from "../_shared/db.ts";
import { bearer, verify } from "../_shared/session.ts";
import { json, preflight } from "../_shared/cors.ts";
import { accessToken, uploadToFolder } from "../_shared/google.ts";

const BATCH = 20;

const TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", heic: "image/heic", pdf: "application/pdf",
};

const safe = (s: string) => (s || "").replace(/[^A-Za-z0-9 _.-]/g, "").trim().slice(0, 60);

/** 2026-08-31 PASS 12345678 Marie.jpg — readable in Drive without opening it. */
function driveName(r: Record<string, unknown>): string {
  const stamp = String(r.recorded_at ?? "").slice(0, 10);
  const ext = String(r.proof_filename ?? "").split(".").pop()?.toLowerCase() ?? "jpg";
  const tag = String(r.result ?? "").toUpperCase();
  const parts = [stamp, tag, safe(String(r.reference ?? "")), safe(String(r.tester_name ?? ""))]
    .filter(Boolean);
  return `${parts.join(" ")}.${ext}`;
}

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const origin = req.headers.get("origin");
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  const key = Deno.env.get("CERT_SYNC_SECRET");
  const authorised = (key && req.headers.get("x-cert-sync-key") === key) ||
    Boolean(await verify(bearer(req)));
  if (!authorised) return json({ error: "unauthorised" }, 401, origin);

  const db = admin();
  const { data: pending, error } = await db
    .from("results")
    .select("id, cycle_id, terminal_id, test_code, result, tester_name, reference, proof_path, proof_filename, recorded_at")
    .not("proof_path", "is", null)
    .is("drive_file_id", null)
    .order("recorded_at", { ascending: true })
    .limit(BATCH);
  if (error) {
    console.error("pending query failed", error.message);
    return json({ error: "server_error" }, 500, origin);
  }
  if (!pending?.length) return json({ ok: true, pending: 0, synced: 0, failed: 0 }, 200, origin);

  let token: string;
  try {
    token = await accessToken();
  } catch (e) {
    // No credentials, bad key, Google down. Say so plainly and leave every row
    // pending — nothing recorded is lost, the mirror just has not run yet.
    console.error("google auth failed", String(e));
    return json({ error: "google_auth_failed", pending: pending.length }, 503, origin);
  }

  let synced = 0, failed = 0;

  for (const r of pending) {
    const mark = (patch: Record<string, unknown>) =>
      db.from("results").update(patch).eq("id", r.id as number);
    try {
      const { data: folder } = await db
        .from("terminal_test_folders")
        .select("drive_folder_id")
        .eq("terminal_id", r.terminal_id as string)
        .eq("test_code", r.test_code as string)
        .maybeSingle();
      if (!folder?.drive_folder_id) throw new Error("no_drive_folder_for_test");

      const { data: blob, error: dErr } = await db.storage
        .from(PROOF_BUCKET).download(r.proof_path as string);
      if (dErr || !blob) throw new Error(`storage_download_failed: ${dErr?.message ?? "empty"}`);

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const ext = String(r.proof_filename ?? "").split(".").pop()?.toLowerCase() ?? "";
      const type = blob.type && blob.type !== "application/octet-stream"
        ? blob.type
        : (TYPES[ext] ?? "application/octet-stream");

      const fileId = await uploadToFolder(
        token, folder.drive_folder_id as string, driveName(r), type, bytes,
      );

      await mark({ drive_file_id: fileId, drive_synced_at: new Date().toISOString(), drive_error: null });
      synced++;
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e).slice(0, 300);
      console.error(`sync failed for result ${r.id}`, msg);
      await mark({ drive_error: msg });
      failed++;
    }
  }

  return json({ ok: true, pending: pending.length, synced, failed }, 200, origin);
});
