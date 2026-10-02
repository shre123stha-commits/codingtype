// Leaderboard persistence.
//
// One backend is chosen at boot, exactly like the sessions store:
//   • SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set → the public.leaderboard_scores
//     table (shared across instances, survives redeploys).
//   • otherwise → backend/data/leaderboard.json (works with zero setup, but is
//     per-process and resets when the host restarts).
//
// Why service_role and not the anon key: this table is world-readable by
// design, so if anon could also INSERT, anyone holding the public anon key
// (i.e. anyone who opens devtools on your site) could forge a 999 WPM entry.
// Only this server writes; the anon key can only read.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

import {
  BOARDS,
  CATEGORIES,
  TOP_N,
  better,
  qualifies,
  qualifiesForToday,
  categoryFor,
  seedBoard
} from '../leaderboard/engine.js';
import { todayStr } from '../../../shared/daily.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(here, '../../data/leaderboard.json');

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const usingSupabase = Boolean(SUPA_URL && SUPA_SERVICE);
export const leaderboardBackend = usingSupabase ? 'supabase' : 'file';

if (usingSupabase) {
  console.log('[codetype-api] leaderboards: supabase (public.leaderboard_scores)');
}

const supa = usingSupabase
  ? createClient(SUPA_URL, SUPA_SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// ── file backend ───────────────────────────────────────────────────────────
let cache = null;
let writeQueue = Promise.resolve();

// The public all-board endpoint is hit by every BOARDS view, but it changes
// only when a qualifying score is saved. A short shared cache removes repeated
// store/Supabase work and coalesces simultaneous first visitors; writes below
// invalidate it immediately, so live results stay correct.
const ALL_BOARDS_CACHE_MS = 15_000;
let allBoardsCache = null;
let allBoardsRequest = null;
let allBoardsGeneration = 0;

export function invalidateAllBoardsCache() {
  allBoardsGeneration += 1;
  allBoardsCache = null;
  // A read started before a score write may contain the old top 10. Let new
  // callers create a fresh read; the generation check prevents stale caching.
  allBoardsRequest = null;
}

function loadFile() {
  if (cache) return cache;
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    cache = raw && typeof raw === 'object' ? raw : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persistFile() {
  writeQueue = writeQueue
    .then(
      () =>
        new Promise((resolve) => {
          fs.mkdirSync(path.dirname(FILE), { recursive: true });
          const tmp = `${FILE}.tmp`;
          fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
          fs.renameSync(tmp, FILE);
          resolve();
        })
    )
    .catch((err) => console.error('[codetype-api] leaderboard persist failed', err?.message || err));
  return writeQueue;
}

const key = (category, board) => `${category}:${board}`;

function shape(row) {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? 'GUEST'),
    category: String(row.category ?? ''),
    board: String(row.board ?? 'alltime'),
    day: row.day ?? null,
    wpm: Number(row.wpm) || 0,
    accuracy: Number(row.accuracy) || 0,
    createdAt: Number(row.createdAt) || Date.now(),
    sample: Boolean(row.sample)
  };
}

// ── reads ──────────────────────────────────────────────────────────────────
export async function getBoard(category, board, dateStr = todayStr()) {
  if (!CATEGORIES.includes(category) || !BOARDS.includes(board)) return [];

  if (usingSupabase) {
    let q = supa.from('leaderboard_scores').select('*').eq('category', category).eq('board', board);
    if (board === 'today') q = q.eq('day', dateStr);
    const { data, error } = await q.order('wpm', { ascending: false }).order('accuracy', { ascending: false }).limit(TOP_N);
    if (error) {
      console.error('[codetype-api] leaderboard read failed', error.message);
      return [];
    }
    const rows = (data || []).map((r) =>
      shape({ ...r, createdAt: new Date(r.created_at).getTime(), name: r.display_name })
    );
    if (rows.length) return rows;
    // nothing yet (fresh install, migration not seeded) — fall through to seeds
    return seedBoard(category, board, dateStr);
  }

  const store = loadFile();
  const rows = store[key(category, board)];
  if (!Array.isArray(rows) || !rows.length) {
    const seeded = seedBoard(category, board, dateStr);
    store[key(category, board)] = seeded;
    await persistFile();
    return seeded;
  }
  return rows.map(shape).sort(better).slice(0, TOP_N);
}

