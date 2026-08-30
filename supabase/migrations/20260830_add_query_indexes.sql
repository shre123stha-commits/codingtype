-- ============================================================
-- CodeType — query performance indexes (v1.9)
-- Run ONCE in: Supabase Dashboard → SQL Editor → New query
-- Every statement is idempotent (safe to re-run).
--
-- Problem: sessions is filtered/searched by snippet_id (ghost race PB,
-- benchmark, daily challenge), by mode + language (personal bests), and by
-- daily (streak). Before this migration the ONLY index was the composite
-- (user_id, created_at desc), so every one of those lookups forced a full
-- sequential scan of the user's rows. RLS adds `auth.uid() = user_id`, so
-- each new index leads with user_id to stay selective.
-- ============================================================

-- Ghost race / benchmark / daily: WHERE user_id = $1 AND snippet_id = $2
create index if not exists sessions_user_snippet_idx
  on public.sessions (user_id, snippet_id, created_at desc);

-- Personal bests: WHERE user_id = $1 AND mode = $2 AND language = $3
create index if not exists sessions_user_mode_lang_idx
  on public.sessions (user_id, mode, language, created_at desc);

-- Daily streak: WHERE user_id = $1 AND daily = true
create index if not exists sessions_user_daily_idx
  on public.sessions (user_id, daily, created_at desc);

-- ============================================================
-- Before / after query plans — run these in the same SQL editor to confirm.
-- (EXPLAIN ANALYZE needs a live table with data; substitute a real user_id.)
-- ============================================================

-- BEFORE (no matching index → Seq Scan over the user's rows):
--   explain analyze
--   select snippet_id, time_sec
--   from public.sessions
--   where user_id = '<uuid>' and snippet_id = 'py-alg-01';
--
--   Expected before:  Seq Scan on sessions  (cost=0.00..…) with a Filter on
--                     user_id AND snippet_id — every row the user has is read.

-- AFTER (index-only/bitmap scan on the composite index):
--   explain analyze
--   select snippet_id, time_sec
--   from public.sessions
--   where user_id = '<uuid>' and snippet_id = 'py-alg-01';
--
--   Expected after:   Bitmap Index Scan on sessions_user_snippet_idx — only
--                     the matching rows are touched, roughly O(log n).
