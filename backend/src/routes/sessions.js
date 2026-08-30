import { Router } from 'express';

import { fingerOf } from '../../../shared/fingers.js';
import { storeFor } from '../store/supaStore.js';
import { bool, isPlainBody, num, queryInt, queryStr, statsMap, str, timings } from '../middleware/sanitize.js';

const router = Router();

// Express 4 doesn't catch rejected promises from async handlers — wrap them
const ah = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error('[codetype-api] handler error', err);
    if (!res.headersSent) res.status(502).json({ error: 'store_error' });
  });
};

// Rows an aggregate endpoint is allowed to read. Bounded so a heavy account
// can't make one request pull an unbounded result set.
const SCAN_MAX = 1000;
const SCAN_DEFAULT = 500;

function scanLimit(req) {
  return queryInt(req.query.limit, { min: 1, max: SCAN_MAX, fallback: SCAN_DEFAULT });
}

function sessionShape(payload) {
  const stats = payload?.stats;
  const snippet = payload?.snippet;
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    mode: str(payload?.mode || stats?.mode || 'unknown', 24, 'unknown'),
    language: str(payload?.language || stats?.language || 'unknown', 24, 'unknown'),
    snippetId: str(snippet?.id || 'unknown', 40, 'unknown'),
    snippetTitle: str(snippet?.title || 'unknown', 80, 'unknown'),
    snippetSource: str(snippet?.source || '', 120),
    // Every number is coerced AND clamped: a client claiming 1e9 WPM or a
    // negative char count must not poison the aggregates or the leaderboards.
    wpm: num(stats?.wpm, { min: 0, max: 600 }),
    rawWpm: num(stats?.rawWpm, { min: 0, max: 1200 }),
    accuracy: num(stats?.accuracy, { min: 0, max: 100 }),
    consistency: num(stats?.consistency, { min: 0, max: 100 }),
    timeSec: num(stats?.timeSec, { min: 0, max: 86400 }),
    errors: num(stats?.errors, { min: 0, max: 1e6 }),
    backspaces: num(stats?.backspaces, { min: 0, max: 1e6 }),
    chars: num(stats?.chars, { min: 0, max: 1e6 }),
    // Rebuilt key-by-key: prototype-pollution keys are dropped, key count and
    // key length are capped, and values are coerced to finite numbers.
    symbolStats: statsMap(payload?.symbolStats, { maxKeys: 128, maxKeyLen: 8 }),
    lineStats: statsMap(payload?.lineStats, { maxKeys: 400, maxKeyLen: 8 }),
    charStats: statsMap(payload?.charStats, { maxKeys: 160, maxKeyLen: 8 }),
    charTimes: timings(payload?.charTimes, { max: 2000, maxT: 86400 }),
    daily: bool(payload?.daily)
  };
}

router.post('/', ah(async (req, res) => {
  if (!isPlainBody(req.body)) {
    return res.status(400).json({ error: 'invalid_payload' });
  }
  const row = sessionShape(req.body);
  const store = await storeFor(req);
  await store.insert(row);
  res.status(201).json({ id: row.id, createdAt: row.createdAt, store: store.kind });
}));