// ── writes ─────────────────────────────────────────────────────────────────
// Records one finished run against every board it is eligible for. Returns the
// placements so the client can celebrate. A run that misses the cut is never
// written anywhere, which is also what keeps the table from growing forever.
export async function submit(run, { name = 'GUEST', guestId = 'anon' } = {}) {
  if (!qualifies(run)) return { placements: [], best: null };
  const category = categoryFor(run);
  if (!category) return { placements: [], best: null };

  const dateStr = todayStr();
  const boards = ['alltime'];
  if (qualifiesForToday(run, dateStr)) boards.push('today');

  const entry = {
    id: String(run.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    name: String(name || 'GUEST').slice(0, 24),
    guestId: String(guestId).slice(0, 64),
    category,
    wpm: Math.round(Number(run.wpm) * 10) / 10,
    accuracy: Math.round(Number(run.accuracy) * 10) / 10,
    createdAt: Number(run.createdAt) || Date.now(),
    snippetId: String(run.snippetId ?? 'unknown').slice(0, 80),
    sample: false
  };

  const placements = [];

  for (const board of boards) {
    const current = await getBoard(category, board, dateStr);
    const withNew = [...current, { ...entry, board, day: board === 'today' ? dateStr : null }].sort(better);
    const rank = withNew.findIndex((r) => r.id === entry.id) + 1;
    if (rank < 1 || rank > TOP_N) continue;

    const trimmed = withNew.slice(0, TOP_N);

    if (usingSupabase) {
      const { error } = await supa.from('leaderboard_scores').insert({
        id: `${category}:${board}:${entry.id}`.slice(0, 120),
        guest_id: entry.guestId,
        display_name: entry.name,
        category,
        board,
        day: board === 'today' ? dateStr : null,
        snippet_id: entry.snippetId,
        wpm: entry.wpm,
        accuracy: entry.accuracy,
        created_at: new Date(entry.createdAt).toISOString()
      });
      if (error) {
        // duplicate (same run submitted twice) is not an error worth reporting
        if (error.code !== '23505') console.error('[codetype-api] leaderboard insert failed', error.message);
        continue;
      }
      // prune anything pushed off the board
      const dropped = trimmed.length < withNew.length ? withNew[TOP_N] : null;
      if (dropped && dropped.id !== entry.id) {
        await supa.from('leaderboard_scores').delete().eq('id', `${category}:${board}:${dropped.id}`.slice(0, 120));
      }
    } else {
      const store = loadFile();
      store[key(category, board)] = trimmed;
      await persistFile();
    }

    placements.push({ category, board, rank });
  }

  if (placements.length) invalidateAllBoardsCache();

  const best = placements.length
    ? placements.reduce((a, b) => (b.rank < a.rank ? b : a))
    : null;
  return { placements, best };
}

async function readAllBoards(dateStr) {
  // On a fresh file install, seed every board in memory and persist once. The
  // old path seeded/persisted each of the 10 boards separately, which made the
  // very first leaderboard visit needlessly slow.
  if (!usingSupabase) {
    const store = loadFile();
    const out = {};
    let seeded = false;
    for (const category of CATEGORIES) {
      out[category] = {};
      for (const board of BOARDS) {
        const k = key(category, board);
        if (!Array.isArray(store[k]) || !store[k].length) {
          store[k] = seedBoard(category, board, dateStr);
          seeded = true;
        }
        out[category][board] = store[k].map(shape).sort(better).slice(0, TOP_N);
      }
    }
    if (seeded) await persistFile();
    return out;
  }

  // Supabase reads are independent. Running the 10 tiny top-10 queries in
  // parallel replaces a 10-round-trip waterfall with one round of latency.
  const categories = await Promise.all(
    CATEGORIES.map(async (category) => {
      const boards = await Promise.all(
        BOARDS.map(async (board) => [board, await getBoard(category, board, dateStr)])
      );
      return [category, Object.fromEntries(boards)];
    })
  );
  return Object.fromEntries(categories);
}

export async function allBoards(dateStr = todayStr()) {
  const now = Date.now();
  if (
    allBoardsCache &&
    allBoardsCache.dateStr === dateStr &&
    now - allBoardsCache.updatedAt < ALL_BOARDS_CACHE_MS
  ) {
    return allBoardsCache.boards;
  }
  if (allBoardsRequest?.dateStr === dateStr) return allBoardsRequest.promise;

  const generation = allBoardsGeneration;
  let requestPromise;
  requestPromise = readAllBoards(dateStr).then(
    (boards) => {
      // Never let a response begun before a score write re-cache stale ranks.
      if (generation === allBoardsGeneration) {
        allBoardsCache = { dateStr, boards, updatedAt: Date.now() };
      }
      if (allBoardsRequest?.promise === requestPromise) allBoardsRequest = null;
      return boards;
    },
    (error) => {
      if (allBoardsRequest?.promise === requestPromise) allBoardsRequest = null;
      throw error;
    }
  );
  allBoardsRequest = { dateStr, promise: requestPromise };
  return requestPromise;
}
