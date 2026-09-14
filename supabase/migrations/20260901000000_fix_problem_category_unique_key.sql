-- NMO9 and NMO12 share Lumhat's internal problem-bank competition record.
-- They each have their own contest numbering, so the visible category (the
-- first tag) must participate in the uniqueness key.

begin;

alter table public.problems
  drop constraint if exists problems_competition_id_year_problem_number_key;

alter table public.problems
  drop constraint if exists problems_competition_id_year_contest_day_problem_number_key;

drop index if exists public.problems_competition_category_year_day_number_key;

create unique index problems_competition_category_year_day_number_key
  on public.problems (
    competition_id,
    coalesce(tags[1], ''),
    year,
    contest_day,
    problem_number
  );

commit;
