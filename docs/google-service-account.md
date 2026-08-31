# Google service account for the Drive mirror

The app writes proof receipts into the existing `PAYMENT TERMINALS` folder tree.
It authenticates as a service account — a robot Google account with no human
attached, so nothing breaks when someone changes a password or leaves.

## 1. Pick a Google Cloud project

console.cloud.google.com → project dropdown, top left.
Reuse an existing FUNHUB project or create one (call it e.g. `funhub-automation`).

## 2. Turn on the Drive API

APIs & Services → Library → search **Google Drive API** → **Enable**.
Skipping this gives a 403 with "Google Drive API has not been used in project…".

## 3. Create the service account

IAM & Admin → Service Accounts → **Create service account**

- Name: `funhub-cert-drive`
- Skip the "grant this service account access to the project" step — it needs no
  Cloud IAM roles. Its Drive access comes from being shared on the folder.
- Create → Done

## 4. Create a key

Open the service account → **Keys** → Add key → Create new key → **JSON** →
Create. A `.json` file downloads.

**Treat that file as a password.** Do not put it in this repo, in Vercel, or in
a chat. It goes straight into Supabase (step 6).

## 5. Share the Shared Drive with it

Copy the service account email — `funhub-cert-drive@<project>.iam.gserviceaccount.com`.

In Drive, open the **Shared Drive** containing `TECH - DOCUMENTS` →
Manage members → paste the email → role **Content manager** → Send.

Content manager, not Contributor: the job needs to create files and read them back.

## 6. Store the key in Supabase

Supabase dashboard → project `os-tools` → Edge Functions → Secrets → Add new secret

- Name: `GOOGLE_SERVICE_ACCOUNT_TERMINAL_CERT_JSON`
- Value: the entire contents of the JSON file, pasted as one value

The name is scoped to this app on purpose. `os-tools` is a shared project and
other jobs may need their own Google identities later; a generic
`GOOGLE_SERVICE_ACCOUNT_JSON` would be the one somebody overwrites.

## 7. Check it

Run the `drive-sync` function once. A record with a proof should come back with
`drive_file_id` filled in, and the file should appear in that test's folder.

## If it goes wrong

- **403 insufficientFilePermissions** — the service account is not a member of
  the Shared Drive, or is only a Viewer/Commenter.
- **storageQuotaExceeded** — the target folder is in someone's My Drive, not a
  Shared Drive. Service accounts have no quota of their own. Move the folder into
  the Shared Drive.
- **Key creation is blocked** — a Workspace policy can forbid service-account
  keys. A Google admin has to allow it for this project.
