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
    supabase/migrations/ schema, already applied to os-tools
    docs/               setup notes

## Where this lives

Repo sits on Max's personal GitHub for now and deploys from there to his Vercel
account. It is intended to move into `funhub-ca/funhub-ops` as a module later —
which is why all the data already lives in its own `cert` schema inside the
shared `os-tools` project rather than in app-local tables. Nothing has to be
migrated when it moves; a funhub-ops module can read the same schema.

## Setup

    npm install
    cp .env.example .env      # fill in the anon key
    npm run dev

Server-side secrets (`SUPABASE_SERVICE_ROLE_KEY`, `CERT_SESSION_SECRET`,
`GOOGLE_SERVICE_ACCOUNT_TERMINAL_CERT_JSON`) are set in the Supabase dashboard under
Edge Functions → Secrets. They never go in this repo or in Vercel.
