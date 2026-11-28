alter table public.profiles add column is_developer boolean not null default false;
update public.profiles set is_developer = true where username = 'sanders';

alter table public.messages drop constraint messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'voice', 'media'));

create table public.read_receipts (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message_id text not null references public.messages (id) on delete cascade,
  message_at timestamptz not null,
  primary key (channel_id, user_id)
);
create index read_receipts_user_idx on public.read_receipts (user_id);
create index read_receipts_message_idx on public.read_receipts (message_id);
alter table public.read_receipts enable row level security;
revoke all on public.read_receipts from public, anon, authenticated;
grant select, insert, update on public.read_receipts to authenticated;

create policy receipt_read on public.read_receipts for select to authenticated using (
  exists (select 1 from public.channels where id = channel_id and public.is_member(group_id))
);
create policy receipt_insert on public.read_receipts for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.messages m where m.id = message_id and m.channel_id = read_receipts.channel_id and m.created_at = message_at
      and public.is_member(m.group_id)
  )
);
create policy receipt_update on public.read_receipts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.messages m where m.id = message_id and m.channel_id = read_receipts.channel_id and m.created_at = message_at
        and public.is_member(m.group_id)
    )
  );

create function public.mark_message_read(p_message text) returns void
language sql security invoker set search_path = '' as $$
  insert into public.read_receipts as receipt (channel_id, user_id, message_id, message_at)
  select m.channel_id, (select auth.uid()), m.id, m.created_at
  from public.messages m
  where m.id = p_message and (select auth.uid()) is not null and public.is_member(m.group_id)
  on conflict (channel_id, user_id) do update set message_id = excluded.message_id, message_at = excluded.message_at
  where (receipt.message_at, receipt.message_id) < (excluded.message_at, excluded.message_id);
$$;
revoke execute on function public.mark_message_read(text) from public, anon;
grant execute on function public.mark_message_read(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.read_receipts;
  end if;
end;
$$;
