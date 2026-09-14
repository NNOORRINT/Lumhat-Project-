-- Replace both email values below, then run the entire script once.
-- This works even when the Auth user existed before the profile trigger.

insert into public.profiles (id, display_name, role, preferred_language)
select
  users.id,
  coalesce(
    users.raw_user_meta_data ->> 'display_name',
    split_part(users.email, '@', 1)
  ),
  'admin'::public.user_role,
  'en'
from auth.users as users
where lower(users.email) = lower('replace-with-your-admin@example.com')
on conflict (id) do update
set role = 'admin'::public.user_role;

-- A successful result must show your email and the role "admin".
select users.email, profiles.display_name, profiles.role
from auth.users as users
join public.profiles as profiles on profiles.id = users.id
where lower(users.email) = lower('replace-with-your-admin@example.com');
