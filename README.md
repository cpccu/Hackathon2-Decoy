# CampusOS

> **Every club. Every note. One place.**  
> Built for City University (CPCCU Hackathon 2)

---

## The Problem

City University students juggle dozens of Facebook groups and Messenger chats — one for each club, one per batch, one per course. Events get missed. Notes are buried in threads. There is no single authoritative place to:

- Find out what's happening on campus
- Share or download academic resources
- Check in to events without a paper list

---

## The Solution & Modules

**CampusOS** replaces scattered chats with one unified platform:

| Module | What it does |
|---|---|
| **Club & Event Engine** | Browse events, student RSVP and QR passes, club-scoped admin event editing, registration lists, and scanner check-in |
| **Resource Hub** | Upload & find notes, question papers, notices by Dept → Sem → Course; student uploads are department-approved |

### Architecture

```
Browser (HTML/CSS/JS)
    │
    ▼
js/api.js  ◄── single gateway, switches between real/mock
    │                │
    ▼                ▼
js/api.real.js   js/api.mock.js
(Supabase)       (in-memory)
    │
    ▼
Supabase (Postgres + Auth + Storage)
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Markup | HTML5, multi-page static site |
| Styling | Tailwind CSS via CDN |
| Logic | Vanilla JS, ES modules |
| Backend | Supabase (Postgres, Auth, Storage) |
| QR generate | qrcode.js CDN |
| QR scan | html5-qrcode CDN |
| Hosting | GitHub Pages |

---

## Live Demo

🌐 **URL:** https://cpccu.github.io/Hackathon2-Decoy/
🎬 **Demo video:** *(link here)*

---

## Local Run Steps

```bash
# 1. Clone the repo
git clone https://github.com/cpccu/Hackathon2-Decoy.git
cd Hackathon2-Decoy

# 2. Set up config
cp js/config.example.js js/config.js
# Edit js/config.js with your SUPABASE_URL and SUPABASE_ANON_KEY
# Set USE_MOCK = false (or keep true for demo mode)

# 3. (Backend) Run SQL in Supabase SQL editor in order:
#    sql/schema.sql  →  sql/policies.sql  →  sql/seed.sql

# 4. Create admin@campusos.test in Supabase Auth, then promote it to faculty/root
#    admin as described in docs/BACKEND.md; rerun sql/seed.sql to add demo resources.
# 5. Create student accounts through the signup page:
#    student1@campusos.test / Student@12345
#    student2@campusos.test / Student@12345
#    Root admins issue club-scoped admin passes from admin.html.
# 6. Serve locally
npx serve .
# or use VS Code Live Server extension
```

> **Note:** Email confirmation is disabled for the hackathon. If your Supabase project has it enabled, go to **Auth → Settings** and disable it.

---

## Seed Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@campusos.test` | `Admin@12345` |
| Student | `student1@campusos.test` | `Student@12345` |
| Student | `student2@campusos.test` | `Student@12345` |

---

## Real-World Student Scenarios

### 1 — Rafi finds his Algorithms midterm
*Rafi is CSE semester 5. He needs last year's midterm paper.*
1. Opens `resources.html`, sets Department → **CSE**, Semester → **3**, Course → **CSE 301 Algorithms**
2. Sees the list instantly. Searches `midterm`.
3. Clicks **Download** — seed examples open directly; uploaded resources use a
   signed, short-lived URL. Done in 10 seconds.

### 2 — Nusrat RSVPs to Cultural Night
*Nusrat sees a Cultural Night event on the feed.*
1. Opens `events.html`, spots the event card.
2. Clicks **See Details** → RSVP page.
3. Taps **🎟️ RSVP Now** → "You're Registered!" toast.
4. Clicks **View My Pass** → sees her QR code, downloads the PNG to her phone.

Club admins can edit the event details or schedule and see the registered
students' names and student IDs on its detail page. Admin accounts cannot RSVP.
Students see events from every department; department admins see only their
department's events, while the faculty/root admin sees them all.

### 3 — Admin checks in at the door
*Admin is standing at the Auditorium entrance with a laptop.*
1. Opens `scan.html`, selects "Cultural Night" from the event dropdown.
2. Clicks **▶ Start** — camera activates.
3. Nusrat shows her QR code → scanner beeps → **✅ Nusrat Jahan checked in!**
4. Counter updates: **1 / 87 checked in**.
5. Re-scan shows: **⚠️ Already checked in 2m ago**.

---

## Project Structure

```
Hackathon2-Decoy/
├── index.html         Sign in / Sign up (site entry page)
├── home.html          Events / Resources chooser
├── events.html        Event feed + filters + admin create/edit
├── event.html         Detail + student RSVP/pass + admin registrant list
├── scan.html          Admin QR scanner
├── admin.html         Admin invite management
├── resources.html     Resource Hub
├── js/
│   ├── config.js      SUPABASE_URL, KEY, USE_MOCK  (public values only)
│   ├── config.example.js
│   ├── app.js         Shared UI: navbar, toast, modal, auth guards
│   ├── api.js         Router → real or mock
│   ├── api.real.js    Supabase implementation
│   ├── api.mock.js    In-memory mock with City University data
│   ├── events.js      (unused direct module — logic inline in HTML)
│   └── resources.js   (unused direct module — logic inline in HTML)
├── sql/
│   ├── schema.sql
│   ├── policies.sql
│   └── seed.sql
├── docs/
│   ├── FRONTEND.md
│   └── BACKEND.md
└── .gitignore
```

