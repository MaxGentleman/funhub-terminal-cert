# FUNHUB — Terminal Certification Register

Proves that every payment terminal in every store has actually been tested, with
a receipt behind each result. Replaces a spreadsheet whose boxes could be ticked
without anyone doing the work.

Also carries the refund how-to guides staff use at the counter.

## Why it exists

A test cannot be marked **Pass** without an auth reference and an uploaded
receipt. A **Fail** needs a written explanation and a photo of the error. The
timestamp is set by the server, never typed. Those three rules are the product —
keep them if you rewrite anything.

## Stack

- Static front end (Vite, no framework) on Vercel
- Supabase project `os-tools` (`lbmcstlfubkyooeqkhce`), everything under the `cert` schema
- Proof files in the private `cert-proofs` storage bucket, served by signed URL
- Edge Functions hold all the logic; the browser never touches the tables

## Access model

Managers unlock with a shared store code. A code buys you write access to *your*
store only; head office unlocks everything plus settings.

Because the code is shared, the browser cannot be trusted with a database key.
Every `cert` table has RLS enabled with **no policies**, and the schema is revoked
from `anon`. The app posts a code to the `auth` function, gets a signed session
back, and every read and write goes through a function running as the service
role. If you ever expose these tables to the anon key, the access model is gone.

Per-person logins were the recommendation and were declined for rollout speed.
Swapping to them later touches `auth` and the session check, nothing else.

## Proof files

Supabase Storage is the store of record. A background job mirrors each file into
the matching Google Drive folder so finance find receipts where they already
look — that is for access, not durability.

The mirror runs *after* the save and can never block it. A failed mirror leaves
the result recorded and flagged unsynced.

Drive access uses a **service account**, not a person's Google account: a human's
OAuth token dies on a password change or when they leave, and fails silently.
`PAYMENT TERMINALS` sits in a Shared Drive, so the service account needs no
domain-wide delegation — add it as Content Manager and it works. (In a personal
My Drive it would fail: service accounts have no storage quota of their own.)

## Layout

    src/                front end
    supabase/functions/ auth · data · result · upload · drive-sync
    index.html          the shell
    src/app.js          the whole app: gate, terminal list, recording, guides
    src/api.js          the only place that talks to the backend
    src/config.js       store names, Drive roots, the API base
    src/data/           i18n, the six tests, the refund guides, step screenshots
    supabase/functions/ the five Edge Functions
    supabase/migrations/ schema, already applied to os-tools
    docs/               setup notes

## Where this lives

Repo sits on Max's personal GitHub for now and deploys from there to his Vercel
account. It is intended to move into `funhub-ca/funhub-ops` as a module later —
which is why all the data already lives in its own `cert` schema inside the
shared `os-tools` project rather than in app-local tables. Nothing has to be
migrated when it moves; a funhub-ops module can read the same schema.

## Publishing this repo

1. On GitHub, create a new repo named `funhub-terminal-cert`. Leave it
   **completely empty** — no README, no .gitignore, no licence. GitHub offers to
   add them and it is the wrong choice here: the first push then fails with
   "unrelated histories" because both sides have commits.
2. Check the remote matches the account you created it under:

       git remote -v
       git remote set-url origin https://github.com/<you>/funhub-terminal-cert.git

3. Push:

       git push -u origin main

"Repository not found" on push means one of three things, and GitHub returns the
same message for all of them on purpose: the repo does not exist, it exists under
a different owner than the remote says, or you are authenticated as someone
without access to it.

## Setup

    npm install
    cp .env.example .env      # fill in the anon key
    npm run dev

Server-side secrets (`CERT_SESSION_SECRET`, `CERT_SYNC_SECRET`,
`GOOGLE_SERVICE_ACCOUNT_TERMINAL_CERT_JSON`, `CERT_ALLOWED_ORIGINS`) are set in
the Supabase dashboard under Edge Functions → Secrets. They never go in this
repo or in Vercel. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`SUPABASE_DB_URL` are injected by Supabase.

