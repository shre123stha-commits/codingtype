# CodeType — Efficiency Audit

Last audited: 2026-08-30 · Scope: `backend/src`, `frontend/src`, `supabase/`.
Every number below was measured in this tree; the command that produced it is
named so you can reproduce it.

## 1. N+1 / fetch-in-a-loop

There was never a literal N+1 (one query per row inside a loop) — the Supabase
store already issued a single query per request. The real problems were the
*opposite* of batching:

| Where | Before | After |
|---|---|---|
| `GET /api/daily` | **two** queries: the daily+snippet rows *and* `store.all()` (up to 500 rows of every mode) just to count distinct daily dates | **one** `store.query({ daily: true })`, both today's runs and the streak derived from it |
| `benchmark/:id`, `pbest/:id` | load everything, filter in JS | `.eq('snippet_id', …)` — one indexed query |
| `pbests` | load everything, filter mode/language in JS | `.eq('mode')` + `.eq('language')` |
| `keystats`, `fingerstats`, `summary`, `drills/adaptive` | unbounded `store.all()` | `store.query({ limit })`, bounded, and each response reports `scanned` + `truncated` so a truncated aggregate is visible rather than silent |

`store.query()` builds an `.eq()` / `.order()` / `.limit()` / `.range()` chain
for Supabase and an equivalent single-pass filter for the file and per-guest
stores, so route code is store-agnostic.

Frontend: `RaceView` asked for `api.sessions(500)` — the server capped it at 100
anyway, so it was silently getting a third of what it asked for. It now walks
the cursor via `collectSessions({ limit: 100, maxPages: 5 })`. `useCatalog`
walks `fetchCatalog()`. Both are bounded, and with 78 snippets the catalog is
still exactly **one** request.

The genuinely aggregate endpoints (`summary`, `keystats`, `fingerstats`,
`drills/adaptive`, `pbest-snippets`) still read the full set by definition —
they are single-pass reductions, not loops. If they ever dominate, they are the
candidates to push into Postgres with `jsonb` aggregation and a materialized
view.

## 2. Indexes — with real query plans

`supabase/schema.sql` and `migrations/20260830_add_query_indexes.sql` cover
every filter the code actually issues:

| Query shape | Index |
|---|---|
| `user_id` + `ORDER BY created_at DESC LIMIT n` (cursor pagination) | `sessions_user_created_idx (user_id, created_at desc)` |
| `user_id` + `snippet_id` (ghost race, benchmark, daily) | `sessions_user_snippet_idx (user_id, snippet_id, created_at desc)` |
| `user_id` + `mode` + `language` (personal bests) | `sessions_user_mode_lang_idx (user_id, mode, language, created_at desc)` |
| `user_id` + `daily` (streak) | `sessions_user_daily_idx (user_id, daily, created_at desc)` |
| leaderboards: `category` + `board` + `ORDER BY wpm` | `leaderboard_board_idx (category, board, wpm desc, accuracy desc)` |
| leaderboards: today only | `leaderboard_today_idx (category, day, wpm desc) WHERE board = 'today'` |

### Measured plans

Produced by running the DDL and `EXPLAIN ANALYZE` against a **real Postgres 16**
(PGlite — Postgres compiled to WASM) with **120,000 rows**. Not hand-written
expectations.

| Query | Before | After | Change |
|---|---|---|---|
| `WHERE snippet_id = $2` | `Seq Scan` — **22.728 ms**, 115,000 rows removed by filter | `Bitmap Heap Scan` — **6.053 ms** | **3.8×** |
| `WHERE mode = $2 AND language = $3` | `Seq Scan` — **24.456 ms**, 110,000 removed | `Bitmap Heap Scan` — **10.080 ms** | **2.4×** |
| `WHERE daily = true` | `Seq Scan` — **24.849 ms**, 102,858 removed | `Bitmap Heap Scan` — **13.594 ms** | **1.8×** |
| `ORDER BY created_at DESC LIMIT 21` | `Limit → Sort` — **96.832 ms** | `Limit → Index Scan using sessions_user_created_idx` — **0.228 ms** | **425×** |

The pagination case is the dramatic one: without the index Postgres sorts all
120k rows to return 21.

**Caveat, stated plainly:** PGlite has no `auth` schema, so these plans use the
trailing index columns without the leading `user_id` that RLS adds in
production. The indexes in `schema.sql` all lead with `user_id` to match the
`auth.uid() = user_id` predicate. The seq-scan → index-scan decision
demonstrated is the same, but the absolute milliseconds on your Supabase
instance will differ with your row count. Re-run in the SQL editor against real
data for your own numbers.

## 3. Pagination

Every list endpoint is paginated. Default 20 per page.

