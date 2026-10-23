-- SweetCord identity + friend graph bootstrap schema.
-- Apply only to the dedicated SweetCord Supabase project.
-- Before production, put this reviewed SQL into a CLI-generated migration.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username = lower(username) and username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null
    check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_requests_not_self check (sender_id <> recipient_id)
);

create unique index if not exists friend_requests_one_pending_per_pair
  on public.friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
  where status = 'pending';

create index if not exists friend_requests_recipient_status_created
  on public.friend_requests (recipient_id, status, created_at desc);

create index if not exists friend_requests_sender_status_created
  on public.friend_requests (sender_id, status, created_at desc);

create table if not exists public.friendships (
  user_low_id uuid not null references public.profiles (id) on delete cascade,
  user_high_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low_id, user_high_id),
  constraint friendships_canonical_order check (user_low_id < user_high_id)
);

create index if not exists friendships_high_user
  on public.friendships (user_high_id, user_low_id);

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

revoke all on public.profiles, public.friend_requests, public.friendships from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name) on public.profiles to authenticated;
grant select, insert on public.friend_requests to authenticated;
grant update (status) on public.friend_requests to authenticated;
grant select, delete on public.friendships to authenticated;

drop policy if exists "profiles_read_self_friends_and_request_peers" on public.profiles;
create policy "profiles_read_self_friends_and_request_peers"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.friendships f
      where (f.user_low_id = (select auth.uid()) and f.user_high_id = profiles.id)
         or (f.user_high_id = (select auth.uid()) and f.user_low_id = profiles.id)
    )
    or exists (
      select 1 from public.friend_requests r
      where r.status = 'pending'
        and (
          (r.sender_id = (select auth.uid()) and r.recipient_id = profiles.id)
          or (r.recipient_id = (select auth.uid()) and r.sender_id = profiles.id)
        )
    )
  );

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "friend_requests_read_participants" on public.friend_requests;
create policy "friend_requests_read_participants"
  on public.friend_requests for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

drop policy if exists "friend_requests_create_as_sender" on public.friend_requests;
create policy "friend_requests_create_as_sender"
  on public.friend_requests for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and status = 'pending'
    and not exists (
      select 1 from public.friendships f
      where (f.user_low_id = (select auth.uid()) and f.user_high_id = recipient_id)
         or (f.user_high_id = (select auth.uid()) and f.user_low_id = recipient_id)
    )
  );

drop policy if exists "friend_requests_recipient_can_respond" on public.friend_requests;
create policy "friend_requests_recipient_can_respond"
  on public.friend_requests for update to authenticated
  using (recipient_id = (select auth.uid()) and status = 'pending')
  with check (recipient_id = (select auth.uid()) and status in ('accepted', 'rejected'));

drop policy if exists "friendships_read_participants" on public.friendships;
create policy "friendships_read_participants"
  on public.friendships for select to authenticated
  using (user_low_id = (select auth.uid()) or user_high_id = (select auth.uid()));

drop policy if exists "friendships_remove_self" on public.friendships;
create policy "friendships_remove_self"
  on public.friendships for delete to authenticated
  using (user_low_id = (select auth.uid()) or user_high_id = (select auth.uid()));

-- Provision each profile when Supabase Auth creates a user. Discord metadata
-- differs by provider/version, so use safe fallbacks and generate a username
-- when no valid unique one is supplied.
create or replace function private.handle_new_sweetcord_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  chosen_username text;
  chosen_display_name text;
  avatar_candidate text;
  chosen_avatar_url text;
begin
  requested_username := lower(trim(coalesce(
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'preferred_username',
    new.raw_user_meta_data ->> 'user_name',
    ''
  )));

  chosen_display_name := trim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'global_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'preferred_username',
    ''
  ));

  avatar_candidate := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture'
  );
  if avatar_candidate ~ '^https://[^[:space:]]+$' then
    chosen_avatar_url := left(avatar_candidate, 1024);
  else
    chosen_avatar_url := null;
  end if;

  if requested_username !~ '^[a-z0-9_]{3,24}$'
     or exists (
       select 1 from public.profiles existing
       where existing.username = requested_username and existing.id <> new.id
     ) then
    chosen_username := 'user_' || substring(replace(new.id::text, '-', '') from 1 for 12);
  else
    chosen_username := requested_username;
  end if;

  if chosen_display_name = '' then
    chosen_display_name := chosen_username;
  end if;
  chosen_display_name := substring(chosen_display_name from 1 for 40);

  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, chosen_username, chosen_display_name, chosen_avatar_url)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_sweetcord_user() from public, anon, authenticated;

drop trigger if exists on_sweetcord_auth_user_created on auth.users;
create trigger on_sweetcord_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_sweetcord_user();

create or replace function private.handle_accepted_friend_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into public.friendships (user_low_id, user_high_id)
    values (least(new.sender_id, new.recipient_id), greatest(new.sender_id, new.recipient_id))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.handle_accepted_friend_request() from public, anon, authenticated;

drop trigger if exists on_sweetcord_friend_request_accepted on public.friend_requests;
create trigger on_sweetcord_friend_request_accepted
  after update of status on public.friend_requests
  for each row
  when (old.status is distinct from new.status)
  execute function private.handle_accepted_friend_request();

create or replace function public.find_profile_by_username(p_username text)
returns table (id uuid, username text, display_name text, avatar_url text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  normalized_username := lower(regexp_replace(trim(coalesce(p_username, '')), '^@', ''));
  if normalized_username !~ '^[a-z0-9_]{3,24}$' then
    return;
  end if;

  return query
    select p.id, p.username, p.display_name, p.avatar_url
    from public.profiles p
    where p.username = normalized_username
      and p.id <> (select auth.uid())
    limit 1;
end;
$$;

revoke all on function public.find_profile_by_username(text) from public, anon;
grant execute on function public.find_profile_by_username(text) to authenticated;

-- Keep updates ordered and auditable without exposing unnecessary account fields.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

drop trigger if exists friend_requests_touch_updated_at on public.friend_requests;
create trigger friend_requests_touch_updated_at
  before update on public.friend_requests
  for each row execute function private.touch_updated_at();
