# CampusOS Backend Setup

CampusOS uses Supabase directly from the browser. There is no separate Node or
custom server. The browser uses the project URL and a public publishable/anon
key; PostgreSQL row-level security (RLS), Auth, and Storage policies enforce
permissions.

## Setup sequence

1. Open the existing Supabase project whose URL starts with
   `vpvloszwcyawknqaydbl`. Keep the project URL and public key in
   `js/config.js`; never put a `service_role` key in browser code or this repo.
2. In Supabase **Authentication → Providers → Email**, turn off email
   confirmation for the hackathon. The frontend can handle confirmation, but
   this project expects immediate signup/login.
3. The existing `events` and `resources` tables use an older schema. Their
   three rows each have already been copied to
   `events_legacy_backup_20261007` and `resources_legacy_backup_20261007`.
   When `sql/schema.sql` detects those old column layouts, it renames the
   originals to `events_legacy_original_20261007` and
   `resources_legacy_original_20261007` and blocks API access to those backups.
   It does not delete those rows.
4. Open **SQL Editor**. Run the entire contents of `sql/schema.sql`, then
   `sql/policies.sql`, then `sql/seed.sql`, in that order. Confirm each query
   completes successfully before proceeding. If a script reports an error, stop
   and share the exact message before running later scripts.
5. Run the read-only checks in `sql/tests.sql`.
6. Create the three demo users using **Authentication → Users → Add user**.
   Enable auto-confirm for each:

   | Role | Email | Password |
   |---|---|---|
   | Admin | `admin@campusos.test` | `Admin@12345` |
   | Student | `student1@campusos.test` | `Student@12345` |
   | Student | `student2@campusos.test` | `Student@12345` |

   These are demo-only credentials. Do not use them for real accounts or reuse
   these passwords elsewhere.
7. In the SQL Editor, promote the demo admin and set friendly profile details:

   ```sql
   update public.profiles
   set role = 'admin', is_super_admin = true, full_name = 'CampusOS Admin',
       staff_id = 'ADM001', department = 'CSE'
   where id = (select id from auth.users where email = 'admin@campusos.test');

   update public.profiles
   set full_name = 'Rafi Ahmed', student_id = 'CSE2201', department = 'CSE'
   where id = (select id from auth.users where email = 'student1@campusos.test');

   update public.profiles
   set full_name = 'Nusrat Jahan', student_id = 'EEE2202', department = 'EEE'
   where id = (select id from auth.users where email = 'student2@campusos.test');
   ```

   Run `sql/seed.sql` once more after this step to create three downloadable
   demo resources attributed to the faculty/root account. The files are small,
   original text examples in `demo-resources/`; the resource rows can be
   removed from the Resource Hub or deleted by their `[DEMO]` titles in SQL.

8. Run the app from a local HTTP server (VS Code Live Server or `npx serve .`),
   not by opening an HTML file directly. Sign in as each demo user and follow
   the smoke checks below.

## Frontend connection

`js/config.js` already has this project's URL and a public `sb_publishable_...`
key, with `USE_MOCK = false`. Supabase publishable keys are designed for client
applications. Keep this key public, and rely on RLS for data protection.

To find the URL and public key in Supabase, open **Project Settings → API** (the
labels may appear under **API Keys** in the current dashboard). Only copy the
Project URL and the publishable/anon key into the frontend. Never copy a
`service_role` or secret key into `js/config.js`, HTML, JavaScript, or a public
repository.

## Database contract

- `profiles` is created automatically for Auth users. Signup always receives
  the `student` role unless a valid, unused admin invite pass is supplied.
  Admins can issue one-time passes from `admin.html`; only the pass hash is
  stored in the database. Senior students use their student ID and the same
  faculty/admin-issued pass. Client-side role changes are blocked.
- The first admin must be promoted by the project owner in Supabase SQL. After
  that, admins can issue passes for additional teachers and senior-student
  admins, scoped to one or more clubs they manage. Faculty/root admins can
  manage all clubs and issue full-access invitations. Admin signup without a
  valid pass is rejected by the Auth trigger.
