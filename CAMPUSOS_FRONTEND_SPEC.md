# CampusOS — FRONTEND Specification (for Antigravity)

> **Your role:** You are the **frontend engineer only**. A teammate is building the backend (Supabase database, Auth, RLS, Storage, seed data) on a separate branch and PC. **Do not create or edit anything in `/sql` or `docs/BACKEND.md`.** Build every page against the **Backend Contract in Section 3**, which is the agreed interface between the two of us. Read this whole file first, then build. Where something is unspecified, decide sensibly and record the assumption in `docs/FRONTEND.md`.

> **Implementation update (October 2026):** The entry page now distinguishes student and admin logins, and admin/teacher accounts require a one-time pass with club-specific permissions. The current app files and `docs/FRONTEND.md` are authoritative over the original role assumptions below.

---

## 0. Project Summary

**CampusOS** is a unified campus platform for **City University** (hackathon: CPCCU). It replaces scattered Facebook groups and Messenger chats with one place for **club events** and **academic resources**.

Two modules, both using **real database operations in the final product** (no hardcoded data in production):

1. **Club & Event Engine:** event feed, event detail, RSVP, QR pass, admin QR check-in scanner.
2. **Resource Hub:** upload notes/question papers/notices, Department → Semester → Course hierarchy, keyword/tag search.

### Hard constraints that affect the frontend

- Working **Sign Up / Log In** on a publicly accessible live deployment.
- **No secrets in the repo.** Only the Supabase **anon** public key may appear in frontend code. Never a `service_role` key.
- Mobile responsive (test at 375px width).
- A polished, working platform beats a shaky one with extra features. **Do NOT add AI features.**

---

## 1. Tech Stack (fixed)

| Layer | Choice |
|---|---|
| Markup | HTML5, multi-page static site, no build step |
| Styling | Tailwind CSS via CDN (`https://cdn.tailwindcss.com`) with inline config |
| Logic | Vanilla JavaScript with ES modules (`<script type="module">`) |
| Backend client | `@supabase/supabase-js` v2 via CDN ESM build (e.g. `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm`) |
| QR generate | `qrcode.js` (CDN) |
| QR scan | `html5-qrcode` (CDN) |
| Hosting | Static deploy (Netlify, Vercel, or Cloudflare Pages) |

---

## 2. Files You Own

```text
Hackathon2-Decoy/
├── index.html            # site entry: login / signup
├── home.html             # authenticated Events / Resources chooser
├── events.html
├── event.html            # uses ?id=<event uuid>
├── scan.html             # admin only
├── resources.html
├── js/
│   ├── config.js         # SUPABASE_URL, SUPABASE_ANON_KEY, USE_MOCK
│   ├── config.example.js
│   ├── app.js            # shared UI + auth helpers (navbar, toast, modal, utils)
│   ├── api.js            # THE ONLY file that talks to Supabase (see Section 4)
│   ├── api.mock.js       # in-memory fake of api.js for working before the backend is ready
│   ├── events.js
│   ├── scan.js
│   └── resources.js
├── docs/FRONTEND.md      # your notes, assumptions, how to run, screenshots list
└── .gitignore
```

**Files owned by the backend teammate (never touch):** `/sql/*`, `docs/BACKEND.md`.
**Shared:** root `README.md` is assembled at the end by the frontend owner from `docs/FRONTEND.md` and `docs/BACKEND.md`. For now just create a stub with the section headings from Section 11.

---

## 3. Backend Contract (the agreement with the backend teammate)

The backend teammate is implementing exactly this. Code against it literally: names, columns, and return shapes must match.

### 3.1 Auth
- Supabase Auth, email + password.
- Signup passes profile data in metadata: `supabase.auth.signUp({ email, password, options: { data: { full_name, student_id, department } } })`. A DB trigger creates the `profiles` row. **Role is always `student` on signup;** the client never sends or sets a role.
- Email confirmation is **disabled** for the hackathon. Handle both cases anyway: if `signUp` returns no session, show "Check your email to confirm".

