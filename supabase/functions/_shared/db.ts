// The cert schema is NOT exposed through PostgREST, on purpose. Nothing that
// speaks the public REST API — anon key, service key, a future misconfigured
// client — can name these tables at all. The functions talk to Postgres
// directly over SUPABASE_DB_URL instead, which Supabase injects into every Edge
// Function. Every query the app can make lives in this file.
import postgres from "npm:postgres@3.4.5";
import { createClient } from "jsr:@supabase/supabase-js@2";

const dbUrl = Deno.env.get("SUPABASE_DB_URL");
if (!dbUrl) throw new Error("SUPABASE_DB_URL missing");

export const sql = postgres(dbUrl, {
  prepare: false,
  max: 3,
  idle_timeout: 20,
  connection: { application_name: "terminal-cert" },
});

export const PROOF_BUCKET = "cert-proofs";

/** Storage speaks its own API and does not care about the schema grants. */
export function proofs() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    .storage.from(PROOF_BUCKET);
}

export interface Cycle {
  id: string; label: string; started_on: string; expires_on: string;
  drive_folder_id: string | null; is_current: boolean;
}
export interface TerminalRef { id: string; store_code: string; tests: string[] }

const one = <T>(rows: T[]): T | null => rows[0] ?? null;

/* ---------- access ---------- */

/** bcrypt compare stays in Postgres; the hash never leaves the database. */
export async function checkAccessCode(code: string): Promise<string | null> {
  const rows = await sql<{ scope: string | null }[]>`
    select cert.check_access_code(${code}) as scope`;
  return rows[0]?.scope ?? null;
}

/* ---------- reads ---------- */

export async function currentCycle(): Promise<Cycle | null> {
  return one(await sql<Cycle[]>`
    select * from cert.cycles where is_current limit 1`);
}

export async function terminalRef(id: string): Promise<TerminalRef | null> {
  return one(await sql<TerminalRef[]>`
    select id, store_code, tests from cert.terminals where id = ${id}`);
}

/**
 * A store code sees its own store only. Head office sees everything.
 *
 * Archived terminals — the ones that were retired or never existed — stay out
 * of a store's register entirely: a manager should not be asked to test a
 * terminal that is not there. Head office still gets them, flagged inactive,
 * so the decision can be seen and undone.
 */
export async function terminals(scope: string | null, includeArchived = false) {
  return await sql`
    select * from cert.terminals
     where (${includeArchived} or active)
       and (${scope}::text is null or store_code = ${scope})
     order by active desc, id`;
}

/**
 * Archive or restore a terminal. Head office only — enforced by the caller.
 * Nothing is deleted: results already recorded against it stay on the row and
 * come back intact if it is restored.
 */
export async function setTerminalActive(id: string, active: boolean) {
  return one(await sql<{ id: string; store_code: string; active: boolean }[]>`
    update cert.terminals
       set active = ${active}, updated_at = now()
     where id = ${id}
     returning id, store_code, active`);
}

/* ---------- merchant accounts ---------- */

/**
 * The accounts a processor bills and settles, scoped like everything else: a
 * store sees the accounts behind its own terminals and no one else's. Contract
 * and cost detail is head office's business, so it is stripped for a store
 * scope rather than merely hidden in the page — a payload the browser never
 * receives cannot leak from it.
 */
export async function merchantAccounts(scope: string | null) {
  const rows = await sql`
    select * from cert.merchant_accounts
     where (${scope}::text is null or store_code = ${scope})
     order by store_code, processor, pos`;
  if (!scope) return rows;
  return rows.map((r: Record<string, unknown>) => {
    const { monthly_fee: _f, account_rep: _r, notes: _n, ...rest } = r;
    return rest;
  });
}

/** The columns head office may change. Anything else in the body is ignored. */
const MERCHANT_FIELDS = [
  "mid", "label", "purpose", "batch_close", "pos_zout",
  "support_phone", "support_email", "account_rep", "portal_url",
  "monthly_fee", "notes",
] as const;

export async function setMerchantAccount(id: string, patch: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const k of MERCHANT_FIELDS) {
    if (!(k in patch)) continue;
    const v = patch[k];
    // "" means "cleared", which for a time or a number has to be null, not ''.
    clean[k] = v === "" || v === undefined ? null : v;
  }
  if (!Object.keys(clean).length) return null;
  clean.updated_at = new Date().toISOString();
  return one(await sql`
    update cert.merchant_accounts set ${sql(clean)}
     where id = ${id}
     returning *`);
}

/**
 * The facts about a physical box that head office keeps: whose it is, what it
 * costs a month, and the serial stamped on its underside. Only the keys
 * actually present are touched, so setting a serial cannot silently wipe an
 * ownership someone else just recorded.
 */
const TERMINAL_FIELDS = ["ownership", "monthly_rental", "serial"] as const;

