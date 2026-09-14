-- Run this once in the Supabase SQL editor for an existing Lumhat project.
-- It repairs administrator checks and prevents users from promoting themselves.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admins can read profiles" on public.profiles;
create policy "admins can read profiles"
on public.profiles for select
to authenticated
using (public.is_admin());

drop policy if exists "editors manage competitions" on public.competitions;
drop policy if exists "admins manage competitions" on public.competitions;
create policy "admins manage competitions"
on public.competitions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "editors manage problems" on public.problems;
drop policy if exists "admins manage problems" on public.problems;
create policy "admins manage problems"
on public.problems for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- RLS controls rows, not individual columns. Limit normal users to editable
-- profile fields so only trusted SQL/service-role operations can change roles.
revoke update on table public.profiles from authenticated;
grant update (display_name, preferred_language) on table public.profiles to authenticated;
