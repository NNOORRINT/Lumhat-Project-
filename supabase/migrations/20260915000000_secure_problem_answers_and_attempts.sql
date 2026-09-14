-- Keep answer keys out of public problem rows and make scored attempts
-- authoritative at the database boundary.

create table if not exists public.problem_secrets (
  problem_id uuid primary key,
  answer jsonb not null default '{}'::jsonb,
  solution_en text,
  solution_km text,
  updated_at timestamptz not null default now(),
  constraint problem_secrets_problem_id_fkey
    foreign key (problem_id)
    references public.problems(id)
    on delete cascade
    deferrable initially deferred
);

alter table public.problem_secrets enable row level security;
revoke all on table public.problem_secrets from anon, authenticated;

-- Older Lumhat databases kept these values only inside answer JSON.
alter table public.problems
  add column if not exists problem_type text not null default 'qcm',
  add column if not exists difficulty_scale smallint not null default 3,
  add column if not exists time_limit_seconds integer not null default 600;
alter table public.problems alter column solution_en drop not null;

update public.problems
set problem_type = case coalesce(answer ->> 'type', 'qcm')
      when 'open_ended' then 'open_ended'
      when 'study' then 'study'
      else 'qcm'
    end,
    difficulty_scale = case
      when coalesce(answer ->> 'difficulty_scale', '') ~ '^[1-5]$'
        then (answer ->> 'difficulty_scale')::smallint
      else difficulty_scale
    end,
    time_limit_seconds = case
      when coalesce(answer ->> 'time_limit_seconds', '') ~ '^[0-9]+$'
        then (answer ->> 'time_limit_seconds')::integer
      else time_limit_seconds
    end;

-- Preserve the complete existing content before sanitizing public rows.
insert into public.problem_secrets (problem_id, answer, solution_en, solution_km)
select id, coalesce(answer, '{}'::jsonb), solution_en, solution_km
from public.problems
where coalesce(answer ->> 'type', problem_type, 'qcm') <> 'study'
on conflict (problem_id) do update
set answer = excluded.answer,
    solution_en = excluded.solution_en,
    solution_km = excluded.solution_km,
    updated_at = now();

create or replace function public.sanitize_problem_answer(source_answer jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case coalesce(source_answer ->> 'type', '')
    when 'open_ended' then source_answer
      - 'accepted_answers'
      - 'accepted_answers_km'
      - 'display_answer'
      - 'display_answer_km'
      - 'solution_image_url'
      - 'solution_image_alt'
    when 'qcm' then source_answer
      - 'correct_index'
      - 'solution_image_url'
      - 'solution_image_alt'
    when 'multiple_choice' then source_answer
      - 'correct_index'
      - 'solution_image_url'
      - 'solution_image_alt'
    else source_answer
  end;
$$;

update public.problems
set answer = public.sanitize_problem_answer(answer),
    solution_en = null,
    solution_km = null
where coalesce(answer ->> 'type', problem_type, 'qcm') <> 'study';

create or replace function public.protect_problem_private_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.answer ->> 'type', new.problem_type, 'qcm') = 'study' then
    delete from public.problem_secrets where problem_id = new.id;
    return new;
  end if;

  insert into public.problem_secrets (
    problem_id,
    answer,
    solution_en,
    solution_km,
    updated_at
  ) values (
    new.id,
    coalesce(new.answer, '{}'::jsonb),
    new.solution_en,
    new.solution_km,
    now()
  )
  on conflict (problem_id) do update
  set answer = excluded.answer,
      solution_en = excluded.solution_en,
      solution_km = excluded.solution_km,
      updated_at = now();

  new.answer := public.sanitize_problem_answer(new.answer);
  new.solution_en := null;
  new.solution_km := null;
  return new;
end;
$$;

drop trigger if exists protect_problem_private_content_before_write on public.problems;
create trigger protect_problem_private_content_before_write
  before insert or update of answer, solution_en, solution_km, problem_type
  on public.problems
  for each row execute function public.protect_problem_private_content();

