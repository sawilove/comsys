-- C-COMSYS: начальная схема.
-- Закрытая сеть: вход только по инвайту, все права проверяются здесь, в RLS.
-- Расширяемость: profiles.profile (JSON со схемой для карточки в стиле Discord),
-- channels.kind ('voice' под будущие голосовые каналы), messages.kind / attachments
-- (кружки, фото, видео добавятся без переделки таблиц), roles.permissions (флажки).

create extension if not exists pgcrypto;

-- ───────────────────────── Профили ─────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 48),
  avatar_url   text,
  profile      jsonb not null default '{"v":1}'::jsonb,  -- оформление карточки, версионированный JSON
  status       text not null default 'online' check (status in ('online','idle','dnd','invisible')),
  is_admin     boolean not null default false,            -- админ всей сети (инвайты)
  created_at   timestamptz not null default now()
);

-- Профиль создаётся автоматически, когда появляется пользователь в auth.users.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
begin
  insert into public.profiles (id, username, display_name, is_admin)
  values (
    new.id,
    v_username,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), v_username),
    coalesce((new.raw_app_meta_data->>'grants_admin')::boolean, false)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Инвайты в сеть ─────────────────────────
create table public.invites (
  code         text primary key,
  created_by   uuid references public.profiles (id) on delete set null,
  max_uses     int  not null default 1 check (max_uses > 0),
  uses         int  not null default 0,
  grants_admin boolean not null default false,
  expires_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ───────────────────────── Группы, каналы, роли ─────────────────────────
create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('group','dm')),
  name       text check (name is null or char_length(name) between 1 and 64),
  icon_url   text,
  owner_id   uuid references public.profiles (id) on delete set null,
  dm_key     text unique,                -- для личных чатов: 'меньший_uuid:больший_uuid'
  created_at timestamptz not null default now()
);

create table public.channels (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  kind       text not null default 'text' check (kind in ('text','voice')),
  name       text not null check (char_length(name) between 1 and 48),
  position   int  not null default 0,
  created_at timestamptz not null default now()
);
create index on public.channels (group_id);

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  name        text not null,
  color       text,
  position    int  not null default 0,     -- больше = выше в иерархии
  permissions text[] not null default '{}',
  is_default  boolean not null default false  -- роль «все участники»
);
create index on public.roles (group_id);

create table public.members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  nickname  text,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index on public.members (user_id);

create table public.member_roles (
  group_id uuid not null,
  user_id  uuid not null,
  role_id  uuid not null references public.roles (id) on delete cascade,
  primary key (group_id, user_id, role_id),
  foreign key (group_id, user_id) references public.members (group_id, user_id) on delete cascade
);

-- ───────────────────────── Сообщения ─────────────────────────
create table public.messages (
  id          text primary key check (id ~ '^[0-9A-HJKMNP-TV-Z]{26}$'),  -- ULID с клиента: повтор не создаёт дубль
  channel_id  uuid not null references public.channels (id) on delete cascade,
  group_id    uuid not null references public.groups (id) on delete cascade,  -- заполняет триггер
  author_id   uuid not null references public.profiles (id) on delete cascade,
  kind        text not null default 'text' check (kind in ('text','voice')),
  body        text not null default '' check (char_length(body) <= 4000),
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  reply_to    text,
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  deleted_at  timestamptz
);
create index on public.messages (channel_id, created_at desc);
create index on public.messages (created_at);

-- ───────────────────────── Проверки прав ─────────────────────────
create function public.is_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where group_id = p_group and user_id = auth.uid());
$$;

create function public.has_perm(p_group uuid, p_perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups g where g.id = p_group and g.owner_id = auth.uid())
      or exists (
        select 1
        from members m
        join roles r on r.group_id = m.group_id
        where m.group_id = p_group and m.user_id = auth.uid()
          and (r.is_default or exists (select 1 from member_roles mr
                                       where mr.group_id = m.group_id and mr.user_id = m.user_id and mr.role_id = r.id))
          and (p_perm = any (r.permissions) or 'admin' = any (r.permissions))
      );
$$;

create function public.is_network_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- Права роли «все участники» по умолчанию.
create function public.default_permissions() returns text[]
language sql immutable as $$
  select array['send_messages','attach_media','join_voice','use_video','add_reactions','create_invites'];
$$;

-- ───────────────────────── Триггеры сообщений ─────────────────────────
create function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select group_id into new.group_id from channels where id = new.channel_id;
  new.created_at := now();   -- время сервера, а не клиента: от него считается синхронизация
  new.edited_at  := null;
  new.deleted_at := null;
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

