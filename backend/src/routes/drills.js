import { Router } from 'express';

import { storeFor } from '../store/supaStore.js';
import { queryInt } from '../middleware/sanitize.js';

const router = Router();

const ah = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error('[codetype-api] handler error', err);
    if (!res.headersSent) res.status(502).json({ error: 'store_error' });
  });
};

const DEFAULT_SYMBOLS = [';', '}', '=>'];

router.get('/adaptive', ah(async (req, res) => {
  const limit = queryInt(req.query.limit, { min: 1, max: 1000, fallback: 500 });
  const rows = await (await storeFor(req)).query({ limit });
  const agg = {};
  for (const s of rows) {
    for (const [sym, v] of Object.entries(s.symbolStats || {})) {
      const cur = agg[sym] || { t: 0, e: 0 };
      cur.t += Number(v?.t) || 0;
      cur.e += Number(v?.e) || 0;
      agg[sym] = cur;
    }
  }
  const withErrors = Object.entries(agg)
    .map(([key, v]) => ({ key, t: v.t, e: v.e }))
    .filter((v) => v.e > 0)
    .sort((a, b) => b.e - a.e || b.t - a.t)
    .slice(0, 3);
  const symbols = withErrors.length ? withErrors : DEFAULT_SYMBOLS.map((key) => ({ key, t: 0, e: 0 }));
  res.json({ symbols, adaptive: withErrors.length > 0, scanned: rows.length, truncated: rows.length >= limit });
}));

export default router;
