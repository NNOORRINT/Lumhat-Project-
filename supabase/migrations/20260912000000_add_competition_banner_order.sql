-- Let administrators pin competition banners and control their public order.

alter table public.competitions
  add column if not exists display_order integer not null default 0,
  add column if not exists is_pinned boolean not null default false;

-- Materialize the built-in banners when an older project still serves them from
-- frontend fallback data. Once inserted, every visible banner can be managed.
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
    raise notice 'No existing competition owner was found; built-in banners were not inserted.';
    return;
  end if;

  insert into public.competitions (
    slug,
    short_code,
    name_en,
    description_en,
    level,
    status,
    created_by
  )
  select seed.slug,
         seed.short_code,
         seed.name_en,
         seed.description_en,
         'intermediate'::public.difficulty_level,
         'published'::public.content_status,
         owner_id
  from (
    values
      (
        'nmo9-category',
        'NMO9',
        'National Olympiad (KHM-9)',
        'Problems selected for Cambodia''s Grade 9 National Mathematical Olympiad.'
      ),
      (
        'nmo12-category',
        'NMO12',
        'National Olympiad (KHM-12)',
        'Problems selected for Cambodia''s Grade 12 National Mathematical Olympiad.'
      ),
      (
        'mo-category',
        'MO',
        'Math Olympiad',
        'International competition practice from Kangaroo, AMC, and similar olympiads.'
      )
  ) as seed(slug, short_code, name_en, description_en)
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

with ranked as (
  select id, (row_number() over (order by created_at, id) - 1)::integer as position
  from public.competitions
)
update public.competitions competition
set display_order = ranked.position
from ranked
where competition.id = ranked.id
  and competition.display_order = 0;

alter table public.competitions
  drop constraint if exists competitions_display_order_check;

alter table public.competitions
  add constraint competitions_display_order_check check (display_order >= 0);

create index if not exists competitions_banner_order_idx
  on public.competitions (status, is_pinned desc, display_order, created_at);