create table if not exists public.problem_sessions (
  id bigint generated always as identity primary key,
  problem_id uuid not null references public.problems(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  guest_token uuid,
  started_at timestamptz not null default clock_timestamp(),
  failed_attempts smallint not null default 0 check (failed_attempts between 0 and 3),
  completed_at timestamptz,
  check (
    (user_id is not null and guest_token is null)
    or (user_id is null and guest_token is not null)
  )
);

create unique index if not exists problem_sessions_user_problem_key
  on public.problem_sessions (user_id, problem_id)
  where user_id is not null;
create unique index if not exists problem_sessions_guest_problem_key
  on public.problem_sessions (guest_token, problem_id)
  where guest_token is not null;
create index if not exists problem_sessions_guest_cleanup_idx
  on public.problem_sessions (started_at)
  where guest_token is not null;

alter table public.problem_sessions enable row level security;
revoke all on table public.problem_sessions from anon, authenticated;

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

  -- Bound storage used by abandoned anonymous sessions.
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

create or replace function public.normalized_problem_answer(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(btrim(coalesce(value, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.submit_problem_attempt(
  target_problem uuid,
  submitted_response jsonb,
  guest_token uuid default null
)
returns table (
  is_correct boolean,
  tries_used integer,
  elapsed_seconds integer,
  expired boolean,
  revealed_answer jsonb,
  revealed_solution_en text,
  revealed_solution_km text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := (select auth.uid());
  problem_row public.problems%rowtype;
  private_answer jsonb;
  private_solution_en text;
  private_solution_km text;
  session_row public.problem_sessions%rowtype;
  answer_type text;
  submitted_text text;
  answer_is_correct boolean := false;
  answer_is_expired boolean := false;
  should_reveal boolean := false;
  elapsed integer := 0;
  time_limit integer;
begin
  if submitted_response is null or length(submitted_response::text) > 2000 then
    raise exception 'Invalid response.' using errcode = '22023';
  end if;

  select * into problem_row
  from public.problems
  where id = target_problem and status = 'published';

  if not found then
    raise exception 'Problem is unavailable.' using errcode = 'P0001';
  end if;

  select answer, solution_en, solution_km
    into private_answer, private_solution_en, private_solution_km
  from public.problem_secrets
  where problem_id = target_problem;

  if private_answer is null then
    raise exception 'Problem answer is unavailable.' using errcode = 'P0001';
  end if;

  answer_type := coalesce(private_answer ->> 'type', problem_row.problem_type);
  if answer_type = 'study' then
    raise exception 'Problem is unavailable.' using errcode = 'P0001';
  end if;
  time_limit := coalesce(
    nullif(private_answer ->> 'time_limit_seconds', '')::integer,
    problem_row.time_limit_seconds
  );

  if caller_id is not null then
    select * into session_row
    from public.problem_sessions
    where user_id = caller_id and problem_id = target_problem
    for update;
  else
    if guest_token is null then
      raise exception 'Start the problem before submitting.' using errcode = 'P0001';
    end if;
    select * into session_row
    from public.problem_sessions
    where problem_id = target_problem
      and public.problem_sessions.guest_token = submit_problem_attempt.guest_token
    for update;
  end if;

  if not found then
    raise exception 'Start the problem before submitting.' using errcode = 'P0001';
  end if;

  elapsed := greatest(
    0,
    floor(extract(epoch from (clock_timestamp() - session_row.started_at)))::integer
  );
  answer_is_expired := elapsed >= time_limit;

  if answer_type in ('qcm', 'multiple_choice') then
    answer_is_correct := case
      when coalesce(submitted_response ->> 'choice', '') ~ '^[0-9]+$'
        and coalesce(private_answer ->> 'correct_index', '') ~ '^[0-9]+$'
      then (submitted_response ->> 'choice')::integer =
           (private_answer ->> 'correct_index')::integer
      else false
    end;
  elsif answer_type = 'open_ended' then
    submitted_text := public.normalized_problem_answer(submitted_response ->> 'answer');
    if length(submitted_text) > 500 then
      raise exception 'Answer is too long.' using errcode = '22023';
    end if;

    select exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(private_answer -> 'accepted_answers', '[]'::jsonb)
        || coalesce(private_answer -> 'accepted_answers_km', '[]'::jsonb)
      ) accepted(value)
      where public.normalized_problem_answer(accepted.value) = submitted_text
    ) into answer_is_correct;
  else
    raise exception 'Unsupported problem type.' using errcode = 'P0001';
  end if;

  -- A correct answer submitted after the server-side time limit does not count.
  answer_is_correct := answer_is_correct and not answer_is_expired;

  if not answer_is_correct and not answer_is_expired then
    session_row.failed_attempts := least(3, session_row.failed_attempts + 1);
  end if;

  update public.problem_sessions
  set failed_attempts = session_row.failed_attempts,
      completed_at = case
        when answer_is_correct then coalesce(completed_at, clock_timestamp())
        else completed_at
      end
  where id = session_row.id;

  if caller_id is not null then
    insert into public.attempts (
      user_id,
      problem_id,
      response,
      is_correct,
      elapsed_seconds
    ) values (
      caller_id,
      target_problem,
      submitted_response || jsonb_build_object(
        'statement', coalesce(problem_row.statement_en, problem_row.statement_km, ''),
        'topic', problem_row.topic
      ),
      answer_is_correct,
      case when answer_type = 'open_ended' and answer_is_correct then elapsed else null end
    );
  end if;

  should_reveal := answer_is_correct
    or answer_is_expired
    or session_row.failed_attempts >= 3
    or answer_type in ('qcm', 'multiple_choice');

  return query select
    answer_is_correct,
    session_row.failed_attempts::integer,
    elapsed,
    answer_is_expired,
    case when should_reveal then private_answer
      - 'accepted_answers' - 'accepted_answers_km' else null end,
    case when should_reveal then private_solution_en else null end,
    case when should_reveal then private_solution_km else null end;
end;
$$;

revoke all on function public.submit_problem_attempt(uuid, jsonb, uuid) from public;
grant execute on function public.submit_problem_attempt(uuid, jsonb, uuid) to anon, authenticated;

create or replace function public.reveal_problem_solution(
  target_problem uuid,
  guest_token uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := (select auth.uid());
  problem_row public.problems%rowtype;
  session_row public.problem_sessions%rowtype;
  secret_row public.problem_secrets%rowtype;
  elapsed integer;
  time_limit integer;
begin
  select * into problem_row
  from public.problems
  where id = target_problem and status = 'published';
  if not found then
    raise exception 'Problem is unavailable.' using errcode = 'P0001';
  end if;

  select * into secret_row
  from public.problem_secrets
  where problem_id = target_problem;
  if not found then
    raise exception 'Solution is unavailable.' using errcode = 'P0001';
  end if;
  time_limit := coalesce(
    nullif(secret_row.answer ->> 'time_limit_seconds', '')::integer,
    problem_row.time_limit_seconds
  );

  if caller_id is not null then
    select * into session_row from public.problem_sessions
    where user_id = caller_id and problem_id = target_problem;
  else
    select * into session_row from public.problem_sessions
    where problem_id = target_problem
      and public.problem_sessions.guest_token = reveal_problem_solution.guest_token;
  end if;

  if not found then
    raise exception 'Solution is not available yet.' using errcode = '42501';
  end if;

  elapsed := greatest(
    0,
    floor(extract(epoch from (clock_timestamp() - session_row.started_at)))::integer
  );
  if session_row.completed_at is null
    and session_row.failed_attempts < 3
    and elapsed < time_limit then
    raise exception 'Solution is not available yet.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'answer', secret_row.answer - 'accepted_answers' - 'accepted_answers_km',
    'solution_en', secret_row.solution_en,
    'solution_km', secret_row.solution_km
  );
end;
$$;

revoke all on function public.reveal_problem_solution(uuid, uuid) from public;
grant execute on function public.reveal_problem_solution(uuid, uuid) to anon, authenticated;

create or replace function public.get_problem_for_edit(target_problem uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(problem) || jsonb_build_object(
    'answer', coalesce(secret.answer, problem.answer),
    'solution_en', coalesce(secret.solution_en, problem.solution_en),
    'solution_km', coalesce(secret.solution_km, problem.solution_km)
  )
  from public.problems problem
  left join public.problem_secrets secret on secret.problem_id = problem.id
  where problem.id = target_problem and public.is_admin();
$$;

revoke all on function public.get_problem_for_edit(uuid) from public;
grant execute on function public.get_problem_for_edit(uuid) to authenticated;

-- Browsers can read their own activity but can no longer author scored rows.
drop policy if exists "users manage own attempts" on public.attempts;
drop policy if exists "users read own attempts" on public.attempts;
create policy "users read own attempts"
on public.attempts for select to authenticated
using ((select auth.uid()) = user_id);

revoke insert, update, delete on table public.attempts from anon, authenticated;
grant select on table public.attempts to authenticated;

-- Preserve the two unranked built-in exercises without reopening arbitrary
-- writes to the attempts table.
create or replace function public.record_unranked_practice_attempt(
  target_key text,
  submitted_response jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := (select auth.uid());
  answer_is_correct boolean;
begin
  if caller_id is null then
    raise exception 'Sign in to save an attempt.' using errcode = '42501';
  end if;
  if target_key not in (
    'imo-number-theory-demo-001',
    'lumhat-original-number-theory-001'
  ) then
    raise exception 'Unknown practice problem.' using errcode = '22023';
  end if;

  answer_is_correct := coalesce(submitted_response ->> 'choice', '') = '2';
  insert into public.attempts (user_id, practice_key, response, is_correct)
  values (caller_id, target_key, submitted_response, answer_is_correct);
  return answer_is_correct;
end;
$$;

revoke all on function public.record_unranked_practice_attempt(text, jsonb) from public;
grant execute on function public.record_unranked_practice_attempt(text, jsonb) to authenticated;

-- Keep the public leaderboard limited to server-validated rows.
create or replace function public.get_problem_leaderboard(target_problem uuid)
returns table(rank bigint, display_name text, elapsed_seconds integer, completed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with fastest as (
    select a.user_id,
           min(a.elapsed_seconds) as elapsed_seconds,
           min(a.attempted_at) as completed_at
    from public.attempts a
    join public.problems p on p.id = a.problem_id
    join public.problem_secrets secret on secret.problem_id = p.id
    where a.problem_id = target_problem
      and p.status = 'published'
      and secret.answer ->> 'type' = 'open_ended'
      and a.is_correct = true
      and a.elapsed_seconds is not null
    group by a.user_id
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

-- Stop one contributor account from filling the shared diagram bucket.
create or replace function public.can_upload_problem_diagram()
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select public.is_editor() and (
    select count(*) < 100
    from storage.objects
    where bucket_id = 'problem-diagrams'
      and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
$$;

revoke all on function public.can_upload_problem_diagram() from public;
grant execute on function public.can_upload_problem_diagram() to authenticated;

drop policy if exists "contributors upload problem diagrams" on storage.objects;
create policy "contributors upload problem diagrams"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'problem-diagrams'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and public.can_upload_problem_diagram()
);
