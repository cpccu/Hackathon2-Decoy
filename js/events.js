/**
 * events.js – Event feed: listing, filters, RSVP chip, admin create/delete.
 */

import { listClubs, listEvents, getRsvpCounts, getMyRsvps, createEvent, deleteEvent } from './api.js';
import { requireAuth, getProfile } from './api.js';
import * as App from './app.js';

// Aliases (getProfile is in api.js too via app.js re-export)
import { getProfile as _getProfile } from './api.js';

let _profile   = null;
let _clubs     = [];
let _rsvpIds   = new Set();  // set of event_ids the current user has RSVPed to
let _counts    = {};
let _filters   = { search: '', clubId: '', type: '', range: 'upcoming' };

// ─── Init ──────────────────────────────────────────────────────────────────────
export async function init() {
  App.renderNavbar();

  try {
    await App.requireAuth();
  } catch { return; }

  _profile = await _getProfile();
  const isAdmin = _profile?.role === 'admin';

  // Show admin button
  if (isAdmin) {
    document.getElementById('new-event-btn').classList.remove('hidden');
    document.getElementById('new-event-btn').addEventListener('click', openCreateModal);
  }

  // Load static data in parallel
  [_clubs, _counts] = await Promise.all([listClubs(), getRsvpCounts()]);

  // Populate club filter
  const clubSel = document.getElementById('filter-club');
  clubSel.innerHTML = '<option value="">All Clubs</option>' +
    _clubs.map(c => `<option value="${c.id}">${App.escapeHtml(c.name)}</option>`).join('');

  // Load my RSVPs
  const { getMyRsvps: myRsvpsFn } = await import('./api.js');
  const myRsvps = await myRsvpsFn();
  _rsvpIds = new Set(myRsvps.map(r => r.event_id));

  // Wire filters
  document.getElementById('search-input').addEventListener('input', App.debounce(e => {
    _filters.search = e.target.value;
    loadEvents();
  }, 300));
  document.getElementById('filter-club').addEventListener('change', e => { _filters.clubId = e.target.value; loadEvents(); });
  document.getElementById('filter-type').addEventListener('change', e => { _filters.type   = e.target.value; loadEvents(); });
  document.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      _filters.range = btn.dataset.range;
      document.querySelectorAll('[data-range]').forEach(b => {
        b.classList.toggle('bg-brand-600',  b === btn);
        b.classList.toggle('text-white',     b === btn);
        b.classList.toggle('text-muted',    b !== btn);
        b.classList.toggle('bg-white',      b !== btn);
      });
      loadEvents();
    });
  });

  loadEvents();
}

// ─── Load & render events ──────────────────────────────────────────────────────
async function loadEvents() {
  const grid = document.getElementById('events-grid');
  grid.innerHTML = App.skeletonCards(6);
  try {
    const events = await listEvents(_filters);
    renderEvents(events);
  } catch (err) {
    App.toast('Failed to load events: ' + err.message, 'error');
    grid.innerHTML = App.emptyState({ icon: '⚠️', title: 'Error loading events', text: err.message });
  }
}