### 3.2 Tables (read via `supabase.from(...)`)

| Table | Columns |
|---|---|
| `profiles` | `id`, `full_name`, `student_id`, `staff_id`, `department`, `role` (`'student'` or `'admin'`), `is_super_admin`, `created_at` |
| `clubs` | `id`, `name`, `description` |
| `events` | `id`, `club_id`, `title`, `description`, `type`, `starts_at`, `venue`, `capacity` (nullable), `created_by`, `created_at` |
| `rsvps` | `id` (uuid, **this is what the QR code encodes**), `event_id`, `user_id`, `checked_in_at` (nullable), `created_at`; unique `(event_id, user_id)` |
| `departments` | `id`, `name` |
| `courses` | `id`, `department_id`, `semester` (1 to 12), `code`, `title` |
| `resources` | `id`, `course_id`, `title`, `kind` (`'note'`, `'question'`, `'notice'`), `tags` (text[]), `file_path`, `file_name`, `uploaded_by`, `created_at` |

`events.type` values: `workshop | seminar | competition | cultural | sports | social | general`.

### 3.3 Permissions the UI should respect (enforced server-side by RLS)
- All reads require a logged-in user.
- Admins can manage events and check-in only for assigned clubs; faculty/root admins manage all clubs.
- Students can insert and delete **their own** `rsvps` (delete blocked after check-in); users can delete their own resources; faculty/root admins can delete any resource. Admins cannot register.
- There is **no** direct UPDATE on `rsvps`. Check-in happens only through the RPC.
- `profiles.role` cannot be changed by the client.

### 3.4 RPC functions (call with `supabase.rpc(name, args)`)
- `rsvp_counts()` returns rows `[{ event_id, going }]`, used for "N going" on the feed.
- `check_in_rsvp({ p_rsvp_id })` returns one JSON object:
  - `{ status: 'ok', name, event, event_id, checked_in_at }`
  - `{ status: 'already', name, event, event_id, checked_in_at }`
  - `{ status: 'invalid' }`
  - `{ status: 'forbidden' }`

### 3.5 Errors to handle
- Inserting an RSVP for a full event fails with a message containing `Event is full`.
- Inserting a duplicate RSVP fails with Postgres code `23505`.
- Show friendly toasts for both.

