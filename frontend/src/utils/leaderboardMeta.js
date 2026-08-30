// Client-side mirror of the leaderboard rules in
// backend/src/leaderboard/engine.js. Kept as a local copy (not an import from
// backend/) so the browser bundle never pulls in server code. The server's
// /api/leaderboard/meta is still the source of truth at runtime — these
// constants are only the labels/fallbacks.

export const DAILY_CATEGORY = 'daily';

export const CATEGORIES = ['daily', 'algorithm', 'repo', 'sprint', 'interview'];

export const CATEGORY_LABELS = {
  daily: 'DAILY CHALLENGE',
  algorithm: 'DRILL · ALGORITHM',
  repo: 'DRILL · REPO',
  sprint: 'DRILL · SPRINT',
  interview: 'DRILL · INTERVIEW'
};

export const BOARDS = ['alltime', 'today'];

export const BOARD_LABELS = { alltime: 'ALL TIME', today: 'TODAY' };

export const TOP_N = 10;

// A run below this accuracy does not rank.
export const MIN_ACCURACY = 90;
