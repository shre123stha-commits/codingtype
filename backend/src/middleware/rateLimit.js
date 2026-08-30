// Rate limiting for the API and the race WebSocket.
//
// In-memory fixed-window limiter with NO external dependency. Keys on the real
// client IP (never on anything the client can spoof — see clientIp()), plus an
// optional per-account identifier so one logged-in user can't share a bucket
// with a whole NAT.
//
//   createRateLimiter({ windowMs, max, message, keyFn }) -> express middleware
//
// Hardened against the obvious bypasses:
//   • bounded store: the Map can never grow past MAX_TRACKS, so a client
//     rotating URLs to mint new keys cannot exhaust server memory
//   • periodic sweep of expired tracks (unref'd, so it never holds the
//     process open)
//   • 429 + Retry-After + X-RateLimit-* on every response
//
// For a multi-instance / serverless deploy swap the Map for a shared store
// (Redis, Upstash, or a Supabase table) — the interface is store-shaped on
// purpose. See SECURITY_AUDIT.md §4.

const MAX_TRACKS = 20000; // hard ceiling on tracked keys (memory bound)

function now() {
  return Date.now();
}

// Express with `trust proxy: <hops>` populates req.ip from the *trusted*
// X-Forwarded-For chain. We deliberately do NOT trust the raw header here:
// reading it directly lets any client forge an IP and walk around every limit.
export function clientIp(req) {
  const ip = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
  // normalize IPv4-mapped IPv6 (::ffff:1.2.3.4 → 1.2.3.4) so the same client
  // can't hold two buckets
  return String(ip).replace(/^::ffff:/, '');
}

function createStore() {
  const hits = new Map(); // key -> { count, resetAt }
  const sweep = setInterval(() => {
    const ts = now();
    for (const [k, v] of hits) if (v.resetAt <= ts) hits.delete(k);
  }, 60000);
  sweep.unref?.();

  return {
    get size() {
      return hits.size;
    },
    hit(key, ts, windowMs) {
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= ts) {
        // evict the oldest track when full so growth is strictly bounded
        if (hits.size >= MAX_TRACKS) {
          const oldest = hits.keys().next();
          if (!oldest.done) hits.delete(oldest.value);
        }
        entry = { count: 0, resetAt: ts + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      return entry;
    }
  };
}

export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 100,
  keyFn = null,
  message = 'too_many_requests',
  store = null
}) {
  const bucket = store || createStore();

  return function rateLimit(req, res, next) {
    const ts = now();

    let key;
    try {
      // Path without the query string: a client must not be able to mint a
      // fresh bucket per request by appending ?n=1, ?n=2, …
      const path = String(req.originalUrl || req.path || '/').split('?')[0];
      key = (keyFn && keyFn(req)) || `${clientIp(req)}|${req.method}|${path}`;
    } catch {
      key = `${clientIp(req)}|${req.method}`;
    }

    const entry = bucket.hit(key, ts, windowMs);
    const remaining = Math.max(0, max - entry.count);

    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - ts) / 1000));
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: message, retryAfterSec });
    }
    return next();
  };
}

// ── WebSocket guard ────────────────────────────────────────────────────────
// Sockets aren't HTTP requests, so they get their own counters: a cap on
// simultaneous connections per IP, on rooms created per IP, and on messages
// per socket. All three are what stopped the "open 10k sockets" case.
export function createWsGuard({
  maxConnectionsPerIp = 6,
  maxCreatesPerIpPer15Min = 30,
  maxMessagesPerMin = 240
} = {}) {
  const conns = new Map(); // ip -> count
  const creates = new Map(); // ip -> { count, resetAt }
  const WINDOW = 15 * 60 * 1000;

  const sweep = setInterval(() => {
    const ts = now();
    for (const [k, v] of creates) if (v.resetAt <= ts) creates.delete(k);
  }, 60000);
  sweep.unref?.();

  return {
    canConnect(ip) {
      return (conns.get(ip) || 0) < maxConnectionsPerIp;
    },
    connected(ip) {
      conns.set(ip, (conns.get(ip) || 0) + 1);
    },
    disconnected(ip) {
      const n = (conns.get(ip) || 1) - 1;
      if (n <= 0) conns.delete(ip);
      else conns.set(ip, n);
    },
    canCreate(ip) {
      const ts = now();
      let e = creates.get(ip);
      if (!e || e.resetAt <= ts) {
        e = { count: 0, resetAt: ts + WINDOW };
        creates.set(ip, e);
      }
      e.count += 1;
      return e.count <= maxCreatesPerIpPer15Min;
    },
    // per-socket token bucket, refilled continuously
    newMessageBudget() {
      return { tokens: maxMessagesPerMin, last: now(), max: maxMessagesPerMin };
    },
    allowMessage(budget) {
      const ts = now();
      const elapsedMin = (ts - budget.last) / 60000;
      budget.last = ts;
      budget.tokens = Math.min(budget.max, budget.tokens + elapsedMin * budget.max);
      if (budget.tokens < 1) return false;
      budget.tokens -= 1;
      return true;
    }
  };
}
