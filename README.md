# CampusOS

**CampusOS brings City University events and academic resources into one place.**

Students can discover campus events, RSVP, and access a digital pass. They can
also find or share course materials through a searchable resource hub. Club and
department administrators have the tools to manage events and review resources
within their assigned responsibilities.

## Contents

- [What the application includes](#what-the-application-includes)
- [Technology and architecture](#technology-and-architecture)
- [Run the project locally](#run-the-project-locally)
- [Connect Supabase](#connect-supabase)
- [Roles and access](#roles-and-access)
- [Pages and project layout](#pages-and-project-layout)
- [Verification checklist](#verification-checklist)
- [Security and operational notes](#security-and-operational-notes)
- [Known limitations](#known-limitations)

## What the application includes

### Events

- Browse and filter upcoming, current-week, past, or all events.
- View event details, capacity, and registration counts.
- Students can RSVP and view a QR pass; administrators cannot RSVP.
- Authorized administrators can create and edit events, see attendee names and
  student IDs, and check attendees in using the scanner or manual entry.

### Resource Hub

- Browse resources by department, semester, course, type, title, and tags.
- Upload notes, question papers, and notices.
- Student uploads remain pending until an administrator responsible for the
  course department approves them.
- Download approved uploads using short-lived Supabase Storage links.
- Three small `[DEMO]` text resources are included in the seed script. Their
  original files are in [`demo-resources/`](./demo-resources/).

## Technology and architecture

CampusOS is a static, multi-page web application. It does not run a custom
application server or require a build step.

| Area | Technology |
|---|---|
| Pages | HTML5 |
| Styling | Tailwind CSS CDN |
| Application code | Vanilla JavaScript with ES modules |
| Authentication and database | Supabase Auth and PostgreSQL |
| File storage | Private Supabase Storage bucket |
| QR passes and scanning | `qrcode.js` and `html5-qrcode` |
| Static hosting | GitHub Pages or another static host |

```text
HTML pages
    │
    ├── js/app.js       Shared navigation, UI helpers, and auth guards
    └── js/api.js       Selects the configured data implementation
          ├── js/api.real.js  Supabase Auth, PostgREST, RPC, and Storage
          └── js/api.mock.js  In-memory demo implementation
                                   │
                                   ▼
                         Supabase (real mode only)
```

## Run the project locally

1. Clone the repository and enter its directory:

   ```bash
   git clone https://github.com/cpccu/Hackathon2-Decoy.git
   cd Hackathon2-Decoy
   ```

2. Serve the folder over HTTP. For example:

   ```bash
   npx serve .
   ```

   Or use the VS Code Live Server extension. Open the local address it prints,
   usually `http://localhost:3000` or `http://127.0.0.1:5500`.

   Do not open the HTML files directly with a `file://` URL. The app uses
   JavaScript modules and browser authentication storage that require an HTTP
   origin.

3. Sign in with a configured Supabase account when running in real mode. The
   default project configuration uses the real backend; demo accounts must
   exist in that Supabase project before they can sign in.

## Connect Supabase

The frontend uses the project URL and a **publishable/anon key** in
[`js/config.js`](./js/config.js). These are intended for browser applications;
database permissions must be enforced by Row Level Security (RLS).

Never put a Supabase `service_role` key, database password, or other secret in
frontend code or this repository.

### Database setup

Run these scripts in the Supabase SQL Editor, in order:

1. [`sql/schema.sql`](./sql/schema.sql) — tables, relationships, triggers, and
   database functions.
2. [`sql/policies.sql`](./sql/policies.sql) — RLS and Storage access policies.
3. Create and promote the initial faculty/root administrator as described
   below.
4. [`sql/seed.sql`](./sql/seed.sql) — sample clubs, departments, courses,
   events, and demo resources.
5. [`sql/tests.sql`](./sql/tests.sql) — read-only checks of schema, policies,
   seed data, and demo resource count.

If the Supabase project already contains older `events` or `resources` tables,
review the migration and backup behavior documented in
[`sql/schema.sql`](./sql/schema.sql) before applying it. Do not delete legacy
backup tables unless you have separately confirmed their data is no longer
needed.

### Create the initial administrator

1. In Supabase, disable email confirmation for this demo under **Authentication
   → Providers → Email**.
2. Create `admin@campusos.test` under **Authentication → Users** and enable
   auto-confirm. The schema's Auth trigger creates its profile.
3. Promote that account in the SQL Editor:

   ```sql
   update public.profiles
   set role = 'admin',
       is_super_admin = true,
       full_name = 'CampusOS Admin',
       staff_id = 'ADM001',
       department = 'CSE'
   where id = (
     select id
     from auth.users
     where email = 'admin@campusos.test'
   );
   ```

   Confirm that one profile row was updated. If the update affects zero rows,
   check that the Auth user exists and has a profile before proceeding.

4. Run `sql/seed.sql` after promotion. Its three `[DEMO]` resource records are
   associated with this root administrator. The seed script is safe to rerun.

For a local-only demonstration, the documented starter account is:

| Role | Email | Password |
|---|---|---|
| Faculty/root admin | `admin@campusos.test` | `Admin@12345` |

Create the user in Supabase Auth and set its password to the listed value if
you want to use this account. This is a demo credential only: change it or
remove the account before any public or production use. Students can create
accounts using the signup page. Admin accounts require a one-time invitation.
Student IDs for student and senior-student-admin accounts must contain exactly
16 digits; leading zeroes are preserved as part of the ID.

### Add Supabase credentials to the frontend

Find the project URL and publishable/anon key in **Project Settings → API**.
Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `js/config.js` and ensure
`USE_MOCK` is `false`. The browser must never receive a `service_role` key.

For local development, configure the Supabase Auth site URL and redirect URLs
to include the local address you use. For deployment, add the production
domain as well.

## Roles and access

Permissions are enforced by Supabase RLS and database functions; hiding a
button in the browser is not an authorization boundary.

| Account | Events | RSVP and check-in | Resources |
|---|---|---|---|
| Student | Can view events across departments | Can RSVP to events and use their own pass | Can upload; uploads wait for department approval |
| Department/club admin | Can view events for their department; can manage only assigned clubs and authorized departments | Cannot RSVP; can check in attendees for assigned clubs | Can review resources for their department |
| Faculty/root admin | Can view and manage events across departments and clubs | Cannot RSVP; can check in attendees | Can review all departments and manage resources |

Admin invitations are one-time passes. Club administrators can issue invites
only within their permitted club scope; only faculty/root administrators can
issue a faculty/root invitation. A profile's admin and root privileges cannot
be granted or changed by frontend requests.

## Pages and project layout

| Page or directory | Purpose |
|---|---|
| [`index.html`](./index.html) | Sign in and account creation |
| [`home.html`](./home.html) | Authenticated landing page and module links |
| [`events.html`](./events.html) | Event feed, filters, and authorized event management |
| [`event.html`](./event.html) | Event information, student pass, and authorized attendee list |
| [`scan.html`](./scan.html) | Administrator QR and manual check-in |
| [`admin.html`](./admin.html) | Administrator invitation management |
| [`resources.html`](./resources.html) | Resource search, upload, review, and downloads |
| [`js/`](./js/) | Shared UI, API gateway, real and mock data implementations |
| [`sql/`](./sql/) | Supabase schema, security policies, seed data, and checks |
| [`demo-resources/`](./demo-resources/) | Small original static text files for demo resource records |

### Mock and real API implementations

Pages use `js/api.js` as the data access gateway. It selects either the real
Supabase adapter or the mock adapter using `USE_MOCK` in `js/config.js`. Both
implementations expose matching application operations for authentication,
events, RSVPs, resource upload/review, and downloads.

The mock backend is useful for UI development. It is not a substitute for
testing authorization, persistence, or file storage against Supabase. In real
mode, approved demo text files are served as static site assets; user uploads
remain in the private Storage bucket and use signed links.

## Verification checklist

Run [`sql/tests.sql`](./sql/tests.sql) in the Supabase SQL Editor after the
database scripts. Its demo resource count should be **3** after the root
administrator has been created/promoted and `seed.sql` has been run.

Then sign in through the local app and check:

- Student signup creates a student profile; admin signup requires a valid
  invitation.
- Login rejects a mismatch between the selected account type and profile role.
- Students can see events across departments, while department admins see only
  their department's events and the faculty/root admin sees all.
- Students can RSVP and use their pass; admin accounts cannot RSVP.
- Authorized admins can edit assigned events, view attendee details, and scan
  or manually check in a pass. A second scan reports that the attendee is
  already checked in.
- Resource search and filters work. Student uploads remain pending until the
  appropriate admin approves them; approved files can be downloaded.
- The three `[DEMO]` resources appear, and a demo download opens the matching
  text file.
- Protected pages redirect logged-out users to sign in, then return them to
  their requested page.
- At mobile width, the navbar, event/resource pages, and footer remain usable.

The SQL checks are not a substitute for these authenticated browser checks.
Check Supabase logs for backend failures; do not weaken RLS to hide an
application error.

## Security and operational notes

- RLS is the authority for database access. The publishable/anon key is not a
  secret and must be paired with correct RLS policies.
- The application must never use a `service_role` key in the browser.
- Admin role and club scope are derived from protected invitation records.
- RSVP creation is restricted to student profiles. Check-in is performed by a
  restricted database function; clients cannot directly update RSVP records.
- The `resources` Storage bucket is private. Uploaded files use a path scoped to
  the uploader, and downloads use signed URLs that expire after 60 seconds.
- Student resource uploads are private while pending. Approval is limited to
  an administrator responsible for the course department or the faculty/root
  administrator.
- The `[DEMO]` resource text files are non-sensitive static examples served
  with the site, not private Storage objects. Do not use this mechanism for
  user uploads or private material.
- QR passes encode the RSVP identifier, not a student's personal details.
- The scanner needs a secure browser context for camera access. HTTPS is
  required in deployment; localhost is treated as secure by modern browsers.
- The demo disables email confirmation for ease of testing. Review this and
  other authentication settings before production use.

## Known limitations

- The application has no custom backend server or build pipeline.
- The mock implementation is in-memory and intended only for demonstrations;
  its data is not durable.
- SQL can create resource metadata but cannot upload files. The included demo
  resources use static text assets; test private Storage uploads separately
  through the application.
- Public demo credentials are not suitable for production. Replace them and
  review all Supabase Auth, redirect, and RLS settings before launch.
- The project has not been independently penetration-tested or certified for
  production use.
