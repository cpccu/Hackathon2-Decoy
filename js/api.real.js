/**
 * api.real.js – Real Supabase implementation.
 * Mirrors every function signature in api.mock.js exactly.
 * Activated when USE_MOCK = false in config.js.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function signUp({ email, password, full_name, student_id, department }) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name, student_id, department } },
  });
  if (error) throw new Error(error.message);
  const user = data.user;
  const needsConfirmation = !data.session;
  return { user, needsConfirmation };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return { user: data.user };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data;
}

// ─── Events ───────────────────────────────────────────────────────────────────
export async function listClubs() {
  const { data, error } = await supabase.from('clubs').select('*').order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function listEvents({ search = '', clubId = '', type = '', range = 'all' } = {}) {
  const now = new Date().toISOString();
  let q = supabase.from('events').select('*, clubs(name)').order('starts_at');

  if (range === 'upcoming') q = q.gte('starts_at', now);
  else if (range === 'past') q = q.lt('starts_at', now).order('starts_at', { ascending: false });
  else if (range === 'week') {
    const weekEnd = new Date(Date.now() + 7 * 864e5).toISOString();
    q = q.gte('starts_at', now).lte('starts_at', weekEnd);
  }

  if (clubId) q = q.eq('club_id', clubId);
  if (type)   q = q.eq('type', type);
  if (search) q = q.ilike('title', `%${search}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data.map(e => ({ ...e, club_name: e.clubs?.name || '' }));
}

export async function getEvent(id) {
  const { data, error } = await supabase.from('events').select('*, clubs(name)').eq('id', id).single();
  if (error) return null;
  return { ...data, club_name: data.clubs?.name || '' };
}

export async function createEvent(data) {
  const { data: ev, error } = await supabase.from('events').insert(data).select('*, clubs(name)').single();
  if (error) throw new Error(error.message);
  return { ...ev, club_name: ev.clubs?.name || '' };
}

export async function deleteEvent(id) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getRsvpCounts() {
  const { data, error } = await supabase.rpc('rsvp_counts');
  if (error) throw new Error(error.message);
  const counts = {};
  for (const row of data) counts[row.event_id] = Number(row.going);
  return counts;
}

export async function getMyRsvps() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('rsvps').select('*').eq('user_id', user.id);
  if (error) throw new Error(error.message);
  return data;
}

export async function getMyRsvpForEvent(eventId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('rsvps').select('*').eq('event_id', eventId).eq('user_id', user.id).maybeSingle();
  return data;
}

export async function createRsvp(eventId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('rsvps').insert({ event_id: eventId, user_id: user.id }).select().single();
  if (error) {
    const err = new Error(error.message);
    err.code = error.code;
    throw err;
  }
  return data;
}

export async function cancelRsvp(rsvpId) {
  const { error } = await supabase.from('rsvps').delete().eq('id', rsvpId);
  if (error) throw new Error(error.message);
}

export async function getEventCheckinStats(eventId) {
  const { data, error } = await supabase.from('rsvps').select('checked_in_at').eq('event_id', eventId);
  if (error) throw new Error(error.message);
  return { total: data.length, checkedIn: data.filter(r => r.checked_in_at).length };
}

export async function checkIn(rsvpId) {
  const { data, error } = await supabase.rpc('check_in_rsvp', { p_rsvp_id: rsvpId });
  if (error) throw new Error(error.message);
  return data;
}

// ─── Resources ────────────────────────────────────────────────────────────────
export async function listDepartments() {
  const { data, error } = await supabase.from('departments').select('*').order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function listCourses({ departmentId = '', semester = '' } = {}) {
  let q = supabase.from('courses').select('*').order('code');
  if (departmentId) q = q.eq('department_id', departmentId);
  if (semester)     q = q.eq('semester', Number(semester));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

export async function listResources({ search = '', departmentId = '', semester = '', courseId = '', kind = '' } = {}) {
  let q = supabase.from('resources').select('*, courses(code,title,department_id,semester), profiles(full_name)').order('created_at', { ascending: false });

  if (courseId) {
    q = q.eq('course_id', courseId);
  } else if (departmentId || semester) {
    // We need to filter by department/semester via courses
    let cq = supabase.from('courses').select('id');
    if (departmentId) cq = cq.eq('department_id', departmentId);
    if (semester)     cq = cq.eq('semester', Number(semester));
    const { data: courses } = await cq;
    const ids = (courses || []).map(c => c.id);
    if (ids.length === 0) return [];
    q = q.in('course_id', ids);
  }

  if (kind)   q = q.eq('kind', kind);
  if (search) {
    const keywords = search.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    // title ilike for first keyword; tags overlap for the array
    q = q.ilike('title', `%${keywords[0] || ''}%`);
    if (keywords.length > 0) q = q.overlaps('tags', keywords);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    ...r,
    course_code:   r.courses?.code  || '',
    course_title:  r.courses?.title || '',
    uploader_name: r.profiles?.full_name || 'Unknown',
  }));
}

export async function uploadResource({ file, title, courseId, kind, tags, onProgress }) {
  const { data: { user } } = await supabase.auth.getUser();
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${user.id}/${Date.now()}-${sanitized}`;

  const { error: storageErr } = await supabase.storage.from('resources').upload(path, file, {
    cacheControl: '3600',
    onUploadProgress: ({ loaded, total }) => onProgress && onProgress(Math.round((loaded / total) * 100)),
  });
  if (storageErr) throw new Error(storageErr.message);

  const { data, error: dbErr } = await supabase.from('resources').insert({
    course_id: courseId, title, kind, tags: tags || [], file_path: path, file_name: file.name, uploaded_by: user.id,
  }).select('*, courses(code,title), profiles(full_name)').single();

  if (dbErr) {
    // Roll back the storage upload
    await supabase.storage.from('resources').remove([path]);
    throw new Error(dbErr.message);
  }
  return { ...data, course_code: data.courses?.code || '', course_title: data.courses?.title || '', uploader_name: data.profiles?.full_name || '' };
}

export async function deleteResource(id) {
  const { data, error: fetchErr } = await supabase.from('resources').select('file_path').eq('id', id).single();
  if (fetchErr) throw new Error(fetchErr.message);
  await supabase.storage.from('resources').remove([data.file_path]);
  const { error } = await supabase.from('resources').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getDownloadUrl(filePath) {
  const { data, error } = await supabase.storage.from('resources').createSignedUrl(filePath, 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
