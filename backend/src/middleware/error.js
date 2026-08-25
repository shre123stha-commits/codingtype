export function notFound(req, res) {
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  console.error('[codetype-api] unhandled error', err);
  res.status(500).json({ error: 'internal_error' });
}
