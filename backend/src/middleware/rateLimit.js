// Minimal in-memory rate limiter (no external dependency).
//
// Keys on client IP (plus a user-provided identifier for the strict/auth
// bucket) so one client can't dodge a limit by rotating a header. Tracks are
// pruned lazily so the map never grows without bound.
//
//   createRateLimiter({ windowMs, max, keyFn }) -> express middleware
//
// When the limit is exceeded the middleware responds 429 with a Retry-After
// header and a machine-readable error. For a multi-instance deploy, swap the
// in-memory Map for a shared store (Redis / Supabase) — see SECURITY_AUDIT.md.

function now() {
  return Date.now();
}

export function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, keyFn = null, message = 'too_many_requests' }) {
  const hits = new Map(); // key -> { count, resetAt }

  const prune = (ts) => {
    if (hits.size < 10000) return;
    for (const [k, v] of hits) if (v.resetAt <= ts) hits.delete(k);
  };

  return function rateLimit(req, res, next) {
    const ts = now();
    prune(ts);

    let key;
    try {
      key =
        (keyFn && keyFn(req)) ||
        `${req.ip || req.socket?.remoteAddress || 'unknown'}|${req.method}|${req.path || req.originalUrl}`;
    } catch {
      key = req.ip || 'unknown';
    }

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= ts) {
      entry = { count: 0, resetAt: ts + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - ts) / 1000));
      res.set('Retry-After', String(retryAfterSec));
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', '0');
      return res.status(429).json({ error: message, retryAfterSec });
    }

    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    return next();
  };
}
