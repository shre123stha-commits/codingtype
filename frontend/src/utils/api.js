const REQUEST_TIMEOUT_MS = 10000;

import { API_BASE } from './env.js';
import { supabase } from './supabase.js';

// When signed in, tag every API call with the Supabase JWT so the backend
// reads/writes that user's cloud data instead of the local file.
async function authHeaders() {
  if (!supabase) return {};
  try {
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
      headers: { ...(await authHeaders()), ...(options.headers || {}) },
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
  async snippets({ mode, language } = {}) {
    const params = new URLSearchParams();
    if (mode) params.set('mode', mode);
    if (language) params.set('language', language);
    return request(`/api/snippets?${params.toString()}`);
  },
  async snippet(id) {
    return request(`/api/snippets/${encodeURIComponent(id)}`);
  },
  async saveSession(payload) {
    return request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },
  async sessions(limit = 12) {
    return request(`/api/sessions?limit=${limit}`);
  },
  async pbests({ mode, language } = {}) {
    const params = new URLSearchParams();
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
  async pbestSnippets() {
    return request('/api/sessions/pbest-snippets');
  },
  async daily() {
    return request('/api/daily');
  },
  async adaptive() {
    return request('/api/drills/adaptive');
  }
};
