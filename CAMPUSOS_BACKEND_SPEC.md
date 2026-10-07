# CampusOS — BACKEND Specification (for Antigravity)

> **Your role:** You are the **backend engineer only**. A teammate is building the frontend (HTML, Tailwind, vanilla JS) on a separate branch and PC. **Do not create or edit any `.html` file or anything in `/js`.** Your job is a **Supabase backend** that exactly matches the **Backend Contract in Section 3**, because the frontend is being written against it right now. Read this whole file first, then build. If you must deviate from the contract, document it in `docs/BACKEND.md` and tell the frontend owner.

---

## 0. Project Summary

**CampusOS** is a unified campus platform for **City University** (hackathon: CPCCU). Two modules must work end-to-end with real database operations:

1. **Club & Event Engine:** event feed, RSVP, QR pass (the QR encodes the RSVP uuid), admin QR check-in.
2. **Resource Hub:** upload notes/papers/notices, Department → Semester → Course hierarchy, keyword/tag search.

### Hard constraints that affect the backend
- Working signup/login on the live deployment (Supabase Auth, email + password).
- **No secrets in the repo.** Never commit a `service_role` key, database password, or JWT secret. Only the public `anon` key and project URL are ever shared with the frontend.
- Real database operations only; seed data must make the app look tailor-made for City University.

---

## 1. Tech Stack

Supabase only: Postgres, Auth (email + password), Storage. Everything is delivered as SQL files plus a short setup doc. No server code, no Node backend.

---

## 2. Files You Own

```text
Hackathon2-Decoy/
├── sql/
│   ├── schema.sql        # extensions, tables, triggers, functions
│   ├── policies.sql      # RLS policies, storage bucket + storage policies
│   ├── seed.sql          # clubs, departments, courses, events
│   └── tests.sql         # manual verification queries (see Section 9)
└── docs/BACKEND.md       # setup steps, seed users, assumptions, handoff notes
```

**Files owned by the frontend teammate (never touch):** all `.html`, everything in `/js`, `docs/FRONTEND.md`.
The root `README.md` is assembled at the end by the frontend owner from `docs/FRONTEND.md` and `docs/BACKEND.md`, so just make `docs/BACKEND.md` complete and copy-pasteable.

---

## 3. Backend Contract (the agreement with the frontend teammate)

The frontend calls exactly these names. Do not rename anything.

### 3.1 Auth
- Supabase Auth, email + password.
- Signup sends metadata: `options.data = { full_name, student_id, department }`. A trigger must create the `profiles` row from it. **Role is always `student` on signup;** the client can never set it.
- **Email confirmation must be disabled** (Auth → Providers → Email → turn off "Confirm email"). Document this in `docs/BACKEND.md`.

### 3.2 Tables

| Table | Columns |
|---|---|
| `profiles` | `id` (= auth.users.id), `full_name`, `student_id`, `department`, `role` (`'student'` or `'admin'`), `created_at` |
| `clubs` | `id`, `name`, `description` |
| `events` | `id`, `club_id`, `title`, `description`, `type`, `starts_at`, `venue`, `capacity` (nullable), `created_by`, `created_at` |
| `rsvps` | `id` (uuid, encoded in the QR), `event_id`, `user_id`, `checked_in_at` (nullable), `created_at`; unique `(event_id, user_id)` |
| `departments` | `id`, `name` |
| `courses` | `id`, `department_id`, `semester` (1 to 12), `code`, `title` |
| `resources` | `id`, `course_id`, `title`, `kind` (`'note'`, `'question'`, `'notice'`), `tags` (text[]), `file_path`, `file_name`, `uploaded_by`, `created_at` |

`events.type` allowed values: `workshop | seminar | competition | cultural | sports | social | general`.

The frontend will use PostgREST joins, so **foreign keys must exist** as declared: `events.club_id → clubs`, `courses.department_id → departments`, `resources.course_id → courses`, `resources.uploaded_by → profiles`, `rsvps.user_id → profiles`, `rsvps.event_id → events`.