// ── Cursor-based pagination (newest-first by createdAt) ────────────────────
// `cursor` is the createdAt of the last row on the previous page; pass it back
// to get the next page. `hasMore` is decided by over-fetching one row.
// Cursor (not offset) pagination: this is the big, monotonically-appended
// table, so OFFSET would get slower on every page while a keyset scan stays
// O(page). Response: { sessions, nextCursor, hasMore, limit }
router.get('/', ah(async (req, res) => {
  const store = await storeFor(req);
  const limit = queryInt(req.query.limit, { min: 1, max: 100, fallback: 20 });
  const since = Number(req.query.cursor);
  const rows = await store.query({
    since: Number.isFinite(since) && since > 0 ? since : undefined,
    limit: limit + 1 // +1 so we can tell whether another page exists
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = page.length ? page[page.length - 1].createdAt : null;
  res.json({ sessions: page, nextCursor: hasMore ? nextCursor : null, hasMore, limit });
}));

router.get('/keystats', ah(async (req, res) => {
  const limit = scanLimit(req);
  const rows = await (await storeFor(req)).query({ limit });
  const chars = {};
  for (const s of rows) {
    for (const [ch, v] of Object.entries(s.charStats || {})) {
      const cur = chars[ch] || { t: 0, e: 0 };
      cur.t += Number(v?.t) || 0;
      cur.e += Number(v?.e) || 0;
      chars[ch] = cur;
    }
  }
  res.json({ chars, scanned: rows.length, limit, truncated: rows.length >= limit });
}));

router.get('/fingerstats', ah(async (req, res) => {
  const limit = scanLimit(req);
  const rows = await (await storeFor(req)).query({ limit });
  const fingers = {};
  for (const s of rows) {
    for (const [ch, v] of Object.entries(s.charStats || {})) {
      const f = fingerOf(ch);
      if (!f) continue;
      const cur = fingers[f] || { t: 0, e: 0 };
      cur.t += Number(v?.t) || 0;
      cur.e += Number(v?.e) || 0;
      fingers[f] = cur;
    }
  }
  res.json({ fingers, scanned: rows.length, limit, truncated: rows.length >= limit });
}));

router.get('/benchmark/:snippetId', ah(async (req, res) => {
  const id = queryStr(req.params.snippetId, 80);
  if (!id) return res.status(400).json({ error: 'invalid_snippet_id' });
  // Filter pushed to the store (`.eq('snippet_id', …)`) — one targeted query
  // backed by sessions_user_snippet_idx, never a load-everything + JS filter.
  const times = (await (await storeFor(req)).query({ snippetId: id, limit: SCAN_MAX }))
    .filter((s) => s.timeSec > 0)
    .map((s) => s.timeSec)
    .sort((a, b) => a - b);
  if (!times.length) return res.status(404).json({ error: 'no_runs' });
  res.json({
    median: Math.round(times[Math.floor((times.length - 1) / 2)] * 10) / 10,
    best: Math.round(times[0] * 10) / 10,
    count: times.length
  });
}));

router.get('/pbest/:snippetId', ah(async (req, res) => {
  const id = queryStr(req.params.snippetId, 80);
  if (!id) return res.status(400).json({ error: 'invalid_snippet_id' });
  let best = null;
  for (const s of await (await storeFor(req)).query({ snippetId: id, limit: SCAN_MAX })) {
    if (!Array.isArray(s.charTimes) || !s.charTimes.length || !s.timeSec) continue;
    if (!best || s.timeSec < best.timeSec) best = s;
  }
  if (!best) return res.status(404).json({ error: 'no_pb' });
  res.json({
    wpm: best.wpm,
    timeSec: best.timeSec,
    accuracy: best.accuracy,
    charTimes: best.charTimes,
    createdAt: best.createdAt
  });
}));

// ── Offset-based pagination ────────────────────────────────────────────────
// Group-by-snippet aggregation (bounded by the number of snippets a user has
// ever typed — tens, not millions), so OFFSET is the right fit here: cheap,
// and it lets the client jump around. Default 20 per page.
// Response: { snippets, total, limit, offset, hasMore }
router.get('/pbest-snippets', ah(async (req, res) => {
  const best = new Map();
  const rows = await (await storeFor(req)).query({ limit: SCAN_MAX });
  for (const s of rows) {
    if (!s.snippetId || s.snippetId === 'unknown' || !Array.isArray(s.charTimes) || !s.charTimes.length || !s.timeSec) continue;
    const cur = best.get(s.snippetId);
    if (!cur || s.timeSec < cur.timeSec) {
      best.set(s.snippetId, {
        snippetId: s.snippetId,
        title: s.snippetTitle,
        source: s.snippetSource,
        mode: s.mode,
        language: s.language,
        wpm: s.wpm,
        timeSec: s.timeSec,
        accuracy: s.accuracy,
        createdAt: s.createdAt
      });
    }
  }
  const all = [...best.values()].sort((a, b) => b.createdAt - a.createdAt);
  const limit = queryInt(req.query.limit, { min: 1, max: 100, fallback: 20 });
  const offset = queryInt(req.query.offset, { min: 0, max: 100000, fallback: 0 });
  const slice = all.slice(offset, offset + limit);
  res.json({
    snippets: slice,
    total: all.length,
    limit,
    offset,
    hasMore: offset + slice.length < all.length
  });
}));

router.get('/pbests', ah(async (req, res) => {
  const mode = queryStr(req.query.mode, 24);
  const language = queryStr(req.query.language, 24);
  const best = new Map();
  // mode/language filters pushed to the store (.eq) — one indexed query.
  for (const s of await (await storeFor(req)).query({
    mode: mode || undefined,
    language: language || undefined,
    limit: SCAN_MAX
  })) {
    const key = `${s.mode}|${s.language}`;
    const cur = best.get(key);
    if (!cur || s.wpm > cur.wpm) {
      best.set(key, {
        mode: s.mode,
        language: s.language,
        wpm: s.wpm,
        rawWpm: s.rawWpm,
        accuracy: s.accuracy,
        snippetTitle: s.snippetTitle,
        timeSec: s.timeSec,
        createdAt: s.createdAt
      });
    }
  }
  const all = [...best.values()].sort((a, b) => b.wpm - a.wpm);
  const limit = queryInt(req.query.limit, { min: 1, max: 100, fallback: 20 });
  const offset = queryInt(req.query.offset, { min: 0, max: 100000, fallback: 0 });
  const slice = all.slice(offset, offset + limit);
  res.json({ pbests: slice, total: all.length, limit, offset, hasMore: offset + slice.length < all.length });
}));

router.get('/summary', ah(async (req, res) => {
  const limit = scanLimit(req);
  const all = await (await storeFor(req)).query({ limit });
  const total = all.length;
  const avgWpm = total ? Math.round(all.reduce((sum, s) => sum + s.wpm, 0) / total) : 0;
  const totalErrors = all.reduce((sum, s) => sum + s.errors, 0);
  const symbolAgg = {};
  for (const s of all) {
    for (const [sym, val] of Object.entries(s.symbolStats || {})) {
      if (!symbolAgg[sym]) symbolAgg[sym] = { t: 0, e: 0 };
      symbolAgg[sym].t += Number(val?.t) || 0;
      symbolAgg[sym].e += Number(val?.e) || 0;
    }
  }
  const friction = Object.entries(symbolAgg)
    .map(([sym, v]) => ({
      symbol: sym,
      typed: v.t,
      errors: v.e,
      rate: v.t ? Math.round((v.e / (v.t + v.e)) * 1000) / 10 : 0
    }))
    .filter((v) => v.t + v.e > 0)
    .sort((a, b) => b.rate - a.rate || b.errors - a.errors)
    .slice(0, 8);
  res.json({
    sessions: total,
    avgWpm,
    totalErrors,
    topFriction: friction,
    scanned: total,
    limit,
    truncated: total >= limit
  });
}));

export default router;
