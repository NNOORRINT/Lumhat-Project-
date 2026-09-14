-- Remove a PL/pgSQL name ambiguity in the anonymous-session upsert.

create or replace function public.start_problem_session(
  target_problem uuid,
  guest_token uuid default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := (select auth.uid());
  session_start timestamptz;
  previous_failures smallint := 0;
begin
  if not exists (
    select 1 from public.problems
    where id = target_problem and status = 'published'
  ) then
    raise exception 'Problem is unavailable.' using errcode = 'P0001';
  end if;

  delete from public.problem_sessions
  where user_id is null and started_at < clock_timestamp() - interval '7 days';

  if caller_id is not null then
    select least(3, count(*) filter (where not coalesce(is_correct, false)))::smallint
      into previous_failures
      from public.attempts
      where user_id = caller_id and problem_id = target_problem;

    insert into public.problem_sessions (problem_id, user_id, failed_attempts)
    values (target_problem, caller_id, previous_failures)
    on conflict (user_id, problem_id) where user_id is not null do nothing;

    select started_at into session_start
    from public.problem_sessions
    where user_id = caller_id and problem_id = target_problem;
  else
    if guest_token is null then
      raise exception 'A guest session token is required.' using errcode = 'P0001';
    end if;

    insert into public.problem_sessions (problem_id, guest_token)
    values (target_problem, guest_token)
    on conflict do nothing;

    select started_at into session_start
    from public.problem_sessions
    where problem_id = target_problem
      and public.problem_sessions.guest_token = start_problem_session.guest_token;
  end if;

  if session_start is null then
    raise exception 'Problem session could not be started.' using errcode = 'P0001';
  end if;
  return session_start;
end;
$$;

revoke all on function public.start_problem_session(uuid, uuid) from public;
grant execute on function public.start_problem_session(uuid, uuid) to anon, authenticated;
