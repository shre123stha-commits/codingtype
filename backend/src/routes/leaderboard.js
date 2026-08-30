// Public leaderboards — read-only. Writes happen server-side only, when a
// finished run is saved (POST /api/sessions evaluates it against the boards).
import { Router } from 'express';

import {
  BOARDS,
  BOARD_LABELS,
  CATEGORIES,
  CATEGORY_LABELS,
  MIN_ACCURACY,
  TOP_N
} from '../leaderboard/engine.js';
import { allBoards, getBoard, leaderboardBackend } from '../store/leaderboardStore.js';
import { todayStr } from '../../../shared/daily.js';
import { queryStr } from '../middleware/sanitize.js';

const router = Router();

const ah = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error('[codetype-api] leaderboard handler error', err);
    if (!res.headersSent) res.status(502).json({ error: 'store_error' });
  });
};

router.get('/meta', (req, res) => {
  res.json({
    categories: CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id] })),
    boards: BOARDS.map((id) => ({ id, label: BOARD_LABELS[id] })),
    topN: TOP_N,
    minAccuracy: MIN_ACCURACY,
    date: todayStr(),
    backend: leaderboardBackend
  });
});

// Everything at once — 5 categories x 2 boards x 10 rows. One request keeps the
// view snappy and means the client never fires 10 calls.
router.get('/', ah(async (req, res) => {
  const date = todayStr();
  res.json({ date, boards: await allBoards(date) });
}));

router.get('/:category/:board', ah(async (req, res) => {
  const category = queryStr(req.params.category, 24);
  const board = queryStr(req.params.board, 24);
  if (!CATEGORIES.includes(category)) return res.status(404).json({ error: 'unknown_category' });
  if (!BOARDS.includes(board)) return res.status(404).json({ error: 'unknown_board' });
  res.json({ category, board, date: todayStr(), entries: await getBoard(category, board) });
}));

export default router;
