-- Give every visible competition category its own stable database ID.
-- Renaming a category now updates one competitions row; its problems remain
-- attached through problems.competition_id. The legacy tag is intentionally
-- retained as harmless compatibility metadata.

do $$
declare
  owner_id uuid;
begin
  select created_by
    into owner_id
    from public.competitions
    order by created_at
    limit 1;

  if owner_id is null then
    raise notice 'No existing competition owner was found; category seeds were skipped.';
    return;
  end if;

  insert into public.competitions (
    slug,
    short_code,
    name_en,
    name_km,
    description_en,
    description_km,
    level,
    status,
    created_by
  )
  select seed.slug,
         seed.short_code,
         seed.name_en,
         seed.name_km,
         seed.description_en,
         seed.description_km,
         'intermediate'::public.difficulty_level,
         'published'::public.content_status,
         owner_id
  from (
    values
      (
        'nmo9-category',
        'NMO9',
        'National Olympiad (KHM-9)',
        null::text,
        'Problems selected for Cambodia''s Grade 9 National Mathematical Olympiad.',
        null::text
      ),
      (
        'nmo12-category',
        'NMO12',
        'National Olympiad (KHM-12)',
        null::text,
        'Problems selected for Cambodia''s Grade 12 National Mathematical Olympiad.',
        null::text
      ),
      (
        'mo-category',
        'MO',
        'Math Olympiad',
        null::text,
        'International competition practice from Kangaroo, AMC, and similar olympiads.',
        null::text
      )
  ) as seed(slug, short_code, name_en, name_km, description_en, description_km)
  where not exists (
    select 1
    from public.competitions existing
    where lower(existing.short_code) = lower(seed.short_code)
      and existing.short_code <> 'BANK'
  );
end;
$$;

update public.problems problem
set competition_id = category.id,
    updated_at = now()
from public.competitions category
where category.short_code in ('NMO9', 'NMO12', 'MO')
  and problem.tags @> array[category.short_code]::text[]
  and problem.competition_id is distinct from category.id;

drop index if exists public.problems_competition_category_year_day_number_key;

create unique index if not exists problems_competition_year_day_number_key
  on public.problems (
    competition_id,
    year,
    contest_day,
    problem_number
  );

create index if not exists problems_competition_status_idx
  on public.problems (competition_id, status);

