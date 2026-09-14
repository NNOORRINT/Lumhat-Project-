-- Run this only if you installed an earlier Lumhat schema.
-- New installations should run schema.sql instead.

drop policy if exists "public profiles are visible" on public.profiles;

alter table public.attempts alter column problem_id drop not null;
alter table public.attempts add column if not exists practice_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'attempts_problem_reference_required'
  ) then
    alter table public.attempts
      add constraint attempts_problem_reference_required
      check (problem_id is not null or practice_key is not null);
  end if;
end $$;

create index if not exists attempts_user_problem_idx
  on public.attempts (user_id, problem_id, practice_key);
