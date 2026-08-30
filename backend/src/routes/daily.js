import { Router } from 'express';

import { dailySnippet, todayStr } from '../../../shared/daily.js';
import { storeFor } from '../store/supaStore.js';

const router = Router();

const ah = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error('[codetype-api] handler error', err);
    if (!res.headersSent) res.status(502).json({ error: 'store_error' });
  });
};

function localDate(ts) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

router.get('/', ah(async (req, res) => {
  const date = todayStr();
  const sn = dailySnippet(date);
  const store = await storeFor(req);
  // Push the daily + snippet filters into the store (.eq) — one targeted
  // fetch for today's challenge runs, plus the full set for the streak.
  const [dailyRuns, all] = await Promise.all([
    store.query({ daily: true, snippetId: sn.id, limit: 500 }),
    store.all()
  ]);
  const todayRuns = dailyRuns.filter((s) => localDate(s.createdAt) === date);
  const top = [...todayRuns]
    .sort((a, b) => b.wpm - a.wpm)
    .slice(0, 5)
    .map((s) => ({
      wpm: s.wpm,
      cpm: s.timeSec ? Math.round((s.chars * 60) / s.timeSec) : 0,
      accuracy: s.accuracy,
      timeSec: s.timeSec
    }));
  const dailyDates = new Set(all.filter((s) => s.daily).map((s) => localDate(s.createdAt)));
  let streak = 0;
  const d = new Date();
  if (!dailyDates.has(todayStr(d))) d.setDate(d.getDate() - 1);
  while (dailyDates.has(todayStr(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  res.json({
    date,
    snippetId: sn.id,
    title: sn.title,
    source: sn.source,
    language: sn.language,
    mode: sn.mode,
    streak,
    myRuns: todayRuns.length,
    top
  });
}));

export default router;
