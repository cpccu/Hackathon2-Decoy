/**
 * api.js – The ONLY file that imports from Supabase.
 * Statically imports both implementations and delegates based on USE_MOCK.
 * This avoids top-level await import() which breaks in many environments.
 */

import { USE_MOCK } from './config.js';
import * as mock from './api.mock.js';
import * as real from './api.real.js';

const impl = USE_MOCK ? mock : real;

export const signUp               = (...a) => impl.signUp(...a);
export const signIn               = (...a) => impl.signIn(...a);
export const signOut              = (...a) => impl.signOut(...a);
export const getSession           = (...a) => impl.getSession(...a);
export const getProfile           = (...a) => impl.getProfile(...a);
export const listClubs            = (...a) => impl.listClubs(...a);
export const listEvents           = (...a) => impl.listEvents(...a);
export const getEvent             = (...a) => impl.getEvent(...a);
export const createEvent          = (...a) => impl.createEvent(...a);
export const deleteEvent          = (...a) => impl.deleteEvent(...a);
export const getRsvpCounts        = (...a) => impl.getRsvpCounts(...a);
export const getMyRsvps           = (...a) => impl.getMyRsvps(...a);
export const getMyRsvpForEvent    = (...a) => impl.getMyRsvpForEvent(...a);
export const createRsvp           = (...a) => impl.createRsvp(...a);
export const cancelRsvp           = (...a) => impl.cancelRsvp(...a);
export const getEventCheckinStats = (...a) => impl.getEventCheckinStats(...a);
export const checkIn              = (...a) => impl.checkIn(...a);
export const listDepartments      = (...a) => impl.listDepartments(...a);
export const listCourses          = (...a) => impl.listCourses(...a);
export const listResources        = (...a) => impl.listResources(...a);
export const uploadResource       = (...a) => impl.uploadResource(...a);
export const deleteResource       = (...a) => impl.deleteResource(...a);
export const getDownloadUrl       = (...a) => impl.getDownloadUrl(...a);
