import { Router } from 'express';

import { fingerOf } from '../../../shared/fingers.js';
import { db } from '../store/fileStore.js';
import { storeFor } from '../store/supaStore.js';

const router = Router();

// Express 4 doesn't catch rejected promises from async handlers — wrap them
const ah = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error('[codetype-api] handler error', err);
    if (!res.headersSent) res.status(502).json({ error: 'store_error' });
  });
};

function sanitizeCharStats(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out = {};
  let count = 0;
  for (const [ch, v] of Object.entries(obj)) {
    if (count >= 160) break;
    out[ch] = { t: Number(v?.t) || 0, e: Number(v?.e) || 0 };
    count += 1;
  }
  return out;
}

function sanitizeCharTimes(arr) {
  if (!Array.isArray(arr)) return [];
  // keep millisecond precision — whole-second rounding made PB ghost replays
  // teleport (all keystrokes inside a second shared one timestamp)
  return arr.slice(0, 2000).map((c) => ({ t: Math.round((Number(c?.t) || 0) * 1000) / 1000, n: Number(c?.n) || 1 }));
}

function sessionShape(payload) {
  const stats = payload?.stats || {};
  const snippet = payload?.snippet || {};
  const row = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    mode: String(payload?.mode || stats.mode || 'unknown').slice(0, 24),
    language: String(payload?.language || stats.language || 'unknown').slice(0, 24),
    snippetId: String(snippet.id || 'unknown').slice(0, 40),
    snippetTitle: String(snippet.title || 'unknown').slice(0, 80),
    snippetSource: String(snippet.source || '').slice(0, 120),
    wpm: Number(stats.wpm) || 0,
    rawWpm: Number(stats.rawWpm) || 0,
    accuracy: Number(stats.accuracy) || 0,
    consistency: Number(stats.consistency) || 0,
    timeSec: Number(stats.timeSec) || 0,
    errors: Number(stats.errors) || 0,
    backspaces: Number(stats.backspaces) || 0,
    chars: Number(stats.chars) || 0,
    symbolStats: payload?.symbolStats && typeof payload.symbolStats === 'object' ? payload.symbolStats : {},
    lineStats: payload?.lineStats && typeof payload.lineStats === 'object' ? payload.lineStats : {},
    charStats: sanitizeCharStats(payload?.charStats),
    charTimes: sanitizeCharTimes(payload?.charTimes),
    daily: Boolean(payload?.daily)
  };
  return row;
}

router.post('/', ah(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'invalid_payload' });
  }
  const row = sessionShape(req.body);
  const store = await storeFor(req);
  await store.insert(row);
  res.status(201).json({ id: row.id, createdAt: row.createdAt, store: store.kind });
}));

// Cursor-based pagination (newest-first by createdAt). The cursor is the
// `createdAt` of the last item on the previous page; pass it back as `cursor`
// to get the next page. `hasMore` is decided by over-fetching one row.
router.get('/', ah(async (req, res) => {
  const store = await storeFor(req);
  const rawLimit = Number(req.query.limit);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 20, 100));
  const since = Number(req.query.cursor);
  const rows = await store.query({
    since: Number.isFinite(since) ? since : undefined,
    limit: limit + 1 // +1 so we can tell whether another page exists
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = page.length ? page[page.length - 1].createdAt : null;
  res.json({ sessions: page, nextCursor: hasMore ? nextCursor : null, hasMore, limit });
}));

router.get('/keystats', ah(async (req, res) => {
  const chars = {};
  for (const s of await (await storeFor(req)).all()) {
    for (const [ch, v] of Object.entries(s.charStats || {})) {
      const cur = chars[ch] || { t: 0, e: 0 };
      cur.t += Number(v.t) || 0;
      cur.e += Number(v.e) || 0;
      chars[ch] = cur;
    }
  }
  res.json({ chars });
}));

router.get('/fingerstats', ah(async (req, res) => {
  const fingers = {};
  for (const s of await (await storeFor(req)).all()) {
    for (const [ch, v] of Object.entries(s.charStats || {})) {
      const f = fingerOf(ch);
      if (!f) continue;
      const cur = fingers[f] || { t: 0, e: 0 };
      cur.t += Number(v.t) || 0;
      cur.e += Number(v.e) || 0;
      fingers[f] = cur;
    }
  }
  res.json({ fingers });
}));

router.get('/benchmark/:snippetId', ah(async (req, res) => {
  const id = String(req.params.snippetId).slice(0, 80);
  // Filter pushed to the store (`.eq('snippet_id', …)`) instead of loading
  // every session and filtering in JS.
  const times = (await (await storeFor(req)).query({ snippetId: id, limit: 500 }))
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
  const id = String(req.params.snippetId).slice(0, 80);
  let best = null;
  // `.eq('snippet_id', …)` — only this snippet's runs come back from the store.
  for (const s of await (await storeFor(req)).query({ snippetId: id, limit: 500 })) {
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

// Group-by-snippet aggregation (needs the full set of the user's runs), then
// offset-paginated on output — default 20 per page.
router.get('/pbest-snippets', ah(async (req, res) => {
  const best = new Map();
  for (const s of await (await storeFor(req)).all()) {
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
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.json({
    snippets: all.slice(offset, offset + limit),
    total: all.length,
    limit,
    offset
  });
}));

router.get('/pbests', ah(async (req, res) => {
  const { mode, language } = req.query;
  const best = new Map();
  // mode/language filters pushed to the store (.eq) instead of a JS filter.
  for (const s of await (await storeFor(req)).query({
    mode: mode ? String(mode).slice(0, 24) : undefined,
    language: language ? String(language).slice(0, 24) : undefined,
    limit: 500
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
  res.json({ pbests: [...best.values()].sort((a, b) => b.wpm - a.wpm) });
}));

router.get('/summary', ah(async (req, res) => {
  const all = await (await storeFor(req)).all();
  const total = all.length;
  const avgWpm = total ? Math.round(all.reduce((sum, s) => sum + s.wpm, 0) / total) : 0;
  const totalErrors = all.reduce((sum, s) => sum + s.errors, 0);
  const symbolAgg = {};
  for (const s of all) {
    for (const [sym, val] of Object.entries(s.symbolStats || {})) {
      if (!symbolAgg[sym]) symbolAgg[sym] = { t: 0, e: 0 };
      symbolAgg[sym].t += Number(val.t) || 0;
      symbolAgg[sym].e += Number(val.e) || 0;
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
    topFriction: friction
  });
}));

export default router;
