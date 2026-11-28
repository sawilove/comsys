create table public.user_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_seen_at timestamptz not null,
  last_active_at timestamptz not null,
  check (last_active_at <= last_seen_at)
);

alter table public.user_presence enable row level security;
revoke all on public.user_presence from public, anon, authenticated;
grant select, insert, update on public.user_presence to authenticated;

create policy presence_read on public.user_presence for select to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid())));
create policy presence_insert on public.user_presence for insert to authenticated
  with check (user_id = (select auth.uid()) and last_seen_at <= statement_timestamp());
create policy presence_update on public.user_presence for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and last_seen_at <= statement_timestamp());

create function public.touch_presence(p_active_age_seconds integer)
returns void language sql security invoker set search_path = '' as $$
  insert into public.user_presence as p (user_id, last_seen_at, last_active_at)
  values ((select auth.uid()), statement_timestamp(),
    statement_timestamp() - make_interval(secs => least(greatest(p_active_age_seconds, 0), 86400)))
  on conflict (user_id) do update set
    last_seen_at = greatest(p.last_seen_at, excluded.last_seen_at),
    last_active_at = greatest(p.last_active_at, excluded.last_active_at);
$$;
revoke execute on function public.touch_presence(integer) from public, anon;
grant execute on function public.touch_presence(integer) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.user_presence;
  end if;
end;
$$;
