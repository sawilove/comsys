create table public.channel_message_pins (
  message_id text primary key references public.messages (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  active boolean not null default true,
  pinned_at timestamptz not null default statement_timestamp()
);

create index channel_message_pins_by_channel
  on public.channel_message_pins (channel_id, active, pinned_at desc, message_id desc);

alter table public.channel_message_pins enable row level security;
revoke all on public.channel_message_pins from public, anon, authenticated;
grant select on public.channel_message_pins to authenticated;
grant insert (message_id, channel_id, active), update (active) on public.channel_message_pins to authenticated;

create policy pins_read on public.channel_message_pins for select to authenticated
  using (exists (select 1 from public.channels c where c.id = channel_message_pins.channel_id));

create policy pins_add on public.channel_message_pins for insert to authenticated
  with check (exists (
    select 1 from public.messages m
    where m.id = channel_message_pins.message_id
      and m.channel_id = channel_message_pins.channel_id
      and m.deleted_at is null
  ));

create policy pins_change on public.channel_message_pins for update to authenticated
  using (exists (select 1 from public.channels c where c.id = channel_message_pins.channel_id))
  with check (exists (
    select 1 from public.messages m
    where m.id = channel_message_pins.message_id
      and m.channel_id = channel_message_pins.channel_id
      and (not channel_message_pins.active or m.deleted_at is null)
  ));

create function public.refresh_pin_time()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.active and not old.active then
    new.pinned_at := statement_timestamp();
  end if;
  return new;
end;
$$;
revoke execute on function public.refresh_pin_time() from public, anon, authenticated;

create trigger channel_message_pins_refresh_time before update of active on public.channel_message_pins
  for each row execute function public.refresh_pin_time();

create function public.pin_channel_message(p_message text, p_channel uuid)
returns void language sql security invoker set search_path = '' as $$
  insert into public.channel_message_pins (message_id, channel_id)
  values (p_message, p_channel)
  on conflict (message_id) do update set active = true;
$$;
revoke execute on function public.pin_channel_message(text, uuid) from public, anon;
grant execute on function public.pin_channel_message(text, uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.channel_message_pins;
  end if;
end;
$$;
