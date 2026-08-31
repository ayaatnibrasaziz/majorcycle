-- The first-login acknowledgement becomes write-once IN THE DATABASE.
--
-- Owner-approved 2026-08-31, from Layer G audit finding F-034.
--
-- ════════════════════════════════════════════════════════════════════════════
-- What this closes
-- ════════════════════════════════════════════════════════════════════════════
--
-- `acknowledged_disclaimer_at` is a compliance record under locked decisions
-- #23/#24: the moment a person was shown the methodology and the disclaimer.
-- On 2026-08-27 a failed profile read put the onboarding modal in front of an
-- account that had acknowledged on 2026-06-15, and the modal's only button
-- REPLACED the June date with that day's. The original is gone; the value on
-- that row today is a reconstruction, documented as such in architecture.md.
--
-- That was fixed twice in application code (audit F-031, then F-033):
--   · the READ no longer reports an unreadable row as "never agreed"; and
--   · the WRITE reads before writing, refuses on an unreadable row, skips when a
--     date already exists, and carries `.is(..., null)` so two tabs cannot race.
--
-- Both live in TypeScript. `authenticated` holds a column-level UPDATE grant on
-- this column — necessarily, because the server action runs AS the user through
-- the cookie-bound client — and the row policy is `auth.uid() = id`. So until
-- now the rule was enforced only by our own code, and a signed-in reader could
-- rewrite or clear their own acknowledgement straight from the browser console.
--
-- This is the layer underneath. If every check above it fails at once, Postgres
-- still refuses.
--
-- ════════════════════════════════════════════════════════════════════════════
-- Why it exempts the service role, deliberately
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ The threat this addresses is a viewer editing their OWN compliance record.
-- It is not a defence against our own backend, which already holds the keys to
-- everything. Enforcing this against `service_role` would break legitimate
-- writes we depend on — six e2e specs seed a throwaway account's acknowledgement
-- through the admin client so the modal does not overlay the screen under test,
-- and a support or migration script may one day need to correct a row.
--
-- CLAUDE.md 11y is the precedent and the warning: `anon` kept its SELECT because
-- somebody asked which caller each grant actually serves, instead of revoking
-- everything and discovering the answer in production. Same question here, same
-- answer shape.
--
-- ⚠️ The legitimate FIRST write is unaffected in every role: NULL -> a value is
-- allowed. Only a change to an existing value is refused, which is what
-- "write-once" means and all it should mean.

create or replace function public.enforce_acknowledgement_write_once()
returns trigger
language plpgsql
-- Empty search_path: this function touches no table, and a mutable search_path
-- on a SECURITY-adjacent function is exactly what the Supabase linter flags.
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and old.acknowledged_disclaimer_at is not null
     and new.acknowledged_disclaimer_at is distinct from old.acknowledged_disclaimer_at
  then
    raise exception
      'acknowledged_disclaimer_at is write-once and already holds %',
      old.acknowledged_disclaimer_at
      using
        errcode = 'check_violation',
        hint = 'It is a compliance record (locked decisions #23/#24). Re-stamping '
               'it destroys the only evidence of when the reader was shown the '
               'disclaimer. See audit F-031 / F-033 / F-034.';
  end if;
  return new;
end;
$$;

comment on function public.enforce_acknowledgement_write_once() is
  'Refuses any change to a non-null acknowledged_disclaimer_at made by anon or '
  'authenticated. NULL -> value is always allowed; service_role is exempt because '
  'the threat model is a viewer editing their own compliance record, not our own '
  'backend. Audit F-034.';

create trigger profiles_acknowledgement_write_once
  before update on public.profiles
  for each row
  execute function public.enforce_acknowledgement_write_once();
