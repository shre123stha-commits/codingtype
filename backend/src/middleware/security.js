// Lightweight security headers + body-size enforcement (no helmet dependency).
// Applied to every response by server.js. See SECURITY_AUDIT.md for the
// threat model behind each one.
export function securityHeaders(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  // The API is JSON-only: it must never execute script, embed frames, or be
  // embedded. base-uri / form-action are locked down for good measure.
  res.set(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  );
  // This service holds no reusable secrets — a cached auth response would be a
  // bug, not a feature.
  res.set('Cache-Control', 'no-store');
  // Keep responses out of cross-origin embedders entirely.
  res.set('Cross-Origin-Resource-Policy', 'same-origin');
  next();
}

// Reject oversized bodies with a 413 before they are parsed.
//
// A declared Content-Length is checked up front (cheap, and it is what every
// well-behaved client sends). When the client omits it and uses chunked
// encoding, express.json's own `limit` takes over and throws entity.too.large,
// which middleware/error.js turns into the same 413. We deliberately do NOT
// attach a 'data' listener here — doing so would put the request stream into
// flowing mode and race express.json for the bytes.
//
// Slow/chunked sockets are bounded at the server level instead, via
// requestTimeout / headersTimeout / timeout (see server.js).
export function bodySizeGuard(limitBytes = 1024 * 1024) {
  return function guard(req, res, next) {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limitBytes) {
      res.set('Connection', 'close');
      return res.status(413).json({ error: 'payload_too_large' });
    }
    return next();
  };
}
