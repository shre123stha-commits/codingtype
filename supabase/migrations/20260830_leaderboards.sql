-- ============================================================
-- CodeType — public leaderboards
-- Run ONCE in: Supabase Dashboard → SQL Editor → New query
-- Every statement is idempotent (safe to re-run).
--
-- World-readable by design (it is a leaderboard), but ONLY the backend may
-- write: the anon key that ships to the browser gets SELECT only. If anon
-- could INSERT, anyone who opens devtools on the site could forge a 999 WPM
-- entry, because that key is public.
--
-- The backend therefore needs SUPABASE_SERVICE_ROLE_KEY in its OWN env
-- (Render → Environment). Never add it to frontend/.env and never prefix it
-- with VITE_ — anything VITE_-prefixed is inlined into the public bundle.
-- Without it the API falls back to backend/data/leaderboard.json.
-- ============================================================

create table if not exists public.leaderboard_scores (
  -- "<category>:<board>:<run id>" — makes a duplicate submission a no-op
  id            text primary key,
  guest_id      text not null,
  display_name  text not null,
  category      text not null check (category in ('daily','algorithm','repo','sprint','interview')),
  board         text not null check (board in ('alltime','today')),
  -- 'YYYY-MM-DD' for the today board; null for all-time
  day           text,
  snippet_id    text not null default 'unknown',
  wpm           numeric not null check (wpm >= 0 and wpm <= 600),
  -- the backend never writes a row below 90%, this just makes it impossible
  accuracy      numeric not null check (accuracy >= 90 and accuracy <= 100),
  created_at    timestamptz not null default now()
);

-- Read path: one board at a time, top 10.
-- WHERE category = $1 AND board = $2 [AND day = $3] ORDER BY wpm DESC
create index if not exists leaderboard_board_idx
  on public.leaderboard_scores (category, board, wpm desc, accuracy desc);

-- Read path for the TODAY board only.
create index if not exists leaderboard_today_idx
  on public.leaderboard_scores (category, day, wpm desc)
  where board = 'today';

alter table public.leaderboard_scores enable row level security;

-- Everyone can read a leaderboard. No policies are created for insert /
-- update / delete, which means every role except service_role (which bypasses
-- RLS) is denied. That is the point.
drop policy if exists "anyone can read leaderboards" on public.leaderboard_scores;
create policy "anyone can read leaderboards"
  on public.leaderboard_scores for select
  using (true);

-- ============================================================
-- Verify after running:
--
--   select category, board, count(*) from public.leaderboard_scores
--   group by 1, 2 order by 1, 2;
--
-- The boards seed themselves with 10 sample operators on first read from the
-- API, and real runs replace them as people beat the samples.
-- ============================================================
