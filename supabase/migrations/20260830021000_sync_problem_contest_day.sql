-- Keep the deployed pre-column client compatible during rollout. It stores the
-- contest day in answer JSON, so copy that value before uniqueness is checked.

create or replace function public.sync_problem_contest_day()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.answer ->> 'contest_day' in ('1', '2') then
    new.contest_day := (new.answer ->> 'contest_day')::smallint;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_problem_contest_day_before_write
  on public.problems;

create trigger sync_problem_contest_day_before_write
  before insert or update of answer, contest_day on public.problems
  for each row execute function public.sync_problem_contest_day();