function renderEvents(events) {
  const grid   = document.getElementById('events-grid');
  const isAdmin = _profile?.role === 'admin';

  if (!events.length) {
    grid.innerHTML = App.emptyState({
      icon: '📅',
      title: 'No events found',
      text: 'Try adjusting your filters, or check back soon.',
    });
    return;
  }

  grid.innerHTML = events.map(ev => {
    const d       = new Date(ev.starts_at);
    const isPast  = d < new Date();
    const going   = _counts[ev.id] || 0;
    const rsvped  = _rsvpIds.has(ev.id);
    const seatsLeft = ev.capacity != null ? ev.capacity - going : null;
    const full    = seatsLeft !== null && seatsLeft <= 0;
    const typeColors = {
      workshop: 'bg-blue-100 text-blue-700', seminar: 'bg-purple-100 text-purple-700',
      competition: 'bg-red-100 text-red-700', cultural: 'bg-pink-100 text-pink-700',
      sports: 'bg-emerald-100 text-emerald-700', social: 'bg-orange-100 text-orange-700',
      general: 'bg-slate-100 text-slate-600',
    };

    return `
      <article class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group flex flex-col">
        <!-- Date badge + type -->
        <div class="bg-gradient-to-r from-brand-600 to-brand-500 px-5 pt-4 pb-3 flex items-start justify-between">
          <div class="text-white">
            <div class="text-2xl font-black leading-none">${d.getDate().toString().padStart(2,'0')}</div>
            <div class="text-xs font-semibold uppercase tracking-wider opacity-80">${d.toLocaleString('en-GB',{month:'short'})}</div>
            <div class="text-xs opacity-70">${d.toLocaleString('en-GB',{year:'numeric'})}</div>
          </div>
          <div class="flex flex-col items-end gap-1">
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white capitalize">${App.escapeHtml(ev.type)}</span>
            ${rsvped  ? '<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-accent text-white">✓ Registered</span>' : ''}
            ${full && !rsvped ? '<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-red-200 text-red-700">Full</span>' : ''}
          </div>
        </div>

        <div class="p-5 flex-1 flex flex-col">
          <h3 class="font-bold text-ink text-lg mb-1 group-hover:text-brand-600 transition-colors line-clamp-2">
            <a href="event.html?id=${ev.id}">${App.escapeHtml(ev.title)}</a>
          </h3>
          <p class="text-xs text-muted font-medium mb-3">
            🏛️ ${App.escapeHtml(ev.club_name)}
          </p>
          <div class="space-y-1 text-xs text-muted mb-4 flex-1">
            <div>📍 ${App.escapeHtml(ev.venue)}</div>
            <div>🕐 ${App.formatDateTime(ev.starts_at)}</div>
            <div>👥 ${going} going${seatsLeft !== null ? ` · ${seatsLeft} seats left` : ''}</div>
          </div>
          <div class="flex items-center gap-2 mt-auto">
            <a href="event.html?id=${ev.id}"
               class="flex-1 text-center bg-brand-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-brand-700 transition">
              ${rsvped ? 'View Pass' : isPast ? 'View Details' : 'See Details'}
            </a>
            ${isAdmin ? `
              <button onclick="handleDelete('${ev.id}', '${App.escapeHtml(ev.title).replace(/'/g,"\\'")}',this)"
                class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete event" aria-label="Delete event">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>` : ''}
          </div>
        </div>
      </article>`;
  }).join('');
}

// ─── Admin: Create event ───────────────────────────────────────────────────────
function openCreateModal() {
  const clubOptions = _clubs.map(c => `<option value="${c.id}">${App.escapeHtml(c.name)}</option>`).join('');
  App.openModal(`
    <div class="p-6">
      <h2 class="text-xl font-bold text-ink mb-5">Create New Event</h2>
      <form id="create-event-form" class="space-y-4" novalidate>
        <div>
          <label class="block text-xs font-semibold uppercase text-muted mb-1">Club *</label>
          <select id="ce-club" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white" required>
            <option value="">Select a club</option>${clubOptions}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase text-muted mb-1">Title *</label>
          <input id="ce-title" type="text" placeholder="Event title" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" required>
        </div>
        <div>
          <label class="block text-xs font-semibold uppercase text-muted mb-1">Description</label>
          <textarea id="ce-desc" rows="3" placeholder="What's this event about?" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm resize-none"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold uppercase text-muted mb-1">Type *</label>
            <select id="ce-type" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white">
              ${['workshop','seminar','competition','cultural','sports','social','general'].map(t => `<option value="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase text-muted mb-1">Capacity</label>
            <input id="ce-capacity" type="number" min="1" placeholder="Leave blank for unlimited" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold uppercase text-muted mb-1">Date &amp; Time *</label>
            <input id="ce-datetime" type="datetime-local" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" required>
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase text-muted mb-1">Venue *</label>
            <input id="ce-venue" type="text" placeholder="e.g. Auditorium" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" required>
          </div>
        </div>
        <p id="ce-error" class="text-red-500 text-xs bg-red-50 rounded-lg p-2 hidden"></p>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="window.AppModule.closeModal()" class="flex-1 border border-slate-200 text-ink font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition text-sm">Cancel</button>
          <button id="ce-submit" type="submit" class="flex-1 bg-brand-600 text-white font-bold py-2.5 rounded-xl hover:bg-brand-700 transition text-sm">Create Event</button>
        </div>
      </form>
    </div>`);

  window.AppModule = App;
  document.getElementById('create-event-form').addEventListener('submit', async e => {
    e.preventDefault();
    const club_id    = document.getElementById('ce-club').value;
    const title      = document.getElementById('ce-title').value.trim();
    const description= document.getElementById('ce-desc').value.trim();
    const type       = document.getElementById('ce-type').value;
    const cap        = document.getElementById('ce-capacity').value;
    const starts_at  = document.getElementById('ce-datetime').value;
    const venue      = document.getElementById('ce-venue').value.trim();
    const errEl      = document.getElementById('ce-error');
    errEl.classList.add('hidden');

    if (!club_id || !title || !starts_at || !venue) {
      errEl.textContent = 'Please fill in all required fields.';
      errEl.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('ce-submit');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      const ev = await createEvent({ club_id, title, description, type, starts_at: new Date(starts_at).toISOString(), venue, capacity: cap ? parseInt(cap) : null });
      App.closeModal();
      App.toast('Event created! 🎉', 'success');
      _counts[ev.id] = 0;
      loadEvents();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Create Event';
    }
  });
}

// ─── Admin: Delete event ───────────────────────────────────────────────────────
window.handleDelete = async (id, title, btn) => {
  App.openModal(`
    <div class="p-6 text-center">
      <div class="text-4xl mb-3">🗑️</div>
      <h2 class="text-xl font-bold text-ink mb-2">Delete event?</h2>
      <p class="text-muted mb-6">Are you sure you want to delete <strong>${App.escapeHtml(title)}</strong>? This cannot be undone.</p>
      <div class="flex gap-3">
        <button onclick="window.AppModule.closeModal()" class="flex-1 border border-slate-200 text-ink font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
        <button id="confirm-delete-btn" class="flex-1 bg-red-600 text-white font-bold py-2.5 rounded-xl hover:bg-red-700 transition">Delete</button>
      </div>
    </div>`);

  window.AppModule = App;
  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    try {
      await deleteEvent(id);
      App.closeModal();
      App.toast('Event deleted.', 'info');
      loadEvents();
    } catch (err) {
      App.toast('Failed to delete: ' + err.message, 'error');
    }
  });
};
