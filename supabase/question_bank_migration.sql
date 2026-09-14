-- Use this if an earlier Lumhat schema is already installed.
-- This intentionally removes every existing problem, as requested.

delete from public.problems;

alter table public.problems add column if not exists title_en text;
alter table public.problems add column if not exists title_km text;
alter table public.problems add column if not exists tags text[] not null default '{}';

update public.problems set title_en = 'Untitled problem' where title_en is null;
alter table public.problems alter column title_en set not null;

create index if not exists problems_tags_idx on public.problems using gin (tags);

-- Administrator policies are maintained by admin_permissions_migration.sql.