create function public.messages_before_update() returns trigger
language plpgsql as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_at := now();
    new.body := '';
    new.attachments := '[]'::jsonb;
  elsif new.body is distinct from old.body then
    if old.deleted_at is not null then raise exception 'message deleted'; end if;
    new.edited_at := now();
  end if;
  return new;
end $$;
create trigger messages_before_update before update on public.messages
  for each row execute function public.messages_before_update();

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles     enable row level security;
alter table public.invites      enable row level security;
alter table public.groups       enable row level security;
alter table public.channels     enable row level security;
alter table public.roles        enable row level security;
alter table public.members      enable row level security;
alter table public.member_roles enable row level security;
alter table public.messages     enable row level security;

-- Сеть закрытая: все её участники видят друг друга, гости не видят ничего.
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (display_name, avatar_url, profile, status) on public.profiles to authenticated;

create policy invites_admin_read on public.invites for select to authenticated
  using (created_by = auth.uid() or public.is_network_admin());

create policy groups_read on public.groups for select to authenticated using (public.is_member(id));
create policy groups_update on public.groups for update to authenticated
  using (kind = 'group' and public.has_perm(id, 'manage_group'));
revoke update on public.groups from authenticated, anon;
grant update (name, icon_url) on public.groups to authenticated;

create policy channels_read on public.channels for select to authenticated using (public.is_member(group_id));
create policy channels_insert on public.channels for insert to authenticated
  with check (public.has_perm(group_id, 'manage_channels')
              and exists (select 1 from groups g where g.id = group_id and g.kind = 'group'));
create policy channels_update on public.channels for update to authenticated
  using (public.has_perm(group_id, 'manage_channels'));
create policy channels_delete on public.channels for delete to authenticated
  using (public.has_perm(group_id, 'manage_channels'));

create policy roles_read on public.roles for select to authenticated using (public.is_member(group_id));
create policy member_roles_read on public.member_roles for select to authenticated using (public.is_member(group_id));

create policy members_read on public.members for select to authenticated using (public.is_member(group_id));
create policy members_update_self on public.members for update to authenticated
  using (user_id = auth.uid());
revoke update on public.members from authenticated, anon;
grant update (nickname) on public.members to authenticated;

