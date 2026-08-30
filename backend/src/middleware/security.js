// Lightweight security headers (no helmet dependency). Applied to every
// response by server.js. See SECURITY_AUDIT.md for the full threat model.
export function securityHeaders(req, res, next) {
  // The marketing pages are plain server-rendered-free SPA views; the API is
  // JSON-only, so nothing here should ever be framed or sniffed.
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // HSTS is only set behind TLS; add it at the proxy (Vercel/Render) instead.
  next();
}

// Reject oversized bodies with a 413 before express.json even parses them.
// Matches the JSON parser limit so the error is consistent and cheap.
export function bodySizeGuard(limitBytes = 1024 * 1024) {
  return function guard(req, res, next) {
    const len = Number(req.headers['content-length']);
    if (Number.isFinite(len) && len > limitBytes) {
      return res.status(413).json({ error: 'payload_too_large' });
    }
    next();
  };
}
