// Where the API lives.
//
// Same-origin by default — local dev proxies /api to the backend via Vite,
// and a single-host deploy needs no config. For a split deploy
// (frontend on Vercel + API on Render), set ONE env var in the frontend:
//
//   VITE_API_URL=https://<your-app>.onrender.com
//
// (Vercel: Project → Settings → Environment Variables. Vite inlines
// VITE_-prefixed vars at build time, so the app needs no runtime config.)
// import.meta.env is Vite-only — guard for plain-Node consumers (scripts).
const raw = (import.meta.env ?? {}).VITE_API_URL || '';
export const API_BASE = raw.replace(/\/+$/, '');

export const apiUrl = (path) => `${API_BASE}${path}`;

// WebSocket endpoint — wss in production, ws locally, following the API base.
export function wsUrl() {
  if (API_BASE) return `${API_BASE.replace(/^http/, 'ws')}/api/ws`;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/api/ws`;
}
