const REQUEST_TIMEOUT_MS = 10000;

import { API_BASE } from './env.js';
import { guestId } from './guestId.js';
import { authAvailable, getSupabase, hasStoredSession } from './supabase.js';

// When signed in, tag every API call with the Supabase JWT so the backend
// reads/writes that user's cloud data instead of the local file.
//
// Guests skip this entirely: `hasStoredSession()` is a synchronous
// localStorage probe, so the 208 kB Supabase SDK is never downloaded (or even
// requested) unless a session actually exists.
async function authHeaders() {
  if (!authAvailable || !hasStoredSession()) return {};
  try {
    const supabase = await getSupabase();
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  } catch {
    return {};
  }
}

// Hard timeout: a hung proxy (API process died mid-request) must never leave
// the UI stuck on "SYNCING…" — fail fast, fall back to local, self-heal later.
async function request(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      // X-Guest-Id scopes guest data to THIS device. Without it every guest
      // shared one server-side store and saw the same dashboard/analytics.
      headers: { 'X-Guest-Id': guestId(), ...(await authHeaders()), ...(options.headers || {}) },
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`api ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  async health() {
    return request('/api/health');
  },
  async snippets({ mode, language, q, limit = 100, offset = 0 } = {}) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (mode) params.set('mode', mode);
    if (language) params.set('language', language);
    if (q) params.set('q', q);
    return request(`/api/snippets?${params.toString()}`);
  },
  async snippet(id) {
    return request(`/api/snippets/${encodeURIComponent(id)}`);
  },
  async saveSession(payload) {
    // The response carries { leaderboard: { placements, best } } so the client
    // can celebrate a top-10 finish.
    return request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  async sessions(limit = 12, cursor = null) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', String(cursor));
    return request(`/api/sessions?${params.toString()}`);
  },
  async pbests({ mode, language, limit = 100, offset = 0 } = {}) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (mode) params.set('mode', mode);
    if (language) params.set('language', language);
    return request(`/api/sessions/pbests?${params.toString()}`);
  },
  async summary() {
    return request('/api/sessions/summary');
  },
  async keystats() {
    return request('/api/sessions/keystats');
  },
  async fingerstats() {
    return request('/api/sessions/fingerstats');
  },
  async benchmark(snippetId) {
    return request(`/api/sessions/benchmark/${encodeURIComponent(snippetId)}`);
  },
  async pbest(snippetId) {
    return request(`/api/sessions/pbest/${encodeURIComponent(snippetId)}`);
  },
  async pbestSnippets({ limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return request(`/api/sessions/pbest-snippets?${params.toString()}`);
  },
  async daily() {
    return request('/api/daily');
  },
  async adaptive() {
    return request('/api/drills/adaptive');
  },
  // All 10 boards (5 categories x 2 timeframes) in one request.
  async leaderboard() {
    return request('/api/leaderboard');
  },
  async leaderboardMeta() {
    return request('/api/leaderboard/meta');
  }
};

// ── Pagination walkers ─────────────────────────────────────────────────────
// Every list endpoint is paginated server-side (default 20/page). These two
// helpers walk the pages for the two places that genuinely need a whole set.
// Both are bounded by `maxPages` so no user action can turn into an unbounded
// crawl.

// The snippet catalog (the typing engine needs every language/mode up front).
// 82 snippets fit in a single 100-row page today, so this is one request in
// practice — but it stays correct as the catalog grows.
export async function fetchCatalog({ mode, language, q, maxPages = 10 } = {}) {
  const out = [];
  let offset = 0;
  for (let page = 0; page < maxPages; page += 1) {
    const res = await api.snippets({ mode, language, q, limit: 100, offset });
    out.push(...(res.snippets || []));
    if (!res.hasMore) break;
    offset += res.limit || 100;
  }
  return out;
}

// The session log, cursor-paginated newest-first. Used by the profile flash
// card, which aggregates a career — capped at 5 pages (500 runs).
export async function collectSessions({ limit = 100, maxPages = 5 } = {}) {
  const out = [];
  let cursor = null;
  for (let page = 0; page < maxPages; page += 1) {
    const res = await api.sessions(limit, cursor);
    out.push(...(res.sessions || []));
    if (!res.hasMore || !res.nextCursor) break;
    cursor = res.nextCursor;
  }
  return out;
}
