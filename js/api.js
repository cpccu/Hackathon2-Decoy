/**
 * api.js – The ONLY file that imports from Supabase.
 * Depending on USE_MOCK in config.js, re-exports either the real or mock API.
 * All other modules import from this file, never from Supabase directly.
 */

import { USE_MOCK, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// ─── Branch: real or mock ─────────────────────────────────────────────────────
let impl;
if (USE_MOCK) {
  impl = await import('./api.mock.js');
} else {
  impl = await import('./api.real.js');
}

export const {
  signUp, signIn, signOut, getSession, getProfile,
  listClubs, listEvents, getEvent, createEvent, deleteEvent,
  getRsvpCounts, getMyRsvps, getMyRsvpForEvent, createRsvp, cancelRsvp,
  getEventCheckinStats, checkIn,
  listDepartments, listCourses, listResources,
  uploadResource, deleteResource, getDownloadUrl,
} = impl;
