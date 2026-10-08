/**
 * api.js – The ONLY file that imports from Supabase.
 * Loads only the implementation selected by USE_MOCK.
 */

import { USE_MOCK } from './config.js';

const implPromise = USE_MOCK
  ? import('./api.mock.js')
  : import('./api.real.js');

const call = (method, ...args) => implPromise.then(impl => impl[method](...args));

export const signUp               = (...a) => call('signUp', ...a);
export const signIn               = (...a) => call('signIn', ...a);
export const createAdminInvite    = (...a) => call('createAdminInvite', ...a);
export const signOut              = (...a) => call('signOut', ...a);
export const getSession           = (...a) => call('getSession', ...a);
export const getProfile           = (...a) => call('getProfile', ...a);
export const listClubs            = (...a) => call('listClubs', ...a);
export const getManagedDepartmentIds = (...a) => call('getManagedDepartmentIds', ...a);
export const listEvents           = (...a) => call('listEvents', ...a);
export const getEvent             = (...a) => call('getEvent', ...a);
export const createEvent          = (...a) => call('createEvent', ...a);
export const updateEvent          = (...a) => call('updateEvent', ...a);
export const deleteEvent          = (...a) => call('deleteEvent', ...a);
export const getRsvpCounts        = (...a) => call('getRsvpCounts', ...a);
export const getEventRegistrants  = (...a) => call('getEventRegistrants', ...a);
export const getMyRsvps           = (...a) => call('getMyRsvps', ...a);
export const getMyRsvpForEvent    = (...a) => call('getMyRsvpForEvent', ...a);
export const createRsvp           = (...a) => call('createRsvp', ...a);
export const cancelRsvp           = (...a) => call('cancelRsvp', ...a);
export const getEventCheckinStats = (...a) => call('getEventCheckinStats', ...a);
export const checkIn              = (...a) => call('checkIn', ...a);
export const listDepartments      = (...a) => call('listDepartments', ...a);
export const listCourses          = (...a) => call('listCourses', ...a);
export const listResources        = (...a) => call('listResources', ...a);
export const uploadResource       = (...a) => call('uploadResource', ...a);
export const deleteResource       = (...a) => call('deleteResource', ...a);
export const getDownloadUrl       = (...a) => call('getDownloadUrl', ...a);
export const reviewResource       = (...a) => call('reviewResource', ...a);
