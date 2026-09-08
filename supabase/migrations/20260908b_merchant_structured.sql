-- The account's identity is three structured facts — store, processor, POS —
-- not a name somebody typed. The label becomes derived, so it can never drift
-- from what it describes, and every one of them may be blank while an account
-- is still being filled in.
alter table cert.merchant_accounts
  alter column mid        drop not null,
  alter column store_code drop not null,
  alter column processor  drop not null,
  alter column pos        drop not null,
  alter column label      drop not null;

-- Seeded from whatever string happened to be copied onto each terminal, which
-- is not the same as somebody having checked it. Cleared so each one is set
-- deliberately.
update cert.merchant_accounts set mid = null;

-- A MID identifies exactly one merchant account. Enforced here rather than in
-- the page, because the page is not the only thing that can write.
create unique index if not exists merchant_accounts_mid_unique
  on cert.merchant_accounts (mid) where mid is not null;

update cert.merchant_accounts
   set label = nullif(concat_ws(' · ', store_code, processor, pos), '');

-- A terminal can exist before anyone has decided which store it belongs to —
-- a spare in a box at head office is still a terminal. It lands under
-- "Unknown" until someone assigns it, and because scope matching is by
-- store_code, no store is ever asked to test one.
alter table cert.terminals
  alter column store_code drop not null,
  alter column processor  drop not null,
  alter column model      drop not null,
  alter column pos        drop not null;

-- Terminal ids are issued by the server, never typed, so they need a sequence
-- that cannot collide with the ones already in use.
create or replace function cert.next_terminal_id(p_store text)
returns text language plpgsql as $$
declare
  prefix text := coalesce(nullif(trim(p_store), ''), 'UNK');
  n int;
begin
  select coalesce(max((regexp_replace(id, '^' || prefix || '-', ''))::int), 0) + 1
    into n
    from cert.terminals
   where id ~ ('^' || prefix || '-[0-9]+$');
  return prefix || '-' || lpad(n::text, 2, '0');
end $$;
