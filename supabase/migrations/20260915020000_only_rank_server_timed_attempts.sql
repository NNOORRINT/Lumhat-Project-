-- Historical attempts predate server-side validation and cannot be proven
-- trustworthy. Keep them in profile activity, but rank only attempts created
-- at the moment a server-controlled problem session was completed.

create or replace function public.get_problem_leaderboard(target_problem uuid)
returns table(rank bigint, display_name text, elapsed_seconds integer, completed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with verified_attempts as (
    select attempt.user_id,
           attempt.elapsed_seconds,
           attempt.attempted_at
    from public.attempts attempt
    join public.problems problem on problem.id = attempt.problem_id
    join public.problem_secrets secret on secret.problem_id = problem.id
    join public.problem_sessions session
      on session.user_id = attempt.user_id
     and session.problem_id = attempt.problem_id
     and session.completed_at is not null
     and attempt.attempted_at between
       session.completed_at - interval '5 seconds'
       and session.completed_at + interval '5 seconds'
     and abs(
       attempt.elapsed_seconds
       - floor(extract(epoch from (session.completed_at - session.started_at)))::integer
     ) <= 2
    where attempt.problem_id = target_problem
      and problem.status = 'published'
      and secret.answer ->> 'type' = 'open_ended'
      and attempt.is_correct = true
      and attempt.elapsed_seconds is not null
  ),
  fastest as (
    select user_id,
           min(elapsed_seconds) as elapsed_seconds,
           min(attempted_at) as completed_at
    from verified_attempts
    group by user_id
  )
  select dense_rank() over (order by fastest.elapsed_seconds),
         profile.display_name,
         fastest.elapsed_seconds,
         fastest.completed_at
  from fastest
  join public.profiles profile on profile.id = fastest.user_id
  order by fastest.elapsed_seconds, fastest.completed_at
  limit 100;
$$;

revoke all on function public.get_problem_leaderboard(uuid) from public;
grant execute on function public.get_problem_leaderboard(uuid) to anon, authenticated;