| Endpoint | Strategy | Why |
|---|---|---|
| `GET /api/sessions` | **cursor** (`cursor` = `createdAt` of the last row) → `{ sessions, nextCursor, hasMore, limit }` | big, monotonically-appended table — OFFSET gets slower on every page, a keyset scan stays O(page) |
| `GET /api/sessions/pbest-snippets` | **offset** → `{ snippets, total, limit, offset, hasMore }` | bounded by the number of snippets a user has typed (tens) — cheap, and the client can jump around |
| `GET /api/sessions/pbests` | **offset** | bounded by modes × languages |
| `GET /api/snippets` | **offset** | fixed curated catalog |
| `keystats` / `fingerstats` / `summary` / `drills/adaptive` | scan-bounded (`limit`, max 1000) + `scanned` / `truncated` in the response | aggregates, not lists |

The frontend walks pages with bounded helpers: `fetchCatalog()` (max 10 pages)
and `collectSessions()` (max 5 pages). With 78 snippets the catalog is still one
request — but no endpoint is left unbounded.

Intentionally not paginated: the `top` array in `/api/daily` (hard-sliced to 5)
and `drills/adaptive` (top 3).

## 4. Images

`grep -rn "<img" frontend/src` returns exactly **4**, and all four render
data-URLs, not files:

| File | What it shows |
|---|---|
| `AuthMenu.jsx:275` | 16px avatar in the top bar |
| `AuthMenu.jsx:290` | 40px avatar in the account dropdown |
| `FlashCardModal.jsx:80` | a canvas-rendered share card (1080×1350) |
| `ProfileView.jsx:147` | 96px avatar |

*(An earlier revision of this audit claimed there were no `<img>` elements at
all. That was wrong; the grep above is the correction.)*

What was done:

- **`decoding="async"` added to all four.** These are large data-URLs, so
  synchronous decoding can block the main thread. Real, if small, win.
- **Avatar encoding switched to WebP with a JPEG fallback** (`utils/avatar.js`).
  Support is probed once (`canvas.toDataURL('image/webp')` returns a PNG prefix
  in browsers that cannot encode it) and cached, so the worst case is exactly
  the previous behaviour. Both formats decode everywhere, so existing JPEG
  data-URLs already in localStorage and the `profiles` table keep rendering.
  **The byte saving is not measured here** — this sandbox has no browser, so
  there was no canvas to encode with. Expect roughly 30–50% smaller at 256px,
  but treat that as an expectation, not a measurement.
- **`loading="lazy"` deliberately NOT added.** It is a no-op on `data:` URLs —
  those bytes are already in the JS payload, there is no fetch to defer. Adding
  it would have been box-ticking.

Static assets: `favicon.svg` 242 B, `apple-touch-icon.png` 2.4 KB,
`og-image.png` 49 KB. `og-image.png` stays PNG on purpose — Open Graph scrapers
expect PNG/JPEG and frequently reject WebP/AVIF, so converting it would break
link previews. Removed from the repo: `.debug-shot.png` (145 KB, an orphaned
debug screenshot referenced by nothing).

## 5. Code splitting / bundle size

`vite build`, and confirmed by reading which assets `dist/index.html` actually
references (the true initial payload, not just the biggest chunk):

| | Initial JS | Initial CSS | Initial total |
|---|---|---|---|
| Before this work | 568.68 kB / **174.11 kB gzip** | 37.79 kB / 8.20 kB gzip | 606.47 kB / 182.31 kB gzip |
| Now | **310.72 kB / 102.53 kB gzip** | 39.02 kB / 8.45 kB gzip | **349.74 kB / 110.98 kB gzip** |

**−45% raw, −39% gzip on the initial JS.**

What moved out of the first paint:

| Chunk | Size | Loads when |
|---|---|---|
| Supabase SDK | 215.47 kB / 55.90 kB gzip | a stored session exists, or the user signs in |
| recharts (`LineChart`) | 377.19 kB / 104.31 kB gzip | analytics or the post-run diagnostics panel |
| `shareCard` | 32.96 kB / 12.84 kB gzip | a share card is rendered |
| `RaceView` | 28.99 kB | the RACE view |
| `DiagnosticDashboard` | 41.58 kB | a run finishes |
| `flashCard` + `FlashCardsView` + `qrcode` | 13.72 + 3.34 + 22.98 kB | the FLASH CARDS tab |
| `LeaderboardsView` | 4.02 kB / 1.63 kB gzip | the BOARDS view |

The Supabase split is the big one and it is conditional, not just deferred:
`utils/supabase.js` probes `localStorage` for an `sb-*-auth-token` key
synchronously, and only issues the dynamic import if one exists. **A guest never
downloads the 215 kB SDK at all.**

### On the 200 KB target

The initial bundle is **102.53 kB gzip** — comfortably under 200 KB on the
measure that actually goes over the wire. It is **310.72 kB raw**, over 200 KB.
Closing that gap is not available while React 18 is in the first paint:
`react-dom` alone is ~130 kB minified, plus ~34 kB of Prism for syntax
highlighting on the first code render, plus the app. Splitting those into
separately-cached vendor chunks (`build.rollupOptions.output.manualChunks`)
would improve repeat visits and deploys but would not reduce first-visit bytes.
