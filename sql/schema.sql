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
  staff_id text,
  department text,
  role text not null default 'student' check (role in ('student', 'admin')),
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists staff_id text;
alter table public.profiles add column if not exists is_super_admin boolean not null default false;

create table if not exists public.admin_invites (
  code_hash text primary key,
  created_by uuid references public.profiles(id) on delete set null,
  redeemed_by uuid unique,
  target_super_admin boolean not null default false,
  club_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);

alter table public.admin_invites add column if not exists target_super_admin boolean not null default false;
alter table public.admin_invites add column if not exists club_ids uuid[] not null default '{}';

alter table public.admin_invites enable row level security;
revoke all on public.admin_invites from public, anon, authenticated;

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

create table if not exists public.admin_clubs (
  admin_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  primary key (admin_id, club_id)
);

create table if not exists public.pending_admin_signups (
  user_id uuid primary key,
  is_super_admin boolean not null,
  club_ids uuid[] not null default '{}'
);

alter table public.pending_admin_signups enable row level security;
revoke all on public.pending_admin_signups from public, anon, authenticated;

create or replace function public.prepare_new_user()
returns trigger
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'requested_role', 'student');
  admin_kind text := new.raw_user_meta_data->>'admin_kind';
  invite_code text := new.raw_user_meta_data->>'admin_invite_code';
  matched_invite text;
  assigned_super_admin boolean;
  assigned_club_ids uuid[];
begin
  if requested_role not in ('student', 'admin') then
    raise exception 'Invalid account type';
  end if;

  if requested_role = 'student'
     and coalesce(new.raw_user_meta_data->>'student_id', '') !~ '^[0-9]{16}$' then
    raise exception 'Student ID must contain exactly 16 digits';
  end if;

  if requested_role = 'admin' then
    if invite_code is null or length(trim(invite_code)) = 0 then
      raise exception 'An admin invite code is required';
    end if;
    if admin_kind = 'teacher'
       and nullif(trim(new.raw_user_meta_data->>'staff_id'), '') is null then
      raise exception 'A teacher/admin ID is required';
    elsif admin_kind = 'senior_student'
       and coalesce(new.raw_user_meta_data->>'student_id', '') !~ '^[0-9]{16}$' then
      raise exception 'Student ID must contain exactly 16 digits for senior-student admins';
    elsif admin_kind is distinct from 'teacher'
      and admin_kind is distinct from 'senior_student' then
      raise exception 'Invalid admin account type';
    end if;

    update public.admin_invites
    set redeemed_by = new.id, redeemed_at = now()
    where code_hash = encode(digest(trim(invite_code), 'sha256'), 'hex')
      and redeemed_by is null
    returning code_hash, target_super_admin, club_ids
    into matched_invite, assigned_super_admin, assigned_club_ids;

    if matched_invite is null then
      raise exception 'Admin invite code is invalid or already used';
    end if;
    if assigned_super_admin and admin_kind is distinct from 'teacher' then
      raise exception 'Faculty/root admin passes are only valid for teacher accounts';
    end if;

    insert into public.pending_admin_signups (user_id, is_super_admin, club_ids)
    values (new.id, assigned_super_admin, assigned_club_ids);
  end if;

  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'admin_invite_code';
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'requested_role', 'student');
  assigned_role text := 'student';
  assigned_super_admin boolean := false;
  assigned_club_ids uuid[] := '{}';
begin
  if requested_role = 'admin' then
    select is_super_admin, club_ids
    into assigned_super_admin, assigned_club_ids
    from public.pending_admin_signups
    where user_id = new.id
    for update;
    if not found then
      raise exception 'Admin invite verification is missing';
    end if;
    assigned_role := 'admin';
  end if;

  insert into public.profiles (id, full_name, student_id, staff_id, department, role, is_super_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Student'),
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'staff_id',
    new.raw_user_meta_data->>'department',
    assigned_role,
    assigned_super_admin
  );

  if assigned_role = 'admin' and not assigned_super_admin then
    insert into public.admin_clubs (admin_id, club_id)
    select new.id, assigned.club_id
    from unnest(assigned_club_ids) as assigned(club_id);
  end if;
  if assigned_role = 'admin' then
    delete from public.pending_admin_signups where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists before_auth_user_created on auth.users;
create trigger before_auth_user_created
before insert on auth.users
for each row execute function public.prepare_new_user();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  department_id uuid,
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

