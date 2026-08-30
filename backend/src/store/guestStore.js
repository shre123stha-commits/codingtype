// Per-guest persistence.
//
// Every guest browser gets its OWN store file, keyed by the X-Guest-Id it
// sends. Before this, all guests shared backend/data/db.json, which is why
// every guest saw the same dashboard, analytics and streak.
//
// The id is validated as a UUID-ish token BEFORE it ever touches a path, so a
// hostile header cannot traverse out of the data directory. The directory is
// capped so a flood of fresh ids can't fill the disk: when it is full, the
// least-recently-touched guest files are evicted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '../../data/guests');
const MAX_SESSIONS = 500; // per guest
const MAX_GUESTS = 5000; // hard cap on stored guest files

// A UUID (v4 from the client) or the g-prefixed fallback form. Anything else
// is rejected outright.
export const GUEST_ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/;

export function isGuestId(id) {
  return typeof id === 'string' && GUEST_ID_RE.test(id) && !id.includes('..') && !id.includes('/');
}

const caches = new Map(); // id -> { sessions: [] }

function fileFor(id) {
  return path.join(dir, `${id}.json`);
}

function load(id) {
  const hit = caches.get(id);
  if (hit) return hit;
  let parsed = { sessions: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(fileFor(id), 'utf8'));
    if (raw && Array.isArray(raw.sessions)) parsed = { sessions: raw.sessions.slice(0, MAX_SESSIONS) };
  } catch {
    /* first run for this guest */
  }
  // keep the in-memory cache bounded too
  if (caches.size > 500) {
    const oldest = caches.keys().next();
    if (!oldest.done) caches.delete(oldest.value);
  }
  caches.set(id, parsed);
  return parsed;
}

function evictIfNeeded() {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  if (names.length <= MAX_GUESTS) return;
  const withTime = names
    .map((n) => {
      try {
        return { n, t: fs.statSync(path.join(dir, n)).mtimeMs };
      } catch {
        return { n, t: 0 };
      }
    })
    .sort((a, b) => a.t - b.t);
  const remove = withTime.slice(0, names.length - MAX_GUESTS);
  for (const { n } of remove) {
    try {
      fs.unlinkSync(path.join(dir, n));
      caches.delete(n.replace(/\.json$/, ''));
    } catch {
      /* best effort */
    }
  }
}

const queues = new Map(); // id -> promise chain (serialises writes per guest)

function persist(id, cache) {
  const prev = queues.get(id) || Promise.resolve();
  const next = prev
    .then(
      () =>
        new Promise((resolve) => {
          fs.mkdirSync(dir, { recursive: true });
          const file = fileFor(id);
          const tmp = `${file}.tmp`;
          fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
          fs.renameSync(tmp, file); // atomic
          resolve();
        })
    )
    .catch((err) => console.error('[codetype-api] guest persist failed', err?.message || err));
  queues.set(id, next);
  return next;
}

/** Store for one guest device. Same interface as the shared local store. */
export function guestStoreFor(id) {
  return {
    kind: 'guest',
    async all() {
      return load(id).sessions;
    },
    async query(opts = {}) {
      let rows = load(id).sessions;
      if (opts.snippetId) rows = rows.filter((r) => r.snippetId === opts.snippetId);
      if (opts.mode) rows = rows.filter((r) => r.mode === opts.mode);
      if (opts.language) rows = rows.filter((r) => r.language === opts.language);
      if (opts.daily !== undefined) rows = rows.filter((r) => Boolean(r.daily) === Boolean(opts.daily));
      if (opts.since) rows = rows.filter((r) => r.createdAt < opts.since);
      if (opts.before) rows = rows.filter((r) => r.createdAt > opts.before);
      if (opts.offset) rows = rows.slice(opts.offset);
      if (opts.limit) rows = rows.slice(0, opts.limit);
      return rows;
    },
    async insert(row) {
      const cache = load(id);
      cache.sessions.unshift(row);
      if (cache.sessions.length > MAX_SESSIONS) cache.sessions.length = MAX_SESSIONS;
      evictIfNeeded();
      await persist(id, cache);
      return row;
    }
  };
}
