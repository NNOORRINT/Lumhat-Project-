-- Lumhat production data model for Supabase/PostgreSQL.
-- Run in a new Supabase project's SQL editor, then connect the frontend with
-- VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('student', 'contributor', 'admin');
create type public.content_status as enum ('draft', 'review', 'published');
create type public.difficulty_level as enum ('beginner', 'intermediate', 'advanced');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role public.user_role not null default 'student',
  preferred_language text not null default 'en' check (preferred_language in ('en', 'km')),
  created_at timestamptz not null default now()
);

-- Automatically create a student profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  short_code text not null,
  name_en text not null,
  name_km text,
  description_en text not null default '',
  description_km text,
  level public.difficulty_level not null,
  start_year smallint,
  end_year smallint,
  status public.content_status not null default 'draft',
  display_order integer not null default 0 check (display_order >= 0),
  is_pinned boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  title_en text not null,
  title_km text,
  year smallint,
  problem_number smallint,
  topic text not null,
  tags text[] not null default '{}',
  difficulty public.difficulty_level not null,
  statement_en text not null,
  statement_km text,
  solution_en text not null,
  solution_km text,
  hint_en text,
  hint_km text,
  answer jsonb,
  contest_day smallint check (contest_day in (1, 2)),
  points smallint not null default 1,
  status public.content_status not null default 'draft',
  created_by uuid not null references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every visible category is a competitions row. Problems keep the category's
-- stable ID, so changing its display name or short code never rewrites content.
create unique index problems_competition_year_day_number_key
  on public.problems (
    competition_id,
    year,
    contest_day,
    problem_number
  );

-- Keep older clients compatible while contest_day moves out of answer JSON.
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

create trigger sync_problem_contest_day_before_write
  before insert or update of answer, contest_day on public.problems
  for each row execute function public.sync_problem_contest_day();

create table public.attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  problem_id uuid references public.problems(id) on delete cascade,
  practice_key text,
  response jsonb,
  is_correct boolean,
  elapsed_seconds integer check (elapsed_seconds >= 0),
  attempted_at timestamptz not null default now(),
  check (problem_id is not null or practice_key is not null)
);

create table public.saved_problems (
  user_id uuid not null references public.profiles(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, problem_id)
);

create index problems_discovery_idx on public.problems (competition_id, status, difficulty, topic, year);
create index competitions_banner_order_idx on public.competitions (status, is_pinned desc, display_order, created_at);
create index problems_tags_idx on public.problems using gin (tags);
create index attempts_user_activity_idx on public.attempts (user_id, attempted_at desc);
create index attempts_user_problem_idx on public.attempts (user_id, problem_id, practice_key);

alter table public.profiles enable row level security;
alter table public.competitions enable row level security;
alter table public.problems enable row level security;
alter table public.attempts enable row level security;
alter table public.saved_problems enable row level security;

create policy "published competitions are public" on public.competitions for select using (status = 'published');
create policy "published problems are public" on public.problems for select using (status = 'published');
create policy "users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users manage own attempts" on public.attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own saved problems" on public.saved_problems for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'); $$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "admins manage competitions" on public.competitions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage problems" on public.problems for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins can read profiles" on public.profiles for select to authenticated using (public.is_admin());

-- RLS restricts rows but cannot stop a user from editing the role column on
-- their own row. Grant updates only for normal profile fields.
revoke update on table public.profiles from authenticated;
grant update (display_name, preferred_language) on table public.profiles to authenticated;