create policy messages_read on public.messages for select to authenticated using (public.is_member(group_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_member((select c.group_id from public.channels c where c.id = channel_id))
    and public.has_perm((select c.group_id from public.channels c where c.id = channel_id), 'send_messages')
    and (attachments = '[]'::jsonb
         or public.has_perm((select c.group_id from public.channels c where c.id = channel_id), 'attach_media'))
  );
create policy messages_update_own on public.messages for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
revoke update on public.messages from authenticated, anon;
grant update (body, deleted_at) on public.messages to authenticated;

-- ───────────────────────── Функции (RPC) ─────────────────────────
create function public._add_member(p_group uuid, p_user uuid) returns void
language sql security definer set search_path = public as $$
  insert into members (group_id, user_id) values (p_group, p_user) on conflict do nothing;
$$;
revoke execute on function public._add_member(uuid, uuid) from public, anon, authenticated;

-- Создать группу: роли, канал #общий, голосовой канал, участники.
create function public.create_group(p_name text, p_members uuid[] default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_group uuid;
  v_admin_role uuid;
  v_user uuid;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name required'; end if;

  insert into groups (kind, name, owner_id) values ('group', trim(p_name), v_me) returning id into v_group;

  insert into roles (group_id, name, position, permissions, is_default)
    values (v_group, 'Участник', 0, default_permissions(), true);
  insert into roles (group_id, name, color, position, permissions)
    values (v_group, 'Модератор', '#3ba55d', 50, array['manage_messages','mute_members']);
  insert into roles (group_id, name, color, position, permissions)
    values (v_group, 'Админ', '#e67e22', 100, array['admin']) returning id into v_admin_role;

  insert into channels (group_id, kind, name, position) values
    (v_group, 'text',  'общий',     0),
    (v_group, 'voice', 'Голосовой', 100);

  perform _add_member(v_group, v_me);
  insert into member_roles (group_id, user_id, role_id) values (v_group, v_me, v_admin_role);

  foreach v_user in array coalesce(p_members, '{}') loop
    if v_user <> v_me and exists (select 1 from profiles where id = v_user) then
      perform _add_member(v_group, v_user);
    end if;
  end loop;
  return v_group;
end $$;

-- Открыть (или создать) личный чат.
create function public.open_dm(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_key text;
  v_group uuid;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if p_user = v_me then raise exception 'cannot dm yourself'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'no such user'; end if;
  v_key := least(v_me::text, p_user::text) || ':' || greatest(v_me::text, p_user::text);

  select id into v_group from groups where dm_key = v_key;
  if v_group is not null then return v_group; end if;

  insert into groups (kind, dm_key) values ('dm', v_key)
    on conflict (dm_key) do nothing returning id into v_group;
  if v_group is null then  -- параллельный вызов уже создал
    select id into v_group from groups where dm_key = v_key;
    return v_group;
  end if;
  insert into roles (group_id, name, permissions, is_default) values (v_group, 'Участник', default_permissions(), true);
  insert into channels (group_id, kind, name) values (v_group, 'text', 'чат');
  perform _add_member(v_group, v_me);
  perform _add_member(v_group, p_user);
  return v_group;
end $$;

create function public.add_members(p_group uuid, p_users uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not exists (select 1 from groups where id = p_group and kind = 'group') then raise exception 'not a group'; end if;
  if not has_perm(p_group, 'manage_members') then raise exception 'forbidden'; end if;
  foreach v_user in array p_users loop
    if exists (select 1 from profiles where id = v_user) then perform _add_member(p_group, v_user); end if;
  end loop;
end $$;

create function public.remove_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from groups where id = p_group and owner_id = p_user) then raise exception 'cannot remove owner'; end if;
  if p_user <> auth.uid() and not has_perm(p_group, 'manage_members') then raise exception 'forbidden'; end if;
  if exists (select 1 from groups where id = p_group and kind = 'dm') then raise exception 'cannot leave dm'; end if;
  delete from members where group_id = p_group and user_id = p_user;
end $$;

create function public.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_next uuid;
begin
  if exists (select 1 from groups where id = p_group and kind = 'dm') then raise exception 'cannot leave dm'; end if;
  delete from members where group_id = p_group and user_id = auth.uid();
  if exists (select 1 from groups where id = p_group and owner_id = auth.uid()) then
    select user_id into v_next from members where group_id = p_group order by joined_at limit 1;
    if v_next is null then
      delete from groups where id = p_group;   -- последний вышел
    else
      update groups set owner_id = v_next where id = p_group;
    end if;
  end if;
end $$;

-- Инвайт в сеть. Создают админы сети и (если разрешено) все участники.
create function public.create_invite(p_max_uses int default 1, p_days int default 7) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not is_network_admin() then raise exception 'only network admins can invite'; end if;
  v_code := upper(substr(replace(encode(gen_random_bytes(9), 'base64'), '/', 'x'), 1, 4) || '-' ||
                  substr(replace(encode(gen_random_bytes(9), 'base64'), '/', 'x'), 1, 4));
  v_code := replace(v_code, '+', 'z');
  insert into invites (code, created_by, max_uses, expires_at)
    values (v_code, auth.uid(), greatest(p_max_uses, 1), now() + make_interval(days => greatest(p_days, 1)));
  return v_code;
end $$;

-- Вызывается только Edge Function redeem-invite (через service role).
create function public.claim_invite(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_admin boolean;
begin
  update invites set uses = uses + 1
   where code = upper(trim(p_code)) and uses < max_uses and (expires_at is null or expires_at > now())
  returning grants_admin into v_admin;
  if not found then raise exception 'invalid invite'; end if;
  return v_admin;
end $$;

create function public.release_invite(p_code text) returns void
language sql security definer set search_path = public as $$
  update invites set uses = greatest(uses - 1, 0) where code = upper(trim(p_code));
$$;
revoke execute on function public.claim_invite(text) from public, anon, authenticated;
revoke execute on function public.release_invite(text) from public, anon, authenticated;
grant execute on function public.claim_invite(text) to service_role;
grant execute on function public.release_invite(text) to service_role;

-- ───────────────────────── Realtime ─────────────────────────
-- Realtime уважает RLS: каждый получает только сообщения своих чатов.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.members, public.groups, public.channels;
  end if;
end $$;

-- ───────────────────────── Хранилище медиа (Supabase Storage) ─────────────────────────
-- Путь файла: <group_id>/<channel_id>/<file>. Читать и писать могут только участники группы.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('media', 'media', false, 26214400, array['audio/*','image/*','video/*'])
      on conflict (id) do nothing;

    create policy media_read on storage.objects for select to authenticated
      using (bucket_id = 'media' and public.is_member(((storage.foldername(name))[1])::uuid));
    create policy media_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'media' and public.is_member(((storage.foldername(name))[1])::uuid));
  end if;
end $$;