export async function setTerminalFields(id: string, patch: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const k of TERMINAL_FIELDS) {
    if (!(k in patch)) continue;
    const v = patch[k];
    clean[k] = v === "" || v === undefined ? null : v;
  }
  if (!Object.keys(clean).length) return null;
  clean.updated_at = new Date().toISOString();
  return one(await sql<{ id: string; store_code: string }[]>`
    update cert.terminals set ${sql(clean)}
     where id = ${id}
     returning id, store_code`);
}

export async function testFolders() {
  return await sql<{ terminal_id: string; test_code: string; drive_folder_id: string }[]>`
    select terminal_id, test_code, drive_folder_id from cert.terminal_test_folders`;
}

export async function folderFor(terminalId: string, testCode: string): Promise<string | null> {
  const rows = await sql<{ drive_folder_id: string }[]>`
    select drive_folder_id from cert.terminal_test_folders
     where terminal_id = ${terminalId} and test_code = ${testCode}`;
  return rows[0]?.drive_folder_id ?? null;
}

/**
 * The audit trail for a cycle, newest first. Joined to the result that is
 * current for the same terminal and test so each line can carry a link
 * straight to its proof, rather than making someone hunt the Drive folder.
 */
export async function auditLog(cycleId: string, scope: string | null, limit = 600) {
  return await sql`
    select a.at, a.cycle_id, a.terminal_id, a.test_code, a.store_code,
           a.action, a.result, a.actor, a.detail,
           r.drive_file_id, r.proof_filename
      from cert.audit_log a
      left join cert.results r
        on r.cycle_id = a.cycle_id
       and r.terminal_id = a.terminal_id
       and r.test_code = a.test_code
     where a.cycle_id = ${cycleId}
       and (${scope}::text is null or a.store_code = ${scope})
     order by a.at desc
     limit ${limit}`;
}

export async function results(cycleId: string, scope: string | null) {
  return await sql`
    select * from cert.results
     where cycle_id = ${cycleId}
       and (${scope}::text is null or store_code = ${scope})`;
}

/* ---------- writes ---------- */

export interface ResultRow {
  cycle_id: string; terminal_id: string; test_code: string; store_code: string;
  result: string; tester_name: string; reference: string | null; notes: string | null;
  proof_path: string; proof_filename: string;
}

/**
 * recorded_at is now() from the database, never a value the client sent — a
 * timestamp the tester can choose is not a timestamp. Re-testing replaces the
 * row and clears the previous Drive mirror so it is uploaded again.
 */
export async function saveResult(r: ResultRow) {
  return one(await sql`
    insert into cert.results
      (cycle_id, terminal_id, test_code, store_code, result, tester_name,
       reference, notes, proof_path, proof_filename, recorded_at)
    values
      (${r.cycle_id}, ${r.terminal_id}, ${r.test_code}, ${r.store_code}, ${r.result},
       ${r.tester_name}, ${r.reference}, ${r.notes}, ${r.proof_path}, ${r.proof_filename}, now())
    on conflict (cycle_id, terminal_id, test_code) do update set
      result = excluded.result,
      tester_name = excluded.tester_name,
      reference = excluded.reference,
      notes = excluded.notes,
      proof_path = excluded.proof_path,
      proof_filename = excluded.proof_filename,
      recorded_at = now(),
      drive_file_id = null,
      drive_synced_at = null,
      drive_error = null
    returning *`);
}

export async function logAudit(a: {
  cycle_id: string; terminal_id: string; test_code: string; store_code: string;
  action: string; result?: string | null; actor?: string | null; detail?: string | null;
}) {
  await sql`
    insert into cert.audit_log
      (cycle_id, terminal_id, test_code, store_code, action, result, actor, detail)
    values
      (${a.cycle_id}, ${a.terminal_id}, ${a.test_code}, ${a.store_code},
       ${a.action}, ${a.result ?? null}, ${a.actor ?? null}, ${a.detail ?? null})`;
}

/* ---------- drive mirror ---------- */

export interface PendingProof {
  id: number; terminal_id: string; test_code: string; result: string;
  tester_name: string; reference: string | null;
  proof_path: string; proof_filename: string; recorded_at: string;
}

export async function pendingProofs(limit: number) {
  return await sql<PendingProof[]>`
    select id, terminal_id, test_code, result, tester_name, reference,
           proof_path, proof_filename, recorded_at
      from cert.results
     where proof_path is not null and drive_file_id is null
     order by recorded_at
     limit ${limit}`;
}

export async function markSynced(id: number, fileId: string) {
  await sql`
    update cert.results
       set drive_file_id = ${fileId}, drive_synced_at = now(), drive_error = null
     where id = ${id}`;
}

export async function markSyncFailed(id: number, message: string) {
  await sql`update cert.results set drive_error = ${message} where id = ${id}`;
}
