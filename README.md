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
