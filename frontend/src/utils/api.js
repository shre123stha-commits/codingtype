async function request(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(`api ${res.status}`);
  return res.json();
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
  async daily() {
    return request('/api/daily');
  },
  async adaptive() {
    return request('/api/drills/adaptive');
  }
};
