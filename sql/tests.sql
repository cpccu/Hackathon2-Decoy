-- Run these read-only checks as the Supabase project owner after schema.sql,
-- policies.sql, and seed.sql have completed.

-- Expected: all seven public tables report row_security = true.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'clubs', 'events', 'rsvps', 'departments', 'courses', 'resources')
order by tablename;

-- Expected: the private resources bucket exists (public = false).
select id, name, public
from storage.buckets
where id = 'resources';

-- Expected: these functions exist with the expected signatures.
select
  to_regprocedure('public.rsvp_counts()') as rsvp_counts,
  to_regprocedure('public.check_in_rsvp(uuid)') as check_in_rsvp;

-- Expected: at least 8 clubs, 5 departments, 20 CSE courses, and 10 events.
select 'clubs' as item, count(*) as row_count from public.clubs
union all
select 'departments', count(*) from public.departments
union all
select 'CSE courses', count(*)
  from public.courses c join public.departments d on d.id = c.department_id
  where d.name = 'CSE'
union all
select 'events', count(*) from public.events;

-- Expected: no anonymous table policies, and authenticated policies for each table.
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'clubs', 'events', 'rsvps', 'departments', 'courses', 'resources')
order by tablename, policyname;

-- Complete signup, RLS, RSVP-capacity, and storage checks with authenticated
-- browser sessions as described in docs/BACKEND.md. Do not test these by
-- granting the service_role key to a browser.
