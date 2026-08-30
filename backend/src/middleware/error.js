export function notFound(req, res) {
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // Malformed JSON body -> client error, not a 500.
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ error: 'invalid_json' });
  }
  // Body too large (thrown by the JSON parser when content-length is absent
  // or chunked, and by bodySizeGuard for explicit lengths).
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'payload_too_large' });
  }

  console.error('[codetype-api] unhandled error', err);
  res.status(500).json({ error: 'internal_error' });
}
