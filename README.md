# 🎓 CampusOS

> **Every club. Every note. One place.**
> Built for City University (CPCCU Hackathon 2)

---

## 📖 The Problem

City University students juggle dozens of Facebook groups and Messenger chats — one for each club, one per batch, one per course. Events get missed. Notes are buried in threads. There is no single authoritative place to:
- Find out what's happening on campus
- Share or download academic resources
- Check in to events without a paper list

---

## 🚀 The Solution & Features

**CampusOS** replaces scattered chats with one unified platform.

| Module | What it does |
|---|---|
| **Club & Event Engine** | Browse events, student RSVP and QR passes, club-scoped admin event editing, registration lists, and scanner check-in |
| **Resource Hub** | Upload & find notes, question papers, notices by Dept → Sem → Course; student uploads are department-approved |

---

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| **Frontend Markup** | HTML5, multi-page static site |
| **Styling** | Tailwind CSS via CDN |
| **Logic** | Vanilla JS, ES modules |
| **Backend** | Supabase (Postgres, Auth, Storage) |
| **QR Generation** | qrcode.js CDN |
| **QR Scanning** | html5-qrcode CDN |

---

## 🏗️ Architecture

```text
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

- **Frontend Isolation:** All Supabase calls are isolated to `api.real.js`. Pages never import from Supabase directly. `api.mock.js` uses the exact same function signatures.
- **Backend Setup:** CampusOS uses Supabase directly from the browser. There is no separate Node or custom server. The browser uses the project URL and a public anon key. PostgreSQL row-level security (RLS), Auth, and Storage policies enforce permissions.
- **No Build Step:** JS logic is inlined in HTML files or imported via ES modules.

---

## 🔐 Database & Auth Contract

- **Roles & Permissions:** Signup receives the `student` role by default. Admins can issue one-time passes from `admin.html`. Only the pass hash is stored in the database.
- **Event Scopes:** Events are assigned to a department. Students can browse every event, department admins can read events for their department, and root admins can read all events.
- **Resource Approval:** Resource uploads by students start as pending and are visible only to the uploader and admins responsible for the course department. Approved resources become visible to all signed-in users.
- **RSVPs:** Event capacity is serialized by locking the event row during RSVP insertion.

---

## 💻 Setup & Running Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/cpccu/Hackathon2-Decoy.git
   cd Hackathon2-Decoy
   ```
2. **Setup Supabase Configuration:**
   Open `js/config.js` and set `USE_MOCK = false`. Add your real `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
3. **Setup Database:**
   In your Supabase SQL Editor, run the files in the `sql/` directory in this order:
   - `schema.sql`
   - `policies.sql`
   - `seed.sql`
4. **Run Local Server:**
   ```bash
   npx serve .
   # or
   python -m http.server 8080
   ```
5. **Open Browser:** Navigate to `http://localhost:8080` to start exploring!