alter table public.events
  add column if not exists department_id uuid references public.departments(id) on delete restrict;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.events'::regclass and conname = 'events_department_id_fkey'
  ) then
    alter table public.events
      add constraint events_department_id_fkey
      foreign key (department_id) references public.departments(id) on delete restrict;
  end if;
end;
$$;

create index if not exists events_department_id_idx on public.events (department_id);

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
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.resources add column if not exists status text not null default 'approved';
alter table public.resources alter column status set default 'pending';
alter table public.resources add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.resources add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.resources'::regclass and conname = 'resources_status_check'
  ) then
    alter table public.resources
      add constraint resources_status_check check (status in ('pending', 'approved', 'rejected'));
  end if;
end;
$$;

create index if not exists events_starts_at_idx on public.events (starts_at);
create index if not exists rsvps_event_id_idx on public.rsvps (event_id);
create index if not exists resources_course_id_idx on public.resources (course_id);
create index if not exists resources_tags_idx on public.resources using gin (tags);
create index if not exists admin_clubs_club_id_idx on public.admin_clubs (club_id);
create index if not exists resources_status_idx on public.resources (status);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = extensions, public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_super_admin
  );
$$;

create or replace function public.can_manage_club(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.admin_clubs
      where admin_id = auth.uid() and club_id = p_club_id
    );
$$;

create or replace function public.can_manage_department(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.profiles p
      join public.departments d on d.name = p.department
      where p.id = auth.uid()
        and p.role = 'admin'
        and d.id = p_department_id
    );
$$;

create or replace function public.create_admin_invite(p_club_ids uuid[] default '{}', p_super_admin boolean default false)
returns text
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  invite_code text;
  is_super_invite boolean := coalesce(p_super_admin, false);
  requested_count integer := cardinality(coalesce(p_club_ids, '{}'::uuid[]));
  manageable_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if is_super_invite and not public.is_super_admin() then
    raise exception 'Only a faculty/root admin can invite a faculty/root admin';
  end if;
  if not is_super_invite and requested_count = 0 then
    raise exception 'Select at least one club for this admin invite';
  end if;
  if not is_super_invite then
    select count(distinct requested.club_id) into manageable_count
    from unnest(coalesce(p_club_ids, '{}'::uuid[])) as requested(club_id)
    where public.can_manage_club(requested.club_id)
      and exists (select 1 from public.clubs where id = requested.club_id);
    if manageable_count <> requested_count then
      raise exception 'You can only assign clubs that you manage';
    end if;
  end if;

  invite_code := encode(gen_random_bytes(16), 'hex');
  insert into public.admin_invites (code_hash, created_by, target_super_admin, club_ids)
  values (
    encode(digest(invite_code, 'sha256'), 'hex'),
    auth.uid(),
    is_super_invite,
    case when is_super_invite then '{}'::uuid[] else p_club_ids end
  );
  return invite_code;
end;
$$;

create or replace function public.prevent_client_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and (new.role is distinct from old.role
       or new.is_super_admin is distinct from old.is_super_admin) then
    raise exception 'Account permissions cannot be changed by a client';
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
  where not public.is_admin()
    or public.can_manage_department(e.department_id)
  group by e.id;
$$;

create or replace function public.set_resource_review_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_admin() then
    new.status := 'approved';
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  else
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists resources_set_review_state on public.resources;
create trigger resources_set_review_state
before insert on public.resources
for each row execute function public.set_resource_review_state();

create or replace function public.review_resource(p_resource_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  resource_department_id uuid;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'Resource status must be approved or rejected';
  end if;

  select c.department_id into resource_department_id
  from public.resources r
  join public.courses c on c.id = r.course_id
  where r.id = p_resource_id;
  if not found then
    raise exception 'Resource not found';
  end if;
  if not public.can_manage_department(resource_department_id) then
    raise exception 'You cannot review resources for this department';
  end if;

  update public.resources
  set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_resource_id;
end;
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
  event_club_id uuid;
  event_department_id uuid;
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
  select e.title, e.club_id, e.department_id into event_title, event_club_id, event_department_id
  from public.events e where e.id = r.event_id;
  if not public.can_manage_club(event_club_id)
     or not public.can_manage_department(event_department_id) then
    return json_build_object('status', 'forbidden');
  end if;

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