---

## Security Notes

- **Only the Supabase anon key** is in `config.js`. It is safe to commit because Supabase Row Level Security (RLS) enforces all permissions server-side.
- The `service_role` key is **never** used in frontend code.
- All user-generated content is passed through `escapeHtml()` before rendering via `innerHTML` — preventing XSS.
- Admin-only actions are enforced by RLS and server-side RPC. Club admins can manage only assigned clubs; faculty/root admins manage all clubs.
- Students see all events; department admins see only events for their profile department. Faculty/root access is controlled by the database `is_super_admin` flag (set for `admin@campusos.test` in the backend setup), not an email check in the frontend.
- Student resource uploads stay pending until an admin for the course department approves them.
- Admin accounts require one-time passes created from the admin page. The database verifies and consumes each pass and does not retain the plaintext code.
- Storage bucket is private. Downloads use short-lived signed URLs (60 s).

---

## Assumptions & Known Limitations

- Email confirmation is assumed **disabled** in Supabase for the hackathon demo.
- The first faculty/root admin must be provisioned by the project owner in Supabase; that account can issue club-scoped invites for additional admins.
- `resources.js` and `events.js` contain JS logic that is inlined directly in the HTML pages for simplicity (no build step). Exported modules exist as scaffolding.
- The mock implementation stores state in memory and `sessionStorage` — data resets on tab close.
- The `seed.sql` does not upload real files to Storage (impossible from SQL). Demo resource downloads in mock mode return a text blob placeholder.
- `scan.html` requires HTTPS for camera access (all major static hosts provide this).


# Frontend Notes — CampusOS

## Pages Overview

| Page | File | Auth | Notes |
|---|---|---|---|
| Sign in / Sign up | `index.html` | No | Site entry page; login/signup tabs and inline validation |
| Admin invitations | `admin.html` | Admin | Create one-time passes scoped to managed clubs; faculty/root admins can invite root admins |
| Home chooser | `home.html` | Yes | Hero and full-card Events/Resources links; no repeated module links in its navbar or footer |
| Events feed | `events.html` | Yes | Students see all departments; admins see their department; admin create/edit/delete |
| Event detail | `event.html?id=` | Yes | Student RSVP/pass; scoped admin registration list with student IDs |
| Scanner | `scan.html` | Admin | Camera + manual entry, counter, history |
| Resource Hub | `resources.html` | Yes | Cascading filters, search, upload, download, delete |

## api.js Function List

See `js/api.js` for the full list. Key functions:

**Auth:** `signUp`, `signIn`, `signOut`, `getSession`, `getProfile`, `createAdminInvite`

**Events:** `listClubs`, `listDepartments`, `getManagedClubIds`, `listEvents`, `getEvent`, `createEvent`, `updateEvent`, `deleteEvent`, `getRsvpCounts`, `getEventRegistrants`, `getMyRsvps`, `getMyRsvpForEvent`, `createRsvp`, `cancelRsvp`, `getEventCheckinStats`, `checkIn`

**Resources:** `listDepartments`, `listCourses`, `listResources`, `uploadResource`, `reviewResource`, `deleteResource`, `getDownloadUrl`

## Switching from Mock to Real Backend

1. Open `js/config.js`
2. Set `USE_MOCK = false`
3. Paste the real `SUPABASE_URL` and `SUPABASE_ANON_KEY`
4. No other code changes needed.

## How to Run Locally

```bash
npx serve .
# or VS Code Live Server
# open http://localhost:3000
```

## Design Decisions

- All Supabase calls are isolated to `api.real.js`. Pages never import from Supabase directly.
- `api.mock.js` uses the same function signatures — switching is zero-cost.
- Navbar renders profile-aware — shows Admin and Scan links only for admins; its logo returns to `home.html`.
- Signup role and club scope are verified by Supabase. The Student/Admin login choice is matched against the authenticated profile, and club-admin actions are restricted by RLS.
- Only student accounts can register for events. Admins assigned to an event's club can view registrant names and student IDs from their signup profiles.
- Events carry a department: students see all events, department admins see events for their profile department, and faculty/root admins see every department.
- Student resource uploads remain pending and private until approved by an admin for the course department. Faculty/root admins can review resources from all departments.
- Toast system uses a singleton DOM node, auto-clears in 4s.
- Modal traps focus, closes on Esc and backdrop click.
- QR pass encodes the RSVP UUID only (not user data) for privacy.
- Upload validates file type and size client-side before hitting storage.

## Assumptions

- `USE_MOCK = false` from the start since real Supabase keys were available.
- Email confirmation is disabled in the Supabase project.
- `scan.html` needs HTTPS for camera (provided by all static hosts).
- JS logic is inlined in HTML files to avoid a build step per the spec.
- Opening the site root shows the sign-in page. After authentication, users land on `home.html`; protected-page redirects return them to their requested page.

## Known Limitations

- No offline support.
- Mock data resets on tab close.
- The QR pass PNG download captures only the QR canvas, not the full pass card.


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

