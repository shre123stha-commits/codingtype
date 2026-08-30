// Leaderboard definitions + placement logic. Pure functions — no I/O — so the
// rules are testable and identical whichever store backs them.
import { MODES } from '../../../shared/snippets.js';
import { dailySnippet, todayStr } from '../../../shared/daily.js';

// "daily" is the shared daily challenge; the other four are the DRILL tab
// categories, one board each.
export const DAILY_CATEGORY = 'daily';
export const CATEGORIES = [DAILY_CATEGORY, ...MODES]; // daily, algorithm, repo, sprint, interview

export const CATEGORY_LABELS = {
  daily: 'DAILY CHALLENGE',
  algorithm: 'DRILL · ALGORITHM',
  repo: 'DRILL · REPO',
  sprint: 'DRILL · SPRINT',
  interview: 'DRILL · INTERVIEW'
};

// Two timeframes per category.
export const BOARDS = ['alltime', 'today'];
export const BOARD_LABELS = { alltime: 'ALL TIME', today: 'TODAY' };

export const TOP_N = 10;
// A run below this accuracy does not rank. It still saves to your own stats —
// it just cannot enter a board. Keeps the list honest.
export const MIN_ACCURACY = 90;

export function isCategory(c) {
  return CATEGORIES.includes(c);
}

export function isBoard(b) {
  return BOARDS.includes(b);
}

// Which category a finished run competes in. A daily run competes in `daily`
// (not in its drill mode) so the daily board stays about the daily target.
export function categoryFor(run) {
  if (run.daily) return DAILY_CATEGORY;
  return isCategory(run.mode) ? run.mode : null;
}

// Can this run enter the "today" board?
//   • daily category  → only today's daily snippet counts
//   • drill category  → any run finished today in that mode
export function qualifiesForToday(run, dateStr = todayStr()) {
  const createdAt = new Date(run.createdAt);
  const local = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(
    createdAt.getDate()
  ).padStart(2, '0')}`;
  if (local !== dateStr) return false;
  if (categoryFor(run) === DAILY_CATEGORY) {
    return run.snippetId === dailySnippet(dateStr).id;
  }
  return true;
}

export function qualifies(run) {
  const wpm = Number(run.wpm);
  const accuracy = Number(run.accuracy);
  if (!Number.isFinite(wpm) || !Number.isFinite(accuracy)) return false;
  if (wpm <= 0) return false;
  return accuracy >= MIN_ACCURACY;
}

// Sort: WPM desc, then accuracy desc, then whoever set it first.
export function better(a, b) {
  if (b.wpm !== a.wpm) return b.wpm - a.wpm;
  if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
  return a.createdAt - b.createdAt;
}

export function sortBoard(rows) {
  return [...rows].sort(better);
}

// ── Seed data ──────────────────────────────────────────────────────────────
// Boards start with 10 sample operators so a brand-new board is never empty.
// Seeded ONCE and persisted, so real scores simply push the samples down and
// eventually off the list.
const SAMPLE_NAMES = [
  'NULLBYTE', 'STACKTRACE', 'SEGV', 'ROOT@LOCAL', 'BITSHIFT',
  'MERGE-CONFLICT', 'CACHE-MISS', 'HEAPSPRAY', 'TABNOTSPACES', 'DEADLOCK',
  'SEGFAULT-SAM', 'RACE-CONDITION', 'VOIDPTR', 'GIT-BLAME', 'PANIC-AT-DISCO'
];

// Deterministic PRNG so every instance seeds the SAME samples (otherwise two
// servers would show different "top 10" until real scores arrived).
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// Plausible ceiling per category, so a seed board looks like real play rather
// than a wall of identical numbers.
const BASE_WPM = { daily: 78, algorithm: 74, repo: 66, sprint: 88, interview: 70 };

export function seedBoard(category, board, dateStr = todayStr()) {
  const rnd = mulberry32(hash(`${category}|${board}`));
  const base = BASE_WPM[category] || 72;
  const rows = [];
  for (let i = 0; i < TOP_N; i += 1) {
    // spread from a high seed down to a modest one
    const wpm = Math.round((base + 26 - i * 2.6 - rnd() * 2.2) * 10) / 10;
    const accuracy = Math.round((99.4 - i * 0.35 - rnd() * 0.5) * 10) / 10;
    rows.push({
      id: `seed-${category}-${board}-${i}`,
      name: SAMPLE_NAMES[Math.floor(rnd() * SAMPLE_NAMES.length)],
      category,
      board,
      day: board === 'today' ? dateStr : null,
      wpm: Math.max(35, wpm),
      accuracy: Math.max(MIN_ACCURACY, accuracy),
      createdAt: Date.now() - (i + 1) * 3600000,
      sample: true
    });
  }
  return sortBoard(rows);
}