- The `admin_clubs` table assigns club admins their club scope. Events are also
  assigned to a department: students can browse every event, department admins
  can read events for their profile department, and faculty/root admins can
  read all events. Admin event changes and check-in require both their club and
  department scope. Only student profiles may create RSVPs.
- Resource uploads by students start as pending and are visible only to the
  uploader and admins responsible for the course department. Those admins can
  approve or reject them; approved resources become visible to all signed-in
  users. Faculty/root admins can review every department. Admin uploads for a
  department they manage are published immediately.
- `clubs`, `events`, `rsvps`, `departments`, `courses`, and `resources` match
  the data shapes used by `js/api.real.js`.
- `rsvp_counts()` returns every event, including events with zero RSVPs.
- `review_resource(uuid, text)` lets a department admin or faculty/root admin
  approve or reject a pending resource. Resource status changes are performed
  only through this RPC.
- `check_in_rsvp(uuid)` only permits admins and returns the documented status
  object. There is no direct client update policy for RSVP rows.
- The `resources` Storage bucket is private. Signed download links expire after
  60 seconds; uploads must be in the signed-in user's folder.
- The three `[DEMO]` seed examples are intentionally non-sensitive static files
  served with the site, not objects in the private bucket. Do not use this path
  for private or user-uploaded material.
- Event capacity is serialized by locking the event row during RSVP insertion,
  so simultaneous signups cannot exceed the configured capacity.

## Smoke checks before calling the backend connected

- Sign up a test student in the app; confirm a `profiles` row is created with
  role `student`.
- As an admin, create a one-time pass at `admin.html`; create a teacher admin
  and a senior-student admin for an assigned club with separate passes (using
  either pass a second time must fail).
- Create two club admins with different club assignments; confirm each can
  create/delete events and scan RSVPs only for their assigned club(s). Confirm
  a faculty/root admin can manage both.
- At login, select Student or Admin / Teacher; mismatched account types must be
  rejected without leaving a signed-in session.
- Log in/out and reload; confirm the session survives reload.
- As a student, browse events and departments; register for an event and verify
  the event pass shows the student ID saved during signup. Confirm an admin
  account cannot create a registration.
- As a club admin, edit an event's title, description, type, date/time, venue,
  capacity, and department; confirm another club's admin cannot edit it. Verify
  students can see all departments' events while each department admin sees
  only their own department, and the faculty/root admin sees all events without
  an RSVP control. Open an assigned event and verify its registration list shows
  attendee names and profile student IDs. Confirm a student cannot read another
  attendee's RSVP row.
- Search resources by title and tag. As a student, upload a test file and
  verify it remains hidden from other students until the matching department
  admin approves it; also test rejection. Confirm the faculty/root admin can
  review it across departments.
- RSVP once as a student; verify the feed count and pass. Try a duplicate RSVP
  and a full event. Cancel before check-in.
- As a student, verify the admin scanner is unavailable. Sign in as the admin,
  scan a valid pass twice (expect `ok`, then `already`) and scan a random UUID
  (expect `invalid`).
- Check the Supabase logs if a query fails. Do not weaken RLS to make a UI error
  disappear.

The small-capacity seed event is `Public Speaking Practice` (capacity 1). It
becomes full after one account RSVPs. The three `[DEMO]` resource entries use
downloadable static text examples; upload a test resource through the app to
verify private Storage and signed downloads.

## Known constraints

- `seed.sql` is safe to rerun: it skips existing names, course codes, event
  titles, and demo resource titles. It does not create Auth users.
- The starter credentials are intentionally simple demo credentials. Replace
  or remove them before a public launch.
- The first admin is bootstrapped by the project owner. Further admin invites
  are issued in the admin-only interface; the UI never permits role promotion
  without consuming a valid one-time invite.
- Backend behavior has to be verified against the actual Supabase project using
  the smoke checks above. SQL scripts alone do not prove dashboard Auth
  settings or deployed RLS behavior.
