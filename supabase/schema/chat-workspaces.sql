-- SweetCord chat foundation: private DMs, group DMs, servers, text channels and messages.
-- Apply only to a dedicated SweetCord Supabase project after identity-friends.sql.
-- Before production, copy this reviewed source into a CLI-generated migration.

grant usage on schema private to authenticated;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 48),
  kind text not null check (kind in ('server', 'group')),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_joined
  on public.workspace_members (user_id, joined_at desc);

create table if not exists public.workspace_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (name = lower(name) and name ~ '^[a-z0-9-]{2,40}$'),
  kind text not null default 'text' check (kind in ('text')),
  topic text check (topic is null or char_length(topic) <= 160),
  position integer not null default 0 check (position >= 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create index if not exists workspace_channels_workspace_position
  on public.workspace_channels (workspace_id, position, created_at);

create table if not exists public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  title text check (title is null or char_length(trim(title)) between 1 and 48),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.dm_participants (
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists dm_participants_user_joined
  on public.dm_participants (user_id, joined_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.workspace_channels (id) on delete cascade,
  conversation_id uuid references public.dm_conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000 and length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint messages_one_destination check (
    (channel_id is not null and conversation_id is null)
    or (channel_id is null and conversation_id is not null)
  )
);

create index if not exists messages_channel_created
  on public.messages (channel_id, created_at desc) where channel_id is not null;

create index if not exists messages_conversation_created
  on public.messages (conversation_id, created_at desc) where conversation_id is not null;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_channels enable row level security;
alter table public.dm_conversations enable row level security;
alter table public.dm_participants enable row level security;
alter table public.messages enable row level security;

revoke all on public.workspaces, public.workspace_members, public.workspace_channels,
  public.dm_conversations, public.dm_participants, public.messages from anon, authenticated;


-- Narrow security-definer helpers prevent recursive RLS policies and never accept
-- a caller-supplied user ID: every check is against the authenticated session.
create or replace function private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin')
  );
$$;

create or replace function private.is_dm_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dm_participants dp
    where dp.conversation_id = p_conversation_id and dp.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_read_chat_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.workspace_members mine
      join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = p_profile_id
    )
    or exists (
      select 1
      from public.dm_participants mine
      join public.dm_participants theirs on theirs.conversation_id = mine.conversation_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = p_profile_id
    );
$$;

revoke all on function private.is_workspace_member(uuid) from public, anon;
revoke all on function private.is_workspace_admin(uuid) from public, anon;
revoke all on function private.is_dm_participant(uuid) from public, anon;
revoke all on function private.can_read_chat_profile(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.is_workspace_admin(uuid) to authenticated;
grant execute on function private.is_dm_participant(uuid) to authenticated;
grant execute on function private.can_read_chat_profile(uuid) to authenticated;

-- The existing identity schema only exposes friends and request peers. This
-- additional policy allows basic profiles only within a shared chat/space.
drop policy if exists "profiles_read_chat_peers" on public.profiles;
create policy "profiles_read_chat_peers"
  on public.profiles for select to authenticated
  using (private.can_read_chat_profile(id));

drop policy if exists "workspaces_read_members" on public.workspaces;
create policy "workspaces_read_members"
  on public.workspaces for select to authenticated
  using (private.is_workspace_member(id));

drop policy if exists "workspaces_update_admins" on public.workspaces;
create policy "workspaces_update_admins"
  on public.workspaces for update to authenticated
  using (private.is_workspace_admin(id))
  with check (private.is_workspace_admin(id));

drop policy if exists "workspaces_delete_owner" on public.workspaces;
create policy "workspaces_delete_owner"
  on public.workspaces for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "workspace_members_read_members" on public.workspace_members;
create policy "workspace_members_read_members"
  on public.workspace_members for select to authenticated
  using (private.is_workspace_member(workspace_id));

drop policy if exists "workspace_channels_read_members" on public.workspace_channels;
create policy "workspace_channels_read_members"
  on public.workspace_channels for select to authenticated
  using (private.is_workspace_member(workspace_id));

drop policy if exists "workspace_channels_update_admins" on public.workspace_channels;
create policy "workspace_channels_update_admins"
  on public.workspace_channels for update to authenticated
  using (private.is_workspace_admin(workspace_id))
  with check (private.is_workspace_admin(workspace_id));

drop policy if exists "workspace_channels_delete_admins" on public.workspace_channels;
create policy "workspace_channels_delete_admins"
  on public.workspace_channels for delete to authenticated
  using (private.is_workspace_admin(workspace_id));

drop policy if exists "dm_conversations_read_participants" on public.dm_conversations;
create policy "dm_conversations_read_participants"
  on public.dm_conversations for select to authenticated
  using (private.is_dm_participant(id));

drop policy if exists "dm_participants_read_members" on public.dm_participants;
create policy "dm_participants_read_members"
  on public.dm_participants for select to authenticated
  using (private.is_dm_participant(conversation_id));

drop policy if exists "messages_read_authorized" on public.messages;
create policy "messages_read_authorized"
  on public.messages for select to authenticated
  using (
    (channel_id is not null and exists (
      select 1 from public.workspace_channels c
      where c.id = messages.channel_id and private.is_workspace_member(c.workspace_id)
    ))
    or (conversation_id is not null and private.is_dm_participant(conversation_id))
  );

drop policy if exists "messages_create_authorized" on public.messages;
create policy "messages_create_authorized"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      (channel_id is not null and exists (
        select 1 from public.workspace_channels c
        where c.id = messages.channel_id and c.kind = 'text'
          and private.is_workspace_member(c.workspace_id)
      ))
      or (conversation_id is not null and private.is_dm_participant(conversation_id))
    )
  );

drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own"
  on public.messages for update to authenticated
  using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own"
  on public.messages for delete to authenticated
  using (sender_id = (select auth.uid()));

grant select on public.workspaces, public.workspace_members, public.workspace_channels,
  public.dm_conversations, public.dm_participants to authenticated;
grant select, insert, delete on public.messages to authenticated;
revoke update on public.messages from authenticated;
grant update (content) on public.messages to authenticated;

-- Create a server/group and its first text channel atomically.
create or replace function public.create_workspace(p_name text, p_kind text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_workspace_id uuid;
  channel_name text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 or char_length(trim(p_name)) > 48 then
    raise exception 'Workspace name must be between 2 and 48 characters';
  end if;
  if p_kind is null or p_kind not in ('server', 'group') then
    raise exception 'Unsupported workspace type';
  end if;

  insert into public.workspaces (name, kind, owner_id)
  values (trim(p_name), p_kind, current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role, invited_by)
  values (new_workspace_id, current_user_id, 'owner', current_user_id);

  channel_name := case when p_kind = 'group' then 'chat' else 'general' end;
  insert into public.workspace_channels (workspace_id, name, kind, position, created_by)
  values (new_workspace_id, channel_name, 'text', 0, current_user_id);

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;

-- A workspace can invite only an existing SweetCord friend.
create or replace function public.add_workspace_member(p_workspace_id uuid, p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_id uuid;
  normalized_username text := lower(regexp_replace(trim(coalesce(p_username, '')), '^@', ''));
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.is_workspace_admin(p_workspace_id) then
    raise exception 'Only a workspace owner or admin can invite members' using errcode = '42501';
  end if;
  if normalized_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Enter an exact SweetCord username';
  end if;

  select p.id into target_id from public.profiles p where p.username = normalized_username;
  if target_id is null then
    raise exception 'No SweetCord account matched that username';
  end if;
  if target_id = current_user_id then
    raise exception 'You are already a member of this space';
  end if;
  if not exists (
    select 1 from public.friendships f
    where f.user_low_id = least(current_user_id, target_id)
      and f.user_high_id = greatest(current_user_id, target_id)
  ) then
    raise exception 'You can invite only people on your SweetCord friends list';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, invited_by)
  values (p_workspace_id, target_id, 'member', current_user_id)
  on conflict (workspace_id, user_id) do nothing;
end;
$$;

revoke all on function public.add_workspace_member(uuid, text) from public, anon;
grant execute on function public.add_workspace_member(uuid, text) to authenticated;

create or replace function public.create_workspace_channel(p_workspace_id uuid, p_name text, p_kind text default 'text')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', '-', 'g'));
  new_channel_id uuid;
  next_position integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.is_workspace_admin(p_workspace_id) then
    raise exception 'Only a workspace owner or admin can create channels' using errcode = '42501';
  end if;
  if p_kind <> 'text' then
    raise exception 'Only text channels are available in this build';
  end if;
  if normalized_name !~ '^[a-z0-9-]{2,40}$' then
    raise exception 'Channel name must use 2–40 lowercase letters, numbers or hyphens';
  end if;

  select coalesce(max(c.position), -1) + 1 into next_position
  from public.workspace_channels c where c.workspace_id = p_workspace_id;

  insert into public.workspace_channels (workspace_id, name, kind, position, created_by)
  values (p_workspace_id, normalized_name, 'text', next_position, current_user_id)
  returning id into new_channel_id;

  return new_channel_id;
end;
$$;

revoke all on function public.create_workspace_channel(uuid, text, text) from public, anon;
grant execute on function public.create_workspace_channel(uuid, text, text) to authenticated;

-- One RPC powers both direct and group DMs. Only friends may be added, so
-- guessing a username cannot be used to open unsolicited conversations.
create or replace function public.create_dm_conversation(
  p_kind text,
  p_title text,
  p_usernames text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_usernames text[];
  target_ids uuid[];
  target_id uuid;
  new_conversation_id uuid;
  existing_conversation_id uuid;
  expected_count integer;
  found_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in ('direct', 'group') then
    raise exception 'Unsupported conversation type';
  end if;

  select coalesce(array_agg(distinct lower(regexp_replace(trim(n), '^@', ''))), array[]::text[])
    into normalized_usernames
  from unnest(coalesce(p_usernames, array[]::text[])) as list(n)
  where trim(n) <> '';

  expected_count := cardinality(normalized_usernames);
  if (p_kind = 'direct' and expected_count <> 1) or (p_kind = 'group' and expected_count not between 2 and 8) then
    raise exception 'Direct messages need one friend; group DMs need two to eight friends';
  end if;
  if exists (select 1 from unnest(normalized_usernames) as list(n) where n !~ '^[a-z0-9_]{3,24}$') then
    raise exception 'Enter exact SweetCord usernames';
  end if;

  select count(*), array_agg(p.id)
    into found_count, target_ids
  from public.profiles p
  where p.username = any(normalized_usernames)
    and p.id <> current_user_id;
  if found_count <> expected_count then
    raise exception 'One or more SweetCord usernames could not be found';
  end if;

  if exists (
    select 1 from unnest(target_ids) as target(user_id)
    where not exists (
      select 1 from public.friendships f
      where f.user_low_id = least(current_user_id, target.user_id)
        and f.user_high_id = greatest(current_user_id, target.user_id)
    )
  ) then
    raise exception 'You can message only SweetCord friends. Send a friend request first.';
  end if;

  if p_kind = 'direct' then
    target_id := target_ids[1];
    select c.id into existing_conversation_id
    from public.dm_conversations c
    where c.kind = 'direct'
      and exists (select 1 from public.dm_participants mine where mine.conversation_id = c.id and mine.user_id = current_user_id)
      and exists (select 1 from public.dm_participants theirs where theirs.conversation_id = c.id and theirs.user_id = target_id)
      and (select count(*) from public.dm_participants all_people where all_people.conversation_id = c.id) = 2
    limit 1;
    if existing_conversation_id is not null then
      return existing_conversation_id;
    end if;
  end if;

  insert into public.dm_conversations (kind, title, created_by)
  values (p_kind, case when p_kind = 'group' then nullif(trim(p_title), '') else null end, current_user_id)
  returning id into new_conversation_id;

  insert into public.dm_participants (conversation_id, user_id)
  values (new_conversation_id, current_user_id);

  insert into public.dm_participants (conversation_id, user_id)
  select new_conversation_id, target.user_id from unnest(target_ids) as target(user_id);

  return new_conversation_id;
end;
$$;

revoke all on function public.create_dm_conversation(text, text, text[]) from public, anon;
grant execute on function public.create_dm_conversation(text, text, text[]) to authenticated;

-- Messages update and delete are limited to the sender, even for conversations.
-- Keep newly added messages realtime-enabled when running on Supabase.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      execute 'alter publication supabase_realtime add table public.messages';
    end if;
  end if;
end;
$$;
