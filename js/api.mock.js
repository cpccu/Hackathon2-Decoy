/**
 * api.mock.js – In-memory mock implementation of the CampusOS API contract.
 * Simulates realistic City University data. Persists session in sessionStorage.
 * Switch to the real backend by setting USE_MOCK = false in config.js.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));
const uuid  = () => crypto.randomUUID();
const now   = () => new Date().toISOString();
const daysAgo   = n => new Date(Date.now() - n * 864e5).toISOString();
const daysAhead = n => new Date(Date.now() + n * 864e5).toISOString();

// ─── Seed Data ───────────────────────────────────────────────────────────────
const CLUBS = [
  { id: 'club-1', name: 'City University Computer Club', description: 'Where code meets creativity.' },
  { id: 'club-2', name: 'Cultural Club',                 description: 'Celebrating arts and heritage.' },
  { id: 'club-3', name: 'Textile Club',                  description: 'Weaving the fabric of the future.' },
  { id: 'club-4', name: 'Sports Club',                   description: 'Health, hustle and hustle harder.' },
  { id: 'club-5', name: 'CU Debating Society',           description: 'Sharpen your arguments.' },
  { id: 'club-6', name: 'CU Robotics Club',              description: 'Build the future with metal and code.' },
  { id: 'club-7', name: 'CU Photography Club',           description: 'Capture moments that matter.' },
  { id: 'club-8', name: 'CU Business Club',              description: 'Entrepreneur mindset, campus scale.' },
];

const DEPARTMENTS = [
  { id: 'dept-cse',  name: 'CSE' },
  { id: 'dept-eee',  name: 'EEE' },
  { id: 'dept-bba',  name: 'BBA' },
  { id: 'dept-eng',  name: 'English' },
  { id: 'dept-civil',name: 'Civil Engineering' },
];

const COURSES = [
  // CSE
  { id: 'c-cse101', department_id:'dept-cse', semester:1, code:'CSE 101', title:'Intro to Programming' },
  { id: 'c-cse102', department_id:'dept-cse', semester:1, code:'CSE 102', title:'Discrete Mathematics' },
  { id: 'c-cse103', department_id:'dept-cse', semester:1, code:'CSE 103', title:'Digital Logic Design' },
  { id: 'c-cse104', department_id:'dept-cse', semester:1, code:'CSE 104', title:'English for IT' },
  { id: 'c-cse201', department_id:'dept-cse', semester:2, code:'CSE 201', title:'Data Structures' },
  { id: 'c-cse202', department_id:'dept-cse', semester:2, code:'CSE 202', title:'Object Oriented Programming' },
  { id: 'c-cse203', department_id:'dept-cse', semester:2, code:'CSE 203', title:'Computer Architecture' },
  { id: 'c-cse204', department_id:'dept-cse', semester:2, code:'CSE 204', title:'Calculus & Linear Algebra' },
  { id: 'c-cse301', department_id:'dept-cse', semester:3, code:'CSE 301', title:'Algorithms' },
  { id: 'c-cse302', department_id:'dept-cse', semester:3, code:'CSE 302', title:'Theory of Computation' },
  { id: 'c-cse303', department_id:'dept-cse', semester:3, code:'CSE 303', title:'Database Systems' },
  { id: 'c-cse304', department_id:'dept-cse', semester:3, code:'CSE 304', title:'Software Engineering' },
  { id: 'c-cse401', department_id:'dept-cse', semester:4, code:'CSE 401', title:'Operating Systems' },
  { id: 'c-cse402', department_id:'dept-cse', semester:4, code:'CSE 402', title:'Computer Networks' },
  { id: 'c-cse403', department_id:'dept-cse', semester:4, code:'CSE 403', title:'Web Technologies' },
  { id: 'c-cse404', department_id:'dept-cse', semester:4, code:'CSE 404', title:'Statistics & Probability' },
  { id: 'c-cse501', department_id:'dept-cse', semester:5, code:'CSE 501', title:'Compiler Design' },
  { id: 'c-cse502', department_id:'dept-cse', semester:5, code:'CSE 502', title:'Machine Learning' },
  { id: 'c-cse503', department_id:'dept-cse', semester:5, code:'CSE 503', title:'Information Security' },
  { id: 'c-cse504', department_id:'dept-cse', semester:5, code:'CSE 504', title:'Mobile Application Dev' },
  // EEE
  { id: 'c-eee101', department_id:'dept-eee', semester:1, code:'EEE 101', title:'Electrical Circuits I' },
  { id: 'c-eee201', department_id:'dept-eee', semester:2, code:'EEE 201', title:'Electronics I' },
  // BBA
  { id: 'c-bba101', department_id:'dept-bba', semester:1, code:'BBA 101', title:'Principles of Management' },
  { id: 'c-bba201', department_id:'dept-bba', semester:2, code:'BBA 201', title:'Business Communication' },
];

const PROFILES = [
  { id: 'user-admin',   full_name:'Admin User',  student_id:'ADM001', department:'CSE', role:'admin',   created_at: daysAgo(60) },
  { id: 'user-student1',full_name:'Rafi Ahmed',  student_id:'CSE2201', department:'CSE', role:'student', created_at: daysAgo(30) },
  { id: 'user-student2',full_name:'Nusrat Jahan',student_id:'EEE2202', department:'EEE', role:'student', created_at: daysAgo(25) },
];

const EVENTS = [
  { id:'evt-1', club_id:'club-1', title:'Web Dev Workshop', description:'Hands-on HTML/CSS/JS bootcamp for beginners. Learn to build from scratch!', type:'workshop', starts_at: daysAhead(5),   venue:'Room 402, Main Building', capacity:60, created_by:'user-admin', created_at: daysAgo(10) },
  { id:'evt-2', club_id:'club-2', title:'Cultural Night 2025', description:'A spectacular evening of dance, music and drama celebrating Bangladeshi culture.', type:'cultural', starts_at: daysAhead(12),  venue:'Auditorium', capacity:400, created_by:'user-admin', created_at: daysAgo(8) },
  { id:'evt-3', club_id:'club-3', title:'Inter-Department Debate', description:'CSE vs. BBA. Motion: "AI will replace human creativity."', type:'seminar', starts_at: daysAhead(3),   venue:'Seminar Hall, Block B', capacity:150, created_by:'user-admin', created_at: daysAgo(5) },
  { id:'evt-4', club_id:'club-4', title:'Robo Arena Championship', description:'Build your bot and compete! Prizes for top 3 teams.', type:'competition', starts_at: daysAhead(20),  venue:'Engineering Lab, Block C', capacity:80, created_by:'user-admin', created_at: daysAgo(7) },
  { id:'evt-5', club_id:'club-5', title:'Golden Hour Photowalk', description:'Evening campus photowalk. Bring your camera or phone.', type:'social', starts_at: daysAhead(2),   venue:'Campus Garden', capacity:null, created_by:'user-admin', created_at: daysAgo(3) },
  { id:'evt-6', club_id:'club-6', title:'Inter-Batch Football', description:'Annual football tournament. Register your batch team!', type:'sports', starts_at: daysAhead(8),   venue:'Sports Field', capacity:200, created_by:'user-admin', created_at: daysAgo(4) },
  { id:'evt-7', club_id:'club-7', title:'Startup Pitch Competition', description:'Present your startup idea to a panel of investors. 3 minutes, no slides.', type:'competition', starts_at: daysAhead(15),  venue:'Conference Room, Admin Block', capacity:100, created_by:'user-admin', created_at: daysAgo(6) },
  { id:'evt-8', club_id:'club-8', title:'Blood Donation Drive', description:'Give blood, save lives. Open to all students and faculty.', type:'general', starts_at: daysAhead(1),   venue:'Medical Center', capacity:null, created_by:'user-admin', created_at: daysAgo(2) },
  { id:'evt-9', club_id:'club-1', title:'Hackathon 2.0', description:'24-hour hackathon. Build something amazing. Team of 3-4.', type:'competition', starts_at: daysAgo(5),    venue:'Computer Lab, Block A', capacity:120, created_by:'user-admin', created_at: daysAgo(20) },
  { id:'evt-10',club_id:'club-2', title:'Freshers\' Welcome 2025', description:'Welcome party for new students. Fun games and refreshments.', type:'social', starts_at: daysAgo(15),   venue:'Auditorium', capacity:500, created_by:'user-admin', created_at: daysAgo(25) },
  { id:'evt-11',club_id:'club-3', title:'Mock UN Conference', description:'Model United Nations. Represent a country, debate global issues.', type:'seminar', starts_at: daysAgo(3),    venue:'Seminar Hall, Block B', capacity:200, created_by:'user-admin', created_at: daysAgo(12) },
];

const RSVPS = [
  { id:'rsvp-1', event_id:'evt-1', user_id:'user-student1', checked_in_at:null,       created_at: daysAgo(5) },
  { id:'rsvp-2', event_id:'evt-2', user_id:'user-student1', checked_in_at:null,       created_at: daysAgo(4) },
  { id:'rsvp-3', event_id:'evt-9', user_id:'user-student1', checked_in_at: daysAgo(4),created_at: daysAgo(10) },
  { id:'rsvp-4', event_id:'evt-3', user_id:'user-student2', checked_in_at:null,       created_at: daysAgo(2) },
];

const RESOURCES = [
  { id:'res-1',  course_id:'c-cse301', title:'Algorithms – Midterm 2024',           kind:'question', tags:['midterm','2024','sorting'], file_path:'mock/algorithms-midterm.pdf', file_name:'algorithms-midterm.pdf', uploaded_by:'user-admin',    created_at: daysAgo(30) },
  { id:'res-2',  course_id:'c-cse301', title:'Graph Theory Lecture Notes',           kind:'note',     tags:['graph','bfs','dfs'],        file_path:'mock/graph-notes.pdf',         file_name:'graph-notes.pdf',        uploaded_by:'user-student1', created_at: daysAgo(14) },
  { id:'res-3',  course_id:'c-cse303', title:'Database Systems Final 2023',          kind:'question', tags:['final','2023','sql'],        file_path:'mock/db-final.pdf',            file_name:'db-final.pdf',           uploaded_by:'user-admin',    created_at: daysAgo(45) },
  { id:'res-4',  course_id:'c-cse303', title:'Normalization & ER Diagram Notes',     kind:'note',     tags:['normalization','er'],        file_path:'mock/db-notes.pdf',            file_name:'db-notes.pdf',           uploaded_by:'user-student1', created_at: daysAgo(7)  },
  { id:'res-5',  course_id:'c-cse201', title:'Data Structures – Linked List Notes',  kind:'note',     tags:['linked-list','stack'],       file_path:'mock/ds-notes.pdf',            file_name:'ds-notes.pdf',           uploaded_by:'user-student2', created_at: daysAgo(20) },
  { id:'res-6',  course_id:'c-cse201', title:'DS Midterm 2024 Q&A',                  kind:'question', tags:['midterm','2024'],            file_path:'mock/ds-midterm.pdf',          file_name:'ds-midterm.pdf',         uploaded_by:'user-admin',    created_at: daysAgo(28) },
  { id:'res-7',  course_id:'c-cse401', title:'OS Process Scheduling Notes',          kind:'note',     tags:['process','scheduling'],     file_path:'mock/os-notes.pdf',            file_name:'os-notes.pdf',           uploaded_by:'user-student1', created_at: daysAgo(10) },
  { id:'res-8',  course_id:'c-cse403', title:'Web Technologies Final 2023',          kind:'question', tags:['final','2023','html','js'],  file_path:'mock/web-final.pdf',           file_name:'web-final.pdf',          uploaded_by:'user-admin',    created_at: daysAgo(50) },
  { id:'res-9',  course_id:'c-cse502', title:'ML Exam Notice – Date Change',         kind:'notice',   tags:['exam','notice'],            file_path:'mock/ml-notice.pdf',           file_name:'ml-notice.pdf',          uploaded_by:'user-admin',    created_at: daysAgo(1)  },
  { id:'res-10', course_id:'c-cse101', title:'Intro to Python – Lecture 1',          kind:'note',     tags:['python','beginner'],        file_path:'mock/python-lecture1.pdf',     file_name:'python-lecture1.pdf',    uploaded_by:'user-student2', created_at: daysAgo(60) },
  { id:'res-11', course_id:'c-eee101', title:'Circuit Analysis – Chapter 3',         kind:'note',     tags:['circuit','kvl','kcl'],      file_path:'mock/eee-ch3.pdf',             file_name:'eee-ch3.pdf',            uploaded_by:'user-student2', created_at: daysAgo(15) },
  { id:'res-12', course_id:'c-bba101', title:'Management Principles Summary',        kind:'note',     tags:['management','summary'],     file_path:'mock/bba-mgmt.pdf',            file_name:'bba-mgmt.pdf',           uploaded_by:'user-student2', created_at: daysAgo(8)  },
];

// ─── Mock "database" (mutable arrays) ────────────────────────────────────────
let _clubs       = [...CLUBS];
let _departments = [...DEPARTMENTS];
let _courses     = [...COURSES];
let _profiles    = [...PROFILES];
let _events      = [...EVENTS];
let _rsvps       = [...RSVPS];
let _resources   = [...RESOURCES];

// ─── Session management ───────────────────────────────────────────────────────
const SESSION_KEY = 'campusos_mock_session';
let _session = null;

function _loadSession() {
  try { _session = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch {}
}
function _saveSession(profile) {
  _session = profile;
  if (profile) sessionStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  else sessionStorage.removeItem(SESSION_KEY);
}
_loadSession();

function _currentProfile() {
  return _session ? _profiles.find(p => p.id === _session.id) || null : null;
}

// Mock credentials
const MOCK_USERS = {
  'admin@campusos.test':    { password: 'Admin@12345',    id: 'user-admin'    },
  'student1@campusos.test': { password: 'Student@12345',  id: 'user-student1' },
  'student2@campusos.test': { password: 'Student@12345',  id: 'user-student2' },
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function signUp({ email, password, full_name, student_id, department, batch }) {
  await delay();
  if (MOCK_USERS[email]) throw new Error('Email already registered');
  const id = uuid();
  const profile = { id, full_name: full_name || email.split('@')[0], student_id, department, batch, role: 'student', created_at: now() };
  MOCK_USERS[email] = { password, id };
  _profiles.push(profile);
  _saveSession(profile);
  return { user: profile, needsConfirmation: false };
}

export async function signIn(email, password) {
  await delay();
  const cred = MOCK_USERS[email];
  if (!cred || cred.password !== password) throw new Error('Invalid login credentials');
  const profile = _profiles.find(p => p.id === cred.id);
  _saveSession(profile);
  return { user: profile };
}

export async function signOut() {
  await delay(100);
  _saveSession(null);
}

export async function getSession() {
  await delay(50);
  return _session;
}

export async function getProfile() {
  await delay(50);
  return _currentProfile();
}

// ─── Events ───────────────────────────────────────────────────────────────────
export async function listClubs() {
  await delay();
  return [..._clubs];
}

export async function listEvents({ search = '', clubId = '', type = '', range = 'all' } = {}) {
  await delay();
  const now_ = new Date();
  const weekEnd = new Date(now_.getTime() + 7 * 864e5);

  return _events
    .filter(e => {
      const starts = new Date(e.starts_at);
      if (range === 'upcoming' && starts <= now_) return false;
      if (range === 'past'     && starts >= now_) return false;
      if (range === 'week'     && (starts <= now_ || starts >= weekEnd)) return false;
      if (clubId && e.club_id !== clubId) return false;
      if (type   && e.type    !== type  ) return false;
      if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => range === 'past'
      ? new Date(b.starts_at) - new Date(a.starts_at)
      : new Date(a.starts_at) - new Date(b.starts_at))
    .map(e => ({ ...e, club_name: _clubs.find(c => c.id === e.club_id)?.name || '' }));
}

export async function getEvent(id) {
  await delay();
  const e = _events.find(ev => ev.id === id);
  if (!e) return null;
  return { ...e, club_name: _clubs.find(c => c.id === e.club_id)?.name || '' };
}

export async function createEvent(data) {
  await delay();
  const p = _currentProfile();
  if (!p || p.role !== 'admin') throw new Error('Admin only');
  const ev = { id: uuid(), ...data, created_by: p.id, created_at: now() };
  _events.push(ev);
  return { ...ev, club_name: _clubs.find(c => c.id === ev.club_id)?.name || '' };
}

export async function deleteEvent(id) {
  await delay();
  const p = _currentProfile();
  if (!p || p.role !== 'admin') throw new Error('Admin only');
  _events = _events.filter(e => e.id !== id);
  _rsvps  = _rsvps.filter(r => r.event_id !== id);
}

export async function getRsvpCounts() {
  await delay(100);
  const counts = {};
  for (const r of _rsvps) {
    counts[r.event_id] = (counts[r.event_id] || 0) + 1;
  }
  return counts;
}

export async function getMyRsvps() {
  await delay();
  const p = _currentProfile();
  if (!p) return [];
  return _rsvps.filter(r => r.user_id === p.id);
}

export async function getMyRsvpForEvent(eventId) {
  await delay(100);
  const p = _currentProfile();
  if (!p) return null;
  return _rsvps.find(r => r.event_id === eventId && r.user_id === p.id) || null;
}

export async function createRsvp(eventId) {
  await delay();
  const p = _currentProfile();
  if (!p) throw new Error('Not authenticated');
  // duplicate check
  if (_rsvps.find(r => r.event_id === eventId && r.user_id === p.id)) {
    const err = new Error('duplicate key value'); err.code = '23505'; throw err;
  }
  // capacity check
  const ev = _events.find(e => e.id === eventId);
  if (ev?.capacity !== null && ev?.capacity !== undefined) {
    const taken = _rsvps.filter(r => r.event_id === eventId).length;
    if (taken >= ev.capacity) throw new Error('Event is full');
  }
  const rsvp = { id: uuid(), event_id: eventId, user_id: p.id, checked_in_at: null, created_at: now() };
  _rsvps.push(rsvp);
  return rsvp;
}

export async function cancelRsvp(rsvpId) {
  await delay();
  _rsvps = _rsvps.filter(r => r.id !== rsvpId);
}

export async function getEventCheckinStats(eventId) {
  await delay(100);
  const all = _rsvps.filter(r => r.event_id === eventId);
  return { total: all.length, checkedIn: all.filter(r => r.checked_in_at).length };
}

export async function checkIn(rsvpId) {
  await delay(400);
  const p = _currentProfile();
  if (!p || p.role !== 'admin') return { status: 'forbidden' };
  const rsvp = _rsvps.find(r => r.id === rsvpId);
  if (!rsvp) return { status: 'invalid' };
  const who = _profiles.find(pr => pr.id === rsvp.user_id)?.full_name || 'Unknown';
  const ev  = _events.find(e => e.id === rsvp.event_id)?.title || 'Unknown event';
  if (rsvp.checked_in_at) {
    return { status: 'already', name: who, event: ev, event_id: rsvp.event_id, checked_in_at: rsvp.checked_in_at };
  }
  rsvp.checked_in_at = now();
  return { status: 'ok', name: who, event: ev, event_id: rsvp.event_id, checked_in_at: rsvp.checked_in_at };
}

// ─── Resources ────────────────────────────────────────────────────────────────
export async function listDepartments() {
  await delay();
  return [..._departments];
}

export async function listCourses({ departmentId = '', semester = '' } = {}) {
  await delay();
  return _courses.filter(c => {
    if (departmentId && c.department_id !== departmentId) return false;
    if (semester && c.semester !== Number(semester)) return false;
    return true;
  });
}

export async function listResources({ search = '', departmentId = '', semester = '', courseId = '', kind = '' } = {}) {
  await delay();
  // Build the set of valid course ids based on filters
  let validCourseIds = null;
  if (departmentId || semester) {
    const courses = _courses.filter(c => {
      if (departmentId && c.department_id !== departmentId) return false;
      if (semester && c.semester !== Number(semester)) return false;
      return true;
    });
    validCourseIds = new Set(courses.map(c => c.id));
  }

  const keywords = search.split(/[\s,]+/).map(s => s.trim().toLowerCase()).filter(Boolean);

  return _resources
    .filter(r => {
      if (courseId && r.course_id !== courseId) return false;
      if (validCourseIds && !validCourseIds.has(r.course_id)) return false;
      if (kind && r.kind !== kind) return false;
      if (keywords.length) {
        const haystack = r.title.toLowerCase() + ' ' + r.tags.join(' ').toLowerCase();
        if (!keywords.every(kw => haystack.includes(kw))) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(r => {
      const course   = _courses.find(c => c.id === r.course_id);
      const uploader = _profiles.find(p => p.id === r.uploaded_by);
      return {
        ...r,
        course_code:   course?.code || '',
        course_title:  course?.title || '',
        uploader_name: uploader?.full_name || 'Unknown',
      };
    });
}

export async function uploadResource({ file, title, courseId, kind, tags, onProgress }) {
  await delay(800);
  const p = _currentProfile();
  if (!p) throw new Error('Not authenticated');
  if (onProgress) { onProgress(50); await delay(400); onProgress(100); }
  const resource = {
    id: uuid(),
    course_id: courseId,
    title,
    kind,
    tags: tags || [],
    file_path: `mock/${Date.now()}-${file.name}`,
    file_name: file.name,
    uploaded_by: p.id,
    created_at: now(),
  };
  _resources.unshift(resource);
  const course   = _courses.find(c => c.id === courseId);
  return { ...resource, course_code: course?.code || '', course_title: course?.title || '', uploader_name: p.full_name };
}

export async function deleteResource(id) {
  await delay();
  const p = _currentProfile();
  const r = _resources.find(res => res.id === id);
  if (!r) return;
  if (p?.role !== 'admin' && r.uploaded_by !== p?.id) throw new Error('Forbidden');
  _resources = _resources.filter(res => res.id !== id);
}

export async function getDownloadUrl(filePath) {
  await delay(200);
  // In mock mode, create a tiny text blob as a stand-in for the real file.
  const content = `[Mock file] ${filePath}\nThis is a demo download from CampusOS mock mode.`;
  const blob = new Blob([content], { type: 'text/plain' });
  return URL.createObjectURL(blob);
}
