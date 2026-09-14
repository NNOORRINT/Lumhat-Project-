-- Creates the public bucket used by the problem editor and limits uploads to
-- authenticated contributors/admins writing inside their own user folder.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'problem-diagrams',
  'problem-diagrams',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "problem diagrams are public" on storage.objects;
create policy "problem diagrams are public"
on storage.objects for select
using (bucket_id = 'problem-diagrams');

drop policy if exists "contributors upload problem diagrams" on storage.objects;
create policy "contributors upload problem diagrams"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'problem-diagrams'
  and public.is_editor()
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "admins delete problem diagrams" on storage.objects;
create policy "admins delete problem diagrams"
on storage.objects for delete to authenticated
using (bucket_id = 'problem-diagrams' and public.is_admin());
