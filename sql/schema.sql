create extension if not exists "pgcrypto";

-- Preserve the incompatible demo tables before creating the application schema.
-- The copied *_legacy_backup_20261007 tables remain as an additional backup.
do $$
begin
  if to_regclass('public.events_legacy_backup_20261007') is not null then
    alter table public.events_legacy_backup_20261007 enable row level security;
    revoke all on public.events_legacy_backup_20261007 from public, anon, authenticated;
  end if;

  if to_regclass('public.resources_legacy_backup_20261007') is not null then
    alter table public.resources_legacy_backup_20261007 enable row level security;
    revoke all on public.resources_legacy_backup_20261007 from public, anon, authenticated;
  end if;

  if to_regclass('public.events') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'events' and column_name = 'club_name'
     )
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'events' and column_name = 'date_time'
     ) then
    if to_regclass('public.events_legacy_original_20261007') is not null then
      raise exception 'Cannot preserve public.events: events_legacy_original_20261007 already exists';
    end if;
    alter table public.events rename to events_legacy_original_20261007;
    alter table public.events_legacy_original_20261007 enable row level security;
    revoke all on public.events_legacy_original_20261007 from public, anon, authenticated;
  end if;

  if to_regclass('public.resources') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'resources' and column_name = 'course_code'
     )
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'resources' and column_name = 'file_url'
     ) then
    if to_regclass('public.resources_legacy_original_20261007') is not null then
      raise exception 'Cannot preserve public.resources: resources_legacy_original_20261007 already exists';
    end if;
    alter table public.resources rename to resources_legacy_original_20261007;
    alter table public.resources_legacy_original_20261007 enable row level security;
    revoke all on public.resources_legacy_original_20261007 from public, anon, authenticated;
  end if;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  student_id text,
  department text,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, student_id, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Student'),
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'department'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  description text,
  type text not null default 'general'
    check (type in ('workshop', 'seminar', 'competition', 'cultural', 'sports', 'social', 'general')),
  starts_at timestamptz not null,
  venue text not null,
  capacity integer check (capacity is null or capacity > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  semester integer not null check (semester between 1 and 12),
  code text not null,
  title text not null,
  unique (department_id, code)
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('note', 'question', 'notice')),
  tags text[] not null default '{}',
  file_path text not null,
  file_name text,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists rsvps_event_id_idx on public.rsvps (event_id);
create index if not exists resources_course_id_idx on public.resources (course_id);
create index if not exists resources_tags_idx on public.resources using gin (tags);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.prevent_client_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'Profile role cannot be changed by a client';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
before update on public.profiles
for each row execute function public.prevent_client_role_change();

create or replace function public.rsvp_counts()
returns table (event_id uuid, going bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, count(r.id)::bigint
  from public.events e
  left join public.rsvps r on r.event_id = e.id
  group by e.id;
$$;

create or replace function public.check_in_rsvp(p_rsvp_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rsvps%rowtype;
  who text;
  event_title text;
  checked_in_time timestamptz;
begin
  if not public.is_admin() then
    return json_build_object('status', 'forbidden');
  end if;

  select * into r
  from public.rsvps
  where id = p_rsvp_id
  for update;

  if not found then
    return json_build_object('status', 'invalid');
  end if;

  select p.full_name into who from public.profiles p where p.id = r.user_id;
  select e.title into event_title from public.events e where e.id = r.event_id;

  if r.checked_in_at is not null then
    return json_build_object(
      'status', 'already',
      'name', who,
      'event', event_title,
      'event_id', r.event_id,
      'checked_in_at', r.checked_in_at
    );
  end if;

  checked_in_time := now();
  update public.rsvps set checked_in_at = checked_in_time where id = p_rsvp_id;
  return json_build_object(
    'status', 'ok',
    'name', who,
    'event', event_title,
    'event_id', r.event_id,
    'checked_in_at', checked_in_time
  );
end;
$$;

create or replace function public.enforce_event_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_capacity integer;
  current_rsvps bigint;
begin
  select capacity into event_capacity
  from public.events
  where id = new.event_id
  for update;

  if not found then
    raise exception 'Event not found';
  end if;

  if event_capacity is not null then
    select count(*) into current_rsvps
    from public.rsvps
    where event_id = new.event_id;

    if current_rsvps >= event_capacity then
      raise exception 'Event is full';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rsvp_capacity on public.rsvps;
create trigger rsvp_capacity
before insert on public.rsvps
for each row execute function public.enforce_event_capacity();
