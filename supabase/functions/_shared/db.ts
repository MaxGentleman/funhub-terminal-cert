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

/** A store code sees its own store only. Head office sees everything. */
export async function terminals(scope: string | null) {
  return await sql`
    select * from cert.terminals
     where active
       and (${scope}::text is null or store_code = ${scope})
     order by id`;
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