### 3.6 Storage
- **Private** bucket named `resources`.
- Upload path format: `<user_id>/<timestamp>-<sanitized-filename>` (the first folder segment **must** equal the user's id or the upload is rejected).
- Download via `supabase.storage.from('resources').createSignedUrl(path, 60)`.

### 3.7 What the backend teammate will hand you
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and the seed login credentials. Until then, use mock mode (Section 4). Put real values in `js/config.js` only when received.

---

## 4. Data Layer and Mock Mode (important)

Because the backend will not be ready at the start, structure the code so the frontend works with or without it.

- `js/config.js` exports `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `USE_MOCK` (boolean, **default `true`** until the real keys arrive). Also provide `config.example.js` with placeholders.
- **`js/api.js` is the only file that imports or calls Supabase.** All pages and modules (`app.js`, `events.js`, `scan.js`, `resources.js`) import functions from `api.js` and never call `supabase` directly.
- `api.js` re-exports either the real implementation or `api.mock.js`, depending on `USE_MOCK`.
- Both implementations expose the **same function names and return shapes**:

```text
// auth
signUp({ email, password, full_name, student_id, department }) -> { user, needsConfirmation }
signIn(email, password) -> { user }
signOut()
getSession() -> session | null
getProfile() -> profile | null

// events
listClubs() -> [{id, name, description}]
listEvents({ search, clubId, type, range }) -> [event + { club_name }]   // range: 'upcoming' | 'week' | 'past' | 'all'
getEvent(id) -> event + { club_name }
createEvent(data) -> event          // admin
deleteEvent(id)                     // admin
getRsvpCounts() -> { [event_id]: going }
getMyRsvps() -> [rsvp]              // current user's rsvps
getMyRsvpForEvent(eventId) -> rsvp | null
createRsvp(eventId) -> rsvp         // throws friendly errors for full/duplicate
cancelRsvp(rsvpId)
getEventCheckinStats(eventId) -> { total, checkedIn }   // admin
checkIn(rsvpId) -> { status, name?, event?, event_id?, checked_in_at? }

// resources
listDepartments() -> [{id, name}]
listCourses({ departmentId, semester }) -> [{id, department_id, semester, code, title}]
listResources({ search, departmentId, semester, courseId, kind }) -> [resource + { course_code, course_title, uploader_name }]
uploadResource({ file, title, courseId, kind, tags, onProgress }) -> resource
deleteResource(id)
getDownloadUrl(filePath) -> url
```

- **Mock implementation (`api.mock.js`)**: in-memory arrays preloaded with realistic City University data (8 clubs, 5 departments, CSE courses for semesters 1 to 5, 10+ events spread across past and upcoming, 12+ resources), plus one mock admin (`admin@campusos.test` / `Admin@12345`) and two students. Simulate latency (~300 ms), the RSVP "Event is full" and duplicate errors, and the four `checkIn` statuses. Persist the mock session in `sessionStorage` so refreshes keep you logged in. Mock "downloads" can open a small generated text blob.
- Show a small **"Mock data" badge** in the navbar whenever `USE_MOCK` is true, so nobody mistakes it for the live backend.
- **Real implementation:** translate each function to Supabase calls per the contract. Use joins like `events.select('*, clubs(name)')` and `resources.select('*, courses(code,title), profiles(full_name)')`. Search uses `ilike` on `title` and `tags` overlap (`.overlaps('tags', [...])`) for keywords.
- Switching to the real backend must require **only** editing `config.js` (set `USE_MOCK = false` and paste the URL and key). No other code changes.

---

## 5. Shared UI Module: `js/app.js`

Exports:
- `requireAuth()` redirects to `index.html?next=<current page>` if there is no session.
- `requireAdmin()` redirects non-admins to `events.html` with a toast.
- `renderNavbar()` injects the navbar into `<div id="navbar"></div>` on every page.
- `toast(message, type)` where type is `success | error | info`.
- `openModal(html)` / `closeModal()` (closes on Esc and on backdrop click; traps focus).
- `formatDateTime(iso)`, `formatDate(iso)`, `timeAgo(iso)`, `debounce(fn, ms)`.
- `escapeHtml(str)`: **use for ALL user-generated content** rendered into HTML to prevent XSS.
- `skeletonCards(n)` and `emptyState({icon, title, text, action})` helpers.

Navbar: `CampusOS` logo | Events | Resources | (admin only: Scan) | avatar menu (name, Logout) or Login button. Becomes a hamburger on mobile. Highlight the active page.

---

## 6. Pages and Behavior

### 6.1 `index.html` (Sign In / Sign Up)
The site entry page. Shows the login and signup tabs. After authentication, users go to `home.html` unless they were redirected from another protected page.

### 6.2 `home.html` (Module chooser)
Requires an authenticated session. Shows the CampusOS introduction and the Events and Resources cards, which link directly to those modules.

### 6.3 Authentication behavior
Centered card, Login / Signup panels.
- Login asks for Student or Admin/Teacher and checks the choice against the account's server-side role.
- Signup asks for Student or Teacher/Admin. Student accounts collect a student ID; teacher accounts collect a staff ID; senior-student admins collect a student ID. All admin signups require a one-time invite pass.
- Admin invitation creation is available to current admins at `admin.html`. Club admins may invite admins for clubs they manage; only faculty/root admins may issue full-access invitations.
- Other signup fields: full name, department (select from `listDepartments()`), email, password (min 8), confirm password.
- Inline validation, disabled button + spinner while loading, clear error messages (wrong password, email taken).
- On success redirect to `?next=` or `home.html`. If `needsConfirmation`, show a "check your email" panel.
- If already logged in, redirect away.

### 6.3 `events.html` (Feed)
Requires auth.
- Search box (title), filters **Club**, **Type**, tabs **Upcoming | This week | Past**.
- Cards: date badge, title, club, department, venue, "N going", and an amber **Registered** chip if the user has an RSVP. Students see all events; admins see events for their profile department; faculty/root sees all.
- Skeletons while loading, friendly empty state, responsive grid (1 column on mobile, 2 on `md`, 3 on `lg`).
- **Admin only:** "+ New Event" button opens a modal form (club, department, title, description, type, date/time, venue, capacity optional) with validation. Admins assigned to an event's club and department also see edit and delete controls on cards. Editing can change event details, department, and schedule but cannot move the event to another club.

### 6.4 `event.html?id=...` (Detail)
- Banner with title + club, info rows (date/time, venue, host club, seats left or "Unlimited"), description.
- Sticky bottom-on-mobile **RSVP** button. After RSVP it becomes **View my pass**, plus a **Cancel RSVP** link (hidden once checked in).
- Only students can register. No admin account has RSVP controls. Admins assigned to the event's club see the attendee list with names and student IDs populated from their signup profiles instead of RSVP controls.
- Student resource uploads remain pending until an admin for that course department approves them.
- Handle "Event is full" and duplicate gracefully. Show a "Full" state if no seats are left. Disable RSVP for past events.
- **Pass modal:** QR code encoding **only the RSVP uuid**, event name, student name, student ID, and a status chip (**Valid** / **Checked in**). Include a "Download pass (PNG)" button.
- Invalid or missing `id` shows a not-found state.

### 6.5 `scan.html` (Admin scanner)
`requireAdmin()`.
- Event dropdown (upcoming and recent events), live camera with `html5-qrcode` (prefer the back camera), start/stop button, camera-permission-denied message.
- On scan, call `checkIn(rsvpId)`; debounce so the same code is not processed repeatedly within 3 seconds.
- Large result panel: **green** "✓ {name} checked in", **amber** "Already checked in {timeAgo}", **red** "Invalid pass", **red** "Not authorized" for `forbidden`. Warn if the pass's `event_id` differs from the selected event.
- Live counter "X / Y checked in" (via `getEventCheckinStats`, refreshed after each scan) and a session-only recent-scans list.
- **Manual-entry fallback:** text input for an RSVP uuid plus a Check in button, for when the camera fails during the demo.

### 6.6 `resources.html` (Hub)
Requires auth.
- Cascading filters **Department → Semester (1 to 12) → Course**, plus **Type**. Breadcrumb like `CSE › Semester 5 › CSE 301 Algorithms`. A "Clear filters" button.
- Search box matching title and tags (comma or space separated keywords), debounced 300 ms.
- Rows: icon by kind, title, tag chips (clicking a chip adds it to the search), course code, uploader name, relative date, **Download** (signed URL), **Delete** (only own uploads or admin, with confirm).
- **Upload modal:** title, department → semester → course cascading selects, kind, tags (comma-separated), file input (PDF, images, DOC/DOCX, PPT/PPTX; max 20 MB; validate client-side), progress indication, disabled submit while uploading.
- Mobile: filters collapse into a "Filters" drawer.

---

## 7. Design System

Put this Tailwind config in every `<head>` (placeholder brand colors, so keep them centralized and easy to swap):

```js
tailwind.config = { theme: { extend: {
  colors: {
    brand: { 50:'#eef4ff', 500:'#2563eb', 600:'#1d4ed8', 700:'#1e40af' },
    accent: '#f59e0b', ink: '#0f172a', muted: '#64748b', surface: '#f8fafc'
  },
  fontFamily: { sans: ['Inter','system-ui','sans-serif'] }
}}}
```

- Inter font via Google Fonts.
- White cards on `surface` background, `rounded-2xl`, soft shadows, generous spacing.
- One primary button (`bg-brand-600 text-white hover:bg-brand-700`), one outlined secondary. Amber only for highlights.
- Mobile-first, min 44px tap targets, sticky navbar.
- Every async action has a loading state, every list an empty state, every error a toast. **No `alert()`.**
- Accessible: labels on inputs, visible focus rings, good contrast, `alt` text, keyboard-closable modals.

---

## 8. Security (frontend side)

- [ ] Only the anon key in `config.js`; no `service_role` anywhere. Commit `config.example.js`; the real `config.js` may be committed because it only holds public values, but never put private values in it.
- [ ] All user-generated text goes through `escapeHtml` before rendering via `innerHTML` (or use `textContent`).
- [ ] Hiding admin UI is cosmetic only; the real enforcement is RLS. Still hide admin controls from students.
- [ ] No secrets, tokens, or passwords logged to the console.

---

## 9. Git Workflow (we work on separate PCs)

- Work on branch `frontend`. Commit small and often with clear messages.
- Never edit `/sql` or `docs/BACKEND.md` (those belong to the backend branch). This prevents merge conflicts.
- Pull `main` regularly. Open a Pull Request into `main` when a module is complete.
- The repo must live in the **CPCCU GitHub organization**.

---

## 10. Execution Order

1. Scaffold the folders, `.gitignore`, `config.example.js`, `config.js` (mock on), stub README.
2. Write `api.mock.js` and `api.js` (real implementation too, even though untested).
3. Write `app.js`, the navbar, `index.html`, and `home.html`. Verify the mock login and signup flows.
4. Events module: `events.html`, `event.html`, `events.js`, then `scan.html`, `scan.js`.
5. Resource Hub: `resources.html`, `resources.js`.
6. Mobile pass at 375px, empty/error/loading states, polish.
7. Write `docs/FRONTEND.md`.
8. When the backend teammate delivers the keys: set `USE_MOCK = false`, paste the URL and key, and run the Section 12 checklist against the real backend. Fix any mismatch **in `api.js` only**, and report to the teammate any place where the backend deviates from the contract.

## 11. `docs/FRONTEND.md` and README Stub

`docs/FRONTEND.md` should contain: pages overview, `api.js` function list, how to switch from mock to real, how to run locally (`npx serve .`), design decisions, assumptions, known limitations.

Root `README.md` stub headings (to be filled at the end): Problem, Solution and Modules (with architecture diagram), Tech Stack, Live Demo URL, Demo Video, Local Run Steps, Seed Credentials, Real-World Student Scenarios (at least 3), Project Structure, Security Notes, Assumptions and Limitations.

## 12. Acceptance Checklist (frontend)

- [ ] Signup, login, logout work; protected pages redirect when logged out; `?next=` works.
- [ ] Feed lists events; search, club, type, and tab filters work; "N going" and "Registered" display.
- [ ] RSVP works; full and duplicate cases show friendly toasts; cancel works until check-in.
- [ ] QR pass shows and encodes the RSVP uuid; PNG download works.
- [ ] Scanner: ok, already, invalid, forbidden all display correctly; counter updates; manual entry works.
- [ ] Admin sees "+ New Event" and Scan; students do not.
- [ ] Resource Hub: cascading filters, search, upload with validation and progress, download, delete rules.
- [ ] No console errors on any page; layouts work at 375px width.
- [ ] Switching mock to real needs only a `config.js` change.
- [ ] No secrets in the repo.

## 13. Out of Scope

AI features, push notifications, payments, native apps, any backend or SQL work.

## 14. What to Hand Back

When finished, give a short summary: what was built, the exact steps needed to go live (set real keys, `USE_MOCK = false`, deploy, push to the CPCCU org), any assumptions, and any places where you needed the backend to differ from the contract.
