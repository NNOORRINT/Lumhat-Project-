-- Treat problem numbers as unique within a contest day, not across the whole year.
-- Existing study problems kept contest_day in answer JSON, so preserve that data.

alter table public.problems
  add column if not exists contest_day smallint;

update public.problems
set contest_day = (answer ->> 'contest_day')::smallint
where contest_day is null
  and answer ->> 'contest_day' in ('1', '2');

alter table public.problems
  drop constraint if exists problems_contest_day_check;

alter table public.problems
  add constraint problems_contest_day_check
  check (contest_day in (1, 2));

alter table public.problems
  drop constraint if exists problems_competition_id_year_problem_number_key;

alter table public.problems
  drop constraint if exists problems_competition_id_year_contest_day_problem_number_key;

alter table public.problems
  add constraint problems_competition_id_year_contest_day_problem_number_key
  unique (competition_id, year, contest_day, problem_number);
