/**
 * app.js – Shared UI helpers, auth guards, navbar, toast, modal, utilities.
 * Every page imports from here (and from api.js for data).
 */

import { USE_MOCK }                          from './config.js';
import { getSession, getProfile, signOut }   from './api.js';

// ─── Utilities ────────────────────────────────────────────────────────────────
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' });
}

export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function skeletonCards(n = 3) {
  return Array.from({ length: n }, () => `
    <div class="bg-white rounded-2xl shadow-sm p-5 animate-pulse space-y-3">
      <div class="h-4 bg-slate-200 rounded w-1/3"></div>
      <div class="h-6 bg-slate-200 rounded w-2/3"></div>
      <div class="h-4 bg-slate-200 rounded w-1/2"></div>
      <div class="h-4 bg-slate-200 rounded w-1/4"></div>
    </div>`).join('');
}

export function emptyState({ icon = '📭', title = 'Nothing here', text = '', action = '' } = {}) {
  return `
    <div class="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div class="text-5xl mb-4">${icon}</div>
      <h3 class="text-xl font-semibold text-ink mb-1">${escapeHtml(title)}</h3>
      ${text   ? `<p class="text-muted mb-4">${escapeHtml(text)}</p>` : ''}
      ${action ? action : ''}
    </div>`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer;
export function toast(message, type = 'info') {
  let el = document.getElementById('toast-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-root';
    el.className = 'fixed bottom-4 right-4 z-[200] max-w-sm w-full';
    document.body.appendChild(el);
  }

  const colors = {
    success: 'bg-emerald-600 text-white',
    error:   'bg-red-600 text-white',
    info:    'bg-brand-600 text-white',
    warning: 'bg-amber-500 text-white',
  };

  el.innerHTML = `
    <div class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg ${colors[type] || colors.info} animate-slide-up">
      <span class="flex-1 text-sm font-medium">${escapeHtml(message)}</span>
      <button onclick="this.parentElement.parentElement.innerHTML=''" class="opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
    </div>`;

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { if (el) el.innerHTML = ''; }, 4000);
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function openModal(html) {
  let overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div id="modal-box" role="dialog" aria-modal="true"
         class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative animate-scale-in">
      <button id="modal-close-btn" aria-label="Close modal"
              class="absolute top-4 right-4 text-muted hover:text-ink text-2xl leading-none z-10">&times;</button>
      ${html}
    </div>`;
  overlay.style.display = 'flex';

  const close = () => closeModal();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.getElementById('modal-close-btn')?.addEventListener('click', close);
  document.addEventListener('keydown', _escHandler);

  // focus first input
  setTimeout(() => overlay.querySelector('input,select,textarea,button')?.focus(), 50);
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';
  document.removeEventListener('keydown', _escHandler);
}

function _escHandler(e) { if (e.key === 'Escape') closeModal(); }

// ─── Auth guards ──────────────────────────────────────────────────────────────
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = `index.html?next=${encodeURIComponent(location.pathname + location.search)}`;
    throw new Error('Not authenticated');
  }
  return session;
}

export async function requireAdmin() {
  const profile = await getProfile();
  if (!profile || profile.role !== 'admin') {
    toast('Admin access required.', 'error');
    setTimeout(() => { window.location.href = 'events.html'; }, 1500);
    throw new Error('Not admin');
  }
  return profile;
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
export async function renderNavbar({ showModuleLinks = true } = {}) {
  const target = document.getElementById('navbar');
  if (!target) return;

  const session = await getSession();
  const profile = session ? await getProfile() : null;
  const isAdmin = profile?.role === 'admin';
  const currentPage = location.pathname.split('/').pop() || 'home.html';

  const navLink = (href, label) => {
    const active = currentPage === href ? 'text-brand-600 font-semibold' : 'text-ink hover:text-brand-600';
    return `<a href="${href}" class="${active} transition-colors">${label}</a>`;
  };

  target.innerHTML = `
    <nav class="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <a href="home.html" class="flex shrink-0 items-center">
            <img src="CityUniLogo.jpeg" alt="City University" class="h-16 w-40 object-contain">
            ${USE_MOCK ? '<span class="ml-2 text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Mock data</span>' : ''}
          </a>

          <!-- Desktop links -->
          ${showModuleLinks ? `
            <div class="hidden md:flex items-center gap-6 text-sm font-medium">
              ${navLink('events.html',    'Events')}
              ${navLink('resources.html', 'Resources')}
              ${isAdmin ? navLink('scan.html', '📷 Scan') : ''}
            </div>
          ` : ''}

          <!-- Auth area -->
          <div class="flex items-center gap-3">
            ${profile ? `
              <div class="relative group hidden md:block">
                <button class="flex items-center gap-2 bg-surface border border-slate-200 rounded-full px-3 py-1.5 text-sm hover:shadow-sm transition" id="avatar-btn">
                  <span class="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">
                    ${escapeHtml(profile.full_name?.[0]?.toUpperCase() || 'U')}
                  </span>
                  <span class="font-medium text-ink max-w-[120px] truncate">${escapeHtml(profile.full_name || 'User')}</span>
                  <svg class="w-3 h-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
                <div class="absolute right-0 top-full z-50 hidden pt-2 group-hover:block group-focus-within:block">
                  <div class="w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1">
                    <div class="px-4 py-2 text-xs text-muted border-b">${escapeHtml(profile.department || '')} ${isAdmin ? '· Admin' : ''}</div>
                    <button id="logout-btn" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition">Sign out</button>
                  </div>
                </div>
              </div>
            ` : `
              <a href="index.html" class="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-700 transition">Sign in</a>
            `}

            <!-- Mobile hamburger -->
            <button id="mobile-menu-btn" class="md:hidden p-2 rounded-lg hover:bg-slate-100 transition" aria-label="Open menu">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile menu -->
      <div id="mobile-menu" class="hidden md:hidden border-t border-slate-100 bg-white px-4 pb-4 pt-2 space-y-1">
        ${showModuleLinks ? `
          <a href="events.html" class="block py-2 text-sm font-medium text-ink hover:text-brand-600">Events</a>
          <a href="resources.html" class="block py-2 text-sm font-medium text-ink hover:text-brand-600">Resources</a>
          ${isAdmin ? '<a href="scan.html" class="block py-2 text-sm font-medium text-ink hover:text-brand-600">📷 Scan</a>' : ''}
        ` : ''}
        ${profile
          ? `<button id="logout-btn-mobile" class="block w-full text-left py-2 text-sm font-medium text-red-600 hover:text-red-700">Sign out</button>`
          : `<a href="index.html" class="block py-2 text-sm font-medium text-brand-600">Sign in</a>`
        }
      </div>
    </nav>`;

  // Event bindings
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.toggle('hidden');
  });

  const doLogout = async () => {
    await signOut();
    window.location.href = 'index.html';
  };
  document.getElementById('logout-btn')?.addEventListener('click', doLogout);
  document.getElementById('logout-btn-mobile')?.addEventListener('click', doLogout);
}
