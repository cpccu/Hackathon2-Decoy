-- Run these read-only checks as the Supabase project owner after schema.sql,
-- policies.sql, and seed.sql have completed.

-- Expected: all ten application tables report row_security = true.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'admin_invites', 'pending_admin_signups', 'admin_clubs', 'clubs', 'events', 'rsvps', 'departments', 'courses', 'resources')
order by tablename;

-- Expected: the private resources bucket exists (public = false).
select id, name, public
from storage.buckets
where id = 'resources';

-- Expected: these functions exist with the expected signatures.
select
  to_regprocedure('public.rsvp_counts()') as rsvp_counts,
  to_regprocedure('public.check_in_rsvp(uuid)') as check_in_rsvp,
  to_regprocedure('public.create_admin_invite(uuid[],boolean)') as create_admin_invite,
  to_regprocedure('public.can_manage_club(uuid)') as can_manage_club,
  to_regprocedure('public.can_manage_department(uuid)') as can_manage_department,
  to_regprocedure('public.review_resource(uuid,text)') as review_resource,
  to_regprocedure('public.prepare_new_user()') as prepare_new_user;

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

-- Expected: 3 removable demo resources after rerunning seed.sql once the
-- faculty/root profile exists.
select count(*) as demo_resource_count
from public.resources
where title in (
  '[DEMO] Programming Basics Quick Notes',
  '[DEMO] Algorithms Practice Questions',
  '[DEMO] Circuit Analysis Formula Sheet'
);

-- Expected: no anonymous table policies, and authenticated policies for each
-- user-accessible table. Inspect the event read policy and resource read policy
-- for department scoping and approval status. The RSVP insert policy must
-- require the caller's own user_id and a student profile role.
-- admin_invites intentionally has no client table policy.
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'admin_clubs', 'clubs', 'events', 'rsvps', 'departments', 'courses', 'resources')
order by tablename, policyname;

-- Complete signup, RLS, RSVP-capacity, and storage checks with authenticated
-- browser sessions as described in README.md. Do not test these by
-- granting the service_role key to a browser.
