-- Auto-create a public.profiles row whenever a new auth user is created.
--
-- Fixes: signing in (email/password OR Google OAuth — any provider) created an
-- auth.users row but NO profiles row, so onboarding + account/subscription
-- features had nothing to read. A trigger on auth.users covers every sign-in
-- method. SECURITY DEFINER so it can write profiles from the auth context;
-- wrapped in an exception block so a profile hiccup can never block auth.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.profiles (id, email, display_name)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
    )
    on conflict (id) do nothing;
  exception when others then
    null; -- never block sign-up/sign-in on profile creation failure
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any existing auth users that don't yet have a profile.
insert into public.profiles (id, email, display_name)
select u.id, u.email,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null and u.email is not null
on conflict (id) do nothing;
