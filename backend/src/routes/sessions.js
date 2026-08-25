import { Router } from 'express';

import { fingerOf } from '../../../shared/fingers.js';
import { db } from '../store/fileStore.js';

const router = Router();

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
  return arr.slice(0, 2000).map((c) => ({ t: Math.round(Number(c?.t) || 0), n: Number(c?.n) || 1 }));
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

router.post('/', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'invalid_payload' });
  }
  const row = sessionShape(req.body);
  db.addSession(row);
  res.status(201).json({ id: row.id, createdAt: row.createdAt });
});

router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  res.json({ sessions: db.list(limit) });
});

router.get('/keystats', (req, res) => {
  const chars = {};
  for (const s of db.all()) {
    for (const [ch, v] of Object.entries(s.charStats || {})) {
      const cur = chars[ch] || { t: 0, e: 0 };
      cur.t += Number(v.t) || 0;
      cur.e += Number(v.e) || 0;
      chars[ch] = cur;
    }
  }
  res.json({ chars });
});

router.get('/fingerstats', (req, res) => {
  const fingers = {};
  for (const s of db.all()) {
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
});

router.get('/benchmark/:snippetId', (req, res) => {
  const id = String(req.params.snippetId).slice(0, 80);
  const times = db
    .all()
    .filter((s) => s.snippetId === id && s.timeSec > 0)
    .map((s) => s.timeSec)
    .sort((a, b) => a - b);
  if (!times.length) return res.status(404).json({ error: 'no_runs' });
  res.json({
    median: Math.round(times[Math.floor((times.length - 1) / 2)] * 10) / 10,
    best: Math.round(times[0] * 10) / 10,
    count: times.length
  });
});

router.get('/pbest/:snippetId', (req, res) => {
  const id = String(req.params.snippetId).slice(0, 80);
  let best = null;
  for (const s of db.all()) {
    if (s.snippetId !== id || !Array.isArray(s.charTimes) || !s.charTimes.length || !s.timeSec) continue;
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
});

router.get('/pbests', (req, res) => {
  const { mode, language } = req.query;
  const best = new Map();
  for (const s of db.all()) {
    if (mode && s.mode !== mode) continue;
    if (language && s.language !== language) continue;
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
});

router.get('/summary', (req, res) => {
  const all = db.all();
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
});

export default router;
