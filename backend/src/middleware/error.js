// Central error handling. Nothing internal (stack traces, driver messages,
// env values) is ever returned to the client — only a stable machine-readable
// code. Full details go to the server log.
export function notFound(req, res) {
  res.status(404).json({ error: 'not_found', path: String(req.originalUrl || '').slice(0, 200) });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // CORS rejection (origin not in the allowlist) → 403, no body detail.
  if (err && err.message === 'cors_origin_not_allowed') {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }

  // Malformed JSON body → client error, not a 500. Narrowed to body-parser's
  // own signal so a genuine SyntaxError in our code is not masked as a 400.
  if (err && (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.body !== undefined))) {
    return res.status(400).json({ error: 'invalid_json' });
  }

  // Body too large (thrown by express.json for chunked bodies, and by
  // bodySizeGuard for explicit Content-Length values).
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'payload_too_large' });
  }

  // Wrong content-type / unsupported encoding — a client bug, not a crash.
  if (err && (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported')) {
    return res.status(415).json({ error: 'unsupported_media_type' });
  }

  console.error('[codetype-api] unhandled error', err);
  return res.status(500).json({ error: 'internal_error' });
}
