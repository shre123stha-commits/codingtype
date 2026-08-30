// Per-device guest identity.
//
// Without this, every guest on the planet wrote into ONE shared server-side
// store, so all guests saw the same dashboard, analytics and streaks. Each
// browser now mints its own id (stored in localStorage) and sends it as
// X-Guest-Id; the backend scopes that device's data to it.
//
// This is a device id, not an account: clearing site data starts a fresh
// guest. Signing in moves you onto your Supabase rows instead.
const KEY = 'codetype-guest-id';

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for very old browsers / non-secure contexts.
  return 'g-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cached = null;

export function guestId() {
  if (cached) return cached;
  try {
    let id = localStorage.getItem(KEY);
    if (!id || id.length > 64) {
      id = uuid();
      localStorage.setItem(KEY, id);
    }
    cached = id;
  } catch {
    // Storage blocked (private mode) — use an in-memory id for this tab only.
    cached = uuid();
  }
  return cached;
}

// Short public tag used on the leaderboards so two guests are never both
// just "GUEST". Derived from the device id, not reversible to anything.
export function guestTag(id = guestId()) {
  const clean = String(id).replace(/[^a-z0-9]/gi, '').toUpperCase();
  return `GUEST-${(clean.slice(0, 4) || '0000').padEnd(4, '0')}`;
}
