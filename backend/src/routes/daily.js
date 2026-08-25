import { Router } from 'express';

import { dailySnippet, todayStr } from '../../../shared/daily.js';
import { db } from '../store/fileStore.js';

const router = Router();

function localDate(ts) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

router.get('/', (req, res) => {
  const date = todayStr();
  const sn = dailySnippet(date);
  const all = db.all();
  const todayRuns = all.filter((s) => s.daily && s.snippetId === sn.id && localDate(s.createdAt) === date);
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
});

export default router;