### 3.3 Permissions (enforce with RLS)
- All reads require a logged-in user (`authenticated`). The anon role reads nothing.
- **Admin only:** insert/update/delete on `events`, `clubs`, `departments`, `courses`; calling `check_in_rsvp`.
- Students: insert and delete **their own** `rsvps` (delete blocked once checked in); insert and delete **their own** `resources`; admins may delete any resource.
- `rsvps`: a user sees their own rows; admins see all (needed for scanner counters).
- **No direct UPDATE on `rsvps`.** Check-in happens only through the RPC.
- `profiles.role` cannot be changed by the client.

### 3.4 RPC functions
- `rsvp_counts()` returns rows `[{ event_id, going }]` for **all** events (security definer, so students can see counts without seeing other people's RSVP rows).
- `check_in_rsvp(p_rsvp_id uuid)` returns JSON:
  - `{ "status":"ok", "name", "event", "event_id", "checked_in_at" }`
  - `{ "status":"already", "name", "event", "event_id", "checked_in_at" }`
  - `{ "status":"invalid" }` (no such RSVP)
  - `{ "status":"forbidden" }` (caller is not admin)

### 3.5 Errors the frontend expects
- RSVP for a full event: insert fails with a message containing exactly **`Event is full`**.
- Duplicate RSVP: Postgres unique violation, code **`23505`**.

### 3.6 Storage
- **Private** bucket named exactly `resources`.
- Object path format: `<user_id>/<timestamp>-<filename>`. Uploads are allowed only when the first folder segment equals `auth.uid()`.
- Authenticated users can read objects (the frontend uses 60-second signed URLs).
- Users can delete only objects in their own folder (and admins may delete any).

### 3.7 What you must hand to the frontend teammate
1. `SUPABASE_URL`
2. `SUPABASE_ANON_KEY` (the public anon key only)
3. Seed login credentials (Section 7)
4. A note of any deviation from this contract

---

## 4. `sql/schema.sql`

```sql
create extension if not exists "pgcrypto";

-- Profiles (one per auth user)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  student_id text,
  department text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup (role always 'student')
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, student_id, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'department'
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Events module
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  description text,
  type text not null default 'general'
    check (type in ('workshop','seminar','competition','cultural','sports','social','general')),
  starts_at timestamptz not null,
  venue text not null,
  capacity int check (capacity is null or capacity > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- Resource Hub module
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  semester int not null check (semester between 1 and 12),
  code text not null,
  title text not null,
  unique (department_id, code)
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('note','question','notice')),
  tags text[] not null default '{}',
  file_path text not null,
  file_name text,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index on public.events (starts_at);
create index on public.rsvps (event_id);
create index on public.resources (course_id);
create index on public.resources using gin (tags);

-- Admin helper
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Counts for the feed
create or replace function public.rsvp_counts()
returns table (event_id uuid, going bigint)
language sql stable security definer set search_path = public as $$
  select event_id, count(*) from public.rsvps group by event_id;
$$;

-- Admin-only QR check-in
create or replace function public.check_in_rsvp(p_rsvp_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  r record; who text; ev text; ts timestamptz;
begin
  if not public.is_admin() then
    return json_build_object('status','forbidden');
  end if;

  select * into r from public.rsvps where id = p_rsvp_id;
  if not found then
    return json_build_object('status','invalid');
  end if;

  select full_name into who from public.profiles where id = r.user_id;
  select title into ev from public.events where id = r.event_id;

  if r.checked_in_at is not null then
    return json_build_object('status','already','name',who,'event',ev,'event_id',r.event_id,'checked_in_at',r.checked_in_at);
  end if;

  ts := now();
  update public.rsvps set checked_in_at = ts where id = p_rsvp_id;
  return json_build_object('status','ok','name',who,'event',ev,'event_id',r.event_id,'checked_in_at',ts);
end $$;

-- Capacity enforcement (message must contain 'Event is full')
create or replace function public.enforce_capacity()
returns trigger language plpgsql as $$
declare cap int; taken int;
begin
  select capacity into cap from public.events where id = new.event_id for update;
  if cap is not null then
    select count(*) into taken from public.rsvps where event_id = new.event_id;
    if taken >= cap then
      raise exception 'Event is full';
    end if;
  end if;
  return new;
end $$;

create trigger rsvp_capacity before insert on public.rsvps
for each row execute function public.enforce_capacity();
```

## 5. `sql/policies.sql`

```sql
alter table public.profiles    enable row level security;
alter table public.clubs       enable row level security;
alter table public.events      enable row level security;
alter table public.rsvps       enable row level security;
alter table public.departments enable row level security;
alter table public.courses     enable row level security;
alter table public.resources   enable row level security;

-- profiles: any logged-in user can read; update own row only, role frozen
create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- clubs, departments, courses, events: read all, write admin
create policy "clubs read" on public.clubs for select to authenticated using (true);
create policy "clubs admin write" on public.clubs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "departments read" on public.departments for select to authenticated using (true);
create policy "departments admin write" on public.departments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "courses read" on public.courses for select to authenticated using (true);
create policy "courses admin write" on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "events read" on public.events for select to authenticated using (true);
create policy "events admin write" on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- rsvps
create policy "rsvps read own or admin" on public.rsvps for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "rsvps insert own" on public.rsvps for insert to authenticated with check (user_id = auth.uid());
create policy "rsvps delete own" on public.rsvps for delete to authenticated using (user_id = auth.uid() and checked_in_at is null);

-- resources
create policy "resources read" on public.resources for select to authenticated using (true);
create policy "resources insert own" on public.resources for insert to authenticated with check (uploaded_by = auth.uid());
create policy "resources delete own or admin" on public.resources for delete to authenticated using (uploaded_by = auth.uid() or public.is_admin());

-- Storage
insert into storage.buckets (id, name, public) values ('resources','resources', false)
on conflict (id) do nothing;

create policy "resources bucket read" on storage.objects for select to authenticated using (bucket_id = 'resources');
create policy "resources bucket upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "resources bucket delete" on storage.objects for delete to authenticated
  using (bucket_id = 'resources' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
```

Lock the RPCs down (add to `policies.sql`):

```sql
revoke execute on function public.check_in_rsvp(uuid) from public, anon;
revoke execute on function public.rsvp_counts() from public, anon;
grant execute on function public.check_in_rsvp(uuid) to authenticated;
grant execute on function public.rsvp_counts() to authenticated;
```

---

## 6. `sql/seed.sql` (make it feel like City University)

Must be re-runnable (use `on conflict do nothing`).

- **Clubs (8+):** e.g. CU Cultural Club, CU Computer Club, CU Debating Society, CU Robotics Club, CU Photography Club, CU Sports Club, CU Business Club, CU Rotaract Club. (Plausible placeholders; the team may rename.)
- **Departments:** CSE, EEE, BBA, English, Civil Engineering.
- **Courses:** at least 4 per semester for CSE semesters 1 to 5 (e.g. CSE 101 Intro to Programming, CSE 201 Data Structures, CSE 301 Algorithms, CSE 303 Database Systems, CSE 305 Operating Systems), plus a few for EEE and BBA.
- **Events (10+):** a mix of past and upcoming using `now() + interval '3 days'` and `now() - interval '10 days'` so they always look current; varied clubs and types; realistic venues ("Auditorium", "Room 402, Main Building"); include at least one with a small `capacity` (e.g. 5) to demo the "full" state, and one with null capacity.
- **Resources:** `seed.sql` cannot upload files. Either upload 3 to 5 tiny sample PDFs to the bucket through the dashboard and insert matching rows (document this in `docs/BACKEND.md`), or skip resource seeding and tell the frontend owner to upload demo files through the UI.
- `events.created_by` may be set after the admin user exists (use a lookup by email, or leave null).

## 7. Seed Accounts (document the exact creation steps in `docs/BACKEND.md`)

Create through the Supabase dashboard (Authentication → Users → Add user, auto-confirm on), then promote the admin with SQL.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@campusos.test` | `Admin@12345` |
| Student | `student1@campusos.test` | `Student@12345` |
| Student | `student2@campusos.test` | `Student@12345` |

```sql
update public.profiles set role='admin'
where id = (select id from auth.users where email='admin@campusos.test');
```

Because users created in the dashboard have no signup metadata, set `full_name`, `student_id`, and `department` on their profile rows afterward so the pass and uploader names look real.

---

## 8. `docs/BACKEND.md` Must Contain

1. Setup steps in order: create the Supabase project, disable email confirmation, run `schema.sql`, `policies.sql`, `seed.sql`, create the seed users, promote the admin.
2. Where to find `SUPABASE_URL` and the **anon** key (Project Settings → API) and a warning to never share or commit the `service_role` key.
3. Table and RPC reference (can mirror Section 3).
4. Security notes: why the anon key is safe to expose, how RLS protects data, how check-in is restricted to admins.
5. Seed credentials table.
6. Any deviations from the contract, assumptions, and known limitations.

## 9. `sql/tests.sql` (manual verification)

Provide copy-paste queries and a short checklist the backend owner runs before handing off. Verify each as the right role (use the Supabase SQL editor with `set local role authenticated; set local request.jwt.claim.sub = '<user uuid>';`, or test through the frontend/Supabase client):

- [ ] A new signup creates a `profiles` row with role `student`.
- [ ] A student cannot insert an event, set their own role to `admin`, or call `check_in_rsvp` successfully (returns `forbidden`).
- [ ] A student can RSVP once; a second RSVP fails with `23505`.
- [ ] RSVP to a full event fails with a message containing `Event is full`.
- [ ] `rsvp_counts()` returns counts for all events when called by a student.
- [ ] Admin `check_in_rsvp` returns `ok`, then `already`; a random uuid returns `invalid`.
- [ ] A student cannot see other students' RSVP rows; admin can.
- [ ] A student can cancel their own RSVP only before check-in.
- [ ] A student can upload only into their own `<user_id>/` folder and cannot upload into another user's folder.
- [ ] A student can delete only their own resources; admin can delete any.
- [ ] The anon (logged-out) role can read nothing.

---

## 10. Security Checklist

- [ ] RLS is enabled on **every** table; storage bucket is private.
- [ ] No `service_role` key, database password, or JWT secret in the repo or in `docs/`.
- [ ] Role can never be set by the client (trigger forces `student`; update policy freezes `role`).
- [ ] Check-in only via the admin-checking RPC; no direct UPDATE policy on `rsvps`.
- [ ] RPC execute permissions revoked from `anon`.

## 11. Git Workflow (we work on separate PCs)

- Work on branch `backend`. Commit small and often.
- Only touch `/sql/*` and `docs/BACKEND.md`. Never edit `.html` files or `/js`.
- Pull `main` regularly; open a Pull Request into `main` when done.
- The repo must live in the **CPCCU GitHub organization**.

## 12. Execution Order

1. Write `schema.sql`, `policies.sql`, `seed.sql`, `tests.sql`.
2. Create the Supabase project, run the SQL in order, create and promote the seed users.
3. Run the Section 9 checks.
4. Write `docs/BACKEND.md`.
5. **Send the frontend owner `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and seed credentials as soon as the SQL is live,** even before polishing, because they are waiting on it.
6. Help the frontend owner debug any contract mismatch during integration.

## 13. Out of Scope

Any HTML, CSS, or JS; AI features; push notifications; payments; custom server code.

## 14. What to Hand Back

When finished, give a short summary: what was created, the exact manual steps still required (Supabase project creation, email confirmation off, creating users in the dashboard, uploading sample files if any), the URL and anon key delivery plan, and any deviation from the contract.
