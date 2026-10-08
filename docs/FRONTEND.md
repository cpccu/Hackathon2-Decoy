# Frontend Notes — CampusOS

## Pages Overview

| Page | File | Auth | Notes |
|---|---|---|---|
| Sign in / Sign up | `index.html` | No | Site entry page; login/signup tabs and inline validation |
| Home chooser | `home.html` | Yes | Hero and full-card Events/Resources links; no repeated module links in its navbar or footer |
| Events feed | `events.html` | Yes | Search, filters, admin create/delete |
| Event detail | `event.html?id=` | Yes | RSVP, QR pass, cancel, PNG download |
| Scanner | `scan.html` | Admin | Camera + manual entry, counter, history |
| Resource Hub | `resources.html` | Yes | Cascading filters, search, upload, download, delete |

## api.js Function List

See `js/api.js` for the full list. Key functions:

**Auth:** `signUp`, `signIn`, `signOut`, `getSession`, `getProfile`

**Events:** `listClubs`, `listEvents`, `getEvent`, `createEvent`, `deleteEvent`, `getRsvpCounts`, `getMyRsvps`, `getMyRsvpForEvent`, `createRsvp`, `cancelRsvp`, `getEventCheckinStats`, `checkIn`

**Resources:** `listDepartments`, `listCourses`, `listResources`, `uploadResource`, `deleteResource`, `getDownloadUrl`

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
- Navbar renders profile-aware — shows Scan link only for admins; its logo returns to `home.html`.
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
