const REQUEST_TIMEOUT_MS = 10000;
const LEADERBOARD_CACHE_MS = 15_000;

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
//
// Public endpoints deliberately omit the guest/auth headers. Besides avoiding
// unnecessary Supabase session work, this keeps cross-origin GETs "simple" so
// the browser does not spend an extra round trip on a CORS preflight. That is
// especially important for the first health probe and leaderboard paint.
async function request(path, options = {}) {
  const {
    public: isPublic = false,
    timeoutMs = REQUEST_TIMEOUT_MS,
    headers: suppliedHeaders,
    ...fetchOptions
  } = options;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const identityHeaders = isPublic
      ? {}
      : {
          // X-Guest-Id scopes guest data to THIS device. Without it every guest
          // shared one server-side store and saw the same dashboard/analytics.
          'X-Guest-Id': guestId(),
          ...(await authHeaders())
        };
    const headers = { ...identityHeaders, ...(suppliedHeaders || {}) };
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      ...(Object.keys(headers).length ? { headers } : {}),
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`api ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// The board is public and changes only when a qualifying run lands. Keeping a
// very short in-memory cache makes the BOARDS tab instant after its startup
// warm-up, while the view still force-refreshes for polls and WebSocket pushes.
let leaderboardCache = null;
let leaderboardRequest = null;
let leaderboardGeneration = 0;

function cachedLeaderboard() {
  if (!leaderboardCache || Date.now() - leaderboardCache.updatedAt >= LEADERBOARD_CACHE_MS) return null;
  return leaderboardCache;
}

function loadLeaderboard({ force = false } = {}) {
  const cached = cachedLeaderboard();
  if (!force && cached) return Promise.resolve(cached.data);
  if (leaderboardRequest) return leaderboardRequest;

  const generation = leaderboardGeneration;
  let requestPromise;
  requestPromise = request('/api/leaderboard', {
    public: true,
    // A forced refresh must bypass an HTTP cache after a live score event.
    cache: force ? 'no-store' : 'default'
  }).then(
    (data) => {
      // An old request that settles after a newly saved score must not repopulate
      // the cache with pre-score data.
      if (generation === leaderboardGeneration) leaderboardCache = { data, updatedAt: Date.now() };
      if (leaderboardRequest === requestPromise) leaderboardRequest = null;
      return data;
    },
    (error) => {
      if (leaderboardRequest === requestPromise) leaderboardRequest = null;
      throw error;
    }
  );
  leaderboardRequest = requestPromise;
  return requestPromise;
}

export function readCachedLeaderboard() {
  return cachedLeaderboard();
}

export function prefetchLeaderboard() {
  return loadLeaderboard().catch(() => null);
}

export function invalidateLeaderboardCache() {
  leaderboardGeneration += 1;
  leaderboardCache = null;
  // Do not reuse an in-flight response after a newly saved score; a fresh
  // viewer/poll should ask for the latest board instead.
  leaderboardRequest = null;
}

export const api = {
  async health() {
    return request('/api/health', { public: true, cache: 'no-store' });
  },
  async snippets({ mode, language, q, limit = 100, offset = 0 } = {}) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (mode) params.set('mode', mode);
    if (language) params.set('language', language);
    if (q) params.set('q', q);
    return request(`/api/snippets?${params.toString()}`, { public: true });
  },
  async snippet(id) {
    return request(`/api/snippets/${encodeURIComponent(id)}`, { public: true });
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
  async leaderboard({ force = false } = {}) {
    return loadLeaderboard({ force });
  },
  async leaderboardMeta() {
    return request('/api/leaderboard/meta', { public: true });
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
