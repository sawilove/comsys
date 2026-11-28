insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-media', 'profile-media', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

create policy profile_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-media'
    and exists (select 1 from public.profiles where id = (select auth.uid()))
  );

create policy profile_media_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.profiles where id = (select auth.uid()))
  );

create policy profile_media_remove on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
    )
  then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;
