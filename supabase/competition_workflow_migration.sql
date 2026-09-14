-- Adds contributor submissions, the three fixed portal tags, QCM/open-ended formats,
-- timed practice, three-try open answers, and per-problem leaderboards.
-- Run once in the Supabase SQL editor after schema.sql.

alter table public.problems alter column competition_id drop not null;
alter table public.problems alter column solution_en drop not null;
alter table public.problems add column if not exists problem_type text not null default 'qcm';
alter table public.problems add column if not exists difficulty_scale smallint not null default 3;
alter table public.problems add column if not exists time_limit_seconds integer not null default 600;

alter table public.problems drop constraint if exists problems_problem_type_check;
alter table public.problems add constraint problems_problem_type_check check (problem_type in ('qcm','open_ended'));
alter table public.problems drop constraint if exists problems_difficulty_scale_check;
alter table public.problems add constraint problems_difficulty_scale_check check (difficulty_scale between 1 and 5);
alter table public.problems drop constraint if exists problems_time_limit_check;
alter table public.problems add constraint problems_time_limit_check check (time_limit_seconds in (300,600,900,1800,3600,5400));
alter table public.problems drop constraint if exists problems_topic_check;
alter table public.problems add constraint problems_topic_check check (topic in ('Number Theory','Geometry','Combinatorics','Algebra')) not valid;

update public.problems
set problem_type = case when answer ->> 'type' = 'open_ended' then 'open_ended' else 'qcm' end;

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('contributor','admin')); $$;

revoke all on function public.is_editor() from public;
grant execute on function public.is_editor() to authenticated;

drop policy if exists "contributors submit problems" on public.problems;
create policy "contributors submit problems" on public.problems for insert to authenticated
with check (public.is_editor() and created_by=(select auth.uid()) and (public.is_admin() or status='review'));
drop policy if exists "contributors read own problems" on public.problems;
create policy "contributors read own problems" on public.problems for select to authenticated
using (created_by=(select auth.uid()) and public.is_editor());

create or replace function public.get_problem_leaderboard(target_problem uuid)
returns table(rank bigint, display_name text, elapsed_seconds integer, completed_at timestamptz)
language sql stable security definer set search_path=public
as $$
  with fastest as (
    select a.user_id, min(a.elapsed_seconds) elapsed_seconds, min(a.attempted_at) completed_at
    from public.attempts a join public.problems p on p.id=a.problem_id
    where a.problem_id=target_problem and p.problem_type='open_ended'
      and a.is_correct=true and a.elapsed_seconds is not null
    group by a.user_id
  )
  select dense_rank() over(order by f.elapsed_seconds), pr.display_name, f.elapsed_seconds, f.completed_at
  from fastest f join public.profiles pr on pr.id=f.user_id
  order by f.elapsed_seconds, f.completed_at limit 100;
$$;

revoke all on function public.get_problem_leaderboard(uuid) from public;
grant execute on function public.get_problem_leaderboard(uuid) to anon, authenticated;

create index if not exists problems_unassigned_idx on public.problems(status,created_at) where competition_id is null;
create index if not exists attempts_open_leaderboard_idx on public.attempts(problem_id,elapsed_seconds) where is_correct=true and elapsed_seconds is not null;
