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
import { pendingProofs, folderFor, proofs, markSynced, markSyncFailed, type PendingProof } from "../_shared/db.ts";
import { bearer, verify } from "../_shared/session.ts";
import { json, preflight } from "../_shared/cors.ts";
import { accessToken, uploadToFolder } from "../_shared/google.ts";

const BATCH = 20;

const TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", heic: "image/heic", pdf: "application/pdf",
};

const safe = (s: string) => (s || "").replace(/[^A-Za-z0-9 _.-]/g, "").trim().slice(0, 60);
const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();

/** "2026-08-31 PASS 12345678 Marie.jpg" — readable in Drive without opening it. */
function driveName(r: PendingProof): string {
  const stamp = new Date(r.recorded_at).toISOString().slice(0, 10);
  const parts = [stamp, r.result.toUpperCase(), safe(r.reference ?? ""), safe(r.tester_name)];
  return `${parts.filter(Boolean).join(" ")}.${extOf(r.proof_filename) || "jpg"}`;
}

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const origin = req.headers.get("origin");
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  const key = Deno.env.get("CERT_SYNC_SECRET");
  const authorised = (key && req.headers.get("x-cert-sync-key") === key) ||
    Boolean(await verify(bearer(req)));
  if (!authorised) return json({ error: "unauthorised" }, 401, origin);

  let pending: PendingProof[];
  try {
    pending = await pendingProofs(BATCH);
  } catch (e) {
    console.error("pending query failed", String(e));
    return json({ error: "server_error" }, 500, origin);
  }
  if (!pending.length) return json({ ok: true, pending: 0, synced: 0, failed: 0 }, 200, origin);

  let token: string;
  try {
    token = await accessToken();
  } catch (e) {
    // No credentials, bad key, Google down. Every row stays pending — nothing
    // recorded is lost, the mirror simply has not run yet.
    console.error("google auth failed", String(e));
    return json({ error: "google_auth_failed", pending: pending.length }, 503, origin);
  }

  const bucket = proofs();
  let synced = 0, failed = 0;

  for (const r of pending) {
    try {
      const folder = await folderFor(r.terminal_id, r.test_code);
      if (!folder) throw new Error("no_drive_folder_for_test");

      const { data: blob, error } = await bucket.download(r.proof_path);
      if (error || !blob) throw new Error(`storage_download_failed: ${error?.message ?? "empty"}`);

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const type = blob.type && blob.type !== "application/octet-stream"
        ? blob.type
        : (TYPES[extOf(r.proof_filename)] ?? "application/octet-stream");

      const fileId = await uploadToFolder(token, folder, driveName(r), type, bytes);
      await markSynced(r.id, fileId);
      synced++;
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e).slice(0, 300);
      console.error(`sync failed for result ${r.id}`, msg);
      try { await markSyncFailed(r.id, msg); } catch { /* the row stays pending, which is the safe end */ }
      failed++;
    }
  }

  return json({ ok: true, pending: pending.length, synced, failed }, 200, origin);
});