Vercel needs one environment variable: `VITE_SUPABASE_URL`.

## Edge Functions

The browser never holds a key that can read `cert.*`. Every table has RLS
enabled with no policies and the schema is revoked from `anon`, so all reads and
writes go through these five functions running on the service role:

| Function | Does |
|---|---|
| `auth` | takes a store access code, returns a 12-hour HMAC-signed `{scope, exp}` token. The bcrypt compare stays in Postgres. |
| `data` | the register for that scope: cycle, terminals, folders, results. A store code sees only its own store. |
| `upload-url` | a single-use signed upload URL under `cycle/store/terminal/test/`. |
| `result` | records a test. Pass needs a reference, fail needs an explanation, both need a proof file — and the file is checked to exist in Storage before the row is written. |
| `drive-sync` | mirrors proof files into the Drive folder tree, after the fact. |

### Why the proof check is server-side

The whole reason this replaced a spreadsheet is that ticking a box is not
evidence. `result` refuses to write a row whose proof file is not actually in
the bucket, so "I uploaded it" cannot be asserted by a client.

### Why drive-sync is not on the save path

Drive is a backup copy, not the record. If Google is slow, rate-limited or
misconfigured, the result is still saved and flagged unsynced (`drive_error`),
and the next run picks it up from the `cert_results_pending_drive` index. A sync
that can block a manager finishing a test gets worked around, and a system
people work around stops being evidence.

Run it on a schedule, or by hand:

    curl -X POST https://<project>.supabase.co/functions/v1/drive-sync \
      -H "x-cert-sync-key: $CERT_SYNC_SECRET"

### Deploying

    supabase functions deploy auth data upload-url result drive-sync \
      --project-ref lbmcstlfubkyooeqkhce

`supabase/config.toml` sets `verify_jwt = false` on all five. That is not a gap:
these functions authenticate with our own signed session token, and `auth` is by
definition called without one. Supabase's JWT check would reject every call
before it reached the code.

### Why the cert schema is not exposed to PostgREST

It is not in the project's exposed schemas, and it should stay that way. The
functions reach Postgres directly over `SUPABASE_DB_URL`, so no key that speaks
the public REST API — anon, service, or a future misconfigured client — can even
name these tables. Adding `cert` to the exposed schemas would work and would
also throw that away.

## The recording flow

1. The manager picks a terminal and a test.
2. They choose pass or fail, type their name, and a reference (pass) or what
   went wrong (fail).
3. They photograph the signed merchant copy. It uploads immediately, to a path
   the **server** chose, under `cycle/store/terminal/test/`.
4. Save posts to `result`, which re-checks that the file is really in the bucket
   before it writes the row, and stamps the time from the database.
5. `drive-sync` mirrors the photo into the matching Drive folder, afterwards.

A re-test starts with an empty proof box on purpose. Carrying the previous run's
photo forward would let someone re-date an old receipt with two taps — the exact
move this replaced a spreadsheet to prevent. The old result stays on screen as
context; it just cannot be reused as evidence.

## Not built yet

Deliberately absent rather than half-present, because a button that cannot do
its job is worse than no button:

- **New cycle.** Six-monthly, head office. Today it is a SQL statement against
  `cert.cycles`; it needs an endpoint before the next rollover in Feb 2027.
- **Add a terminal.** New hardware is rare and needs its Drive folders created
  alongside the row.
- **Rotating access codes.** `select cert.set_access_code('03', '<new>', 'label')`.

## Verified end to end

Against the live project, with a real photo upload:

- a wrong code is refused; nothing renders before a right one
- a store code sees its own 10 terminals, not the other 29, and gets no
  dashboard or audit log
- a store code cannot get an upload URL for another store's terminal
- a pass with no reference is refused
- a result whose proof file was never uploaded is refused
- a saved result survives a reload
- a re-test will not accept the previous run's photo
