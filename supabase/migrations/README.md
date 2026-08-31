These migrations are already applied to the `os-tools` project
(`lbmcstlfubkyooeqkhce`), in this order:

  cert_schema_init             schema, tables, RLS deny-all
  cert_store_code_allow_ho     'HO' is not in public.stores; check instead of FK
  cert_seed_cycle_and_terminals  39 terminals, cycle 2026-H2
  cert_seed_test_folders       166 per-test Drive folder ids
  cert_access_codes_and_storage  bcrypt code helpers + cert-proofs bucket

They are recorded here so the schema is reviewable in git. Pull the live
definitions with `supabase db dump --schema cert` before editing.
