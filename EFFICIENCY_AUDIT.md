# CodeType — Efficiency Audit (v1.9)

Audit date: 2026-08-30 · Scope: `backend/src`, `frontend/src`, `supabase/`.

## 1. N+1 / fetch-in-a-loop

**Finding:** No literal N+1 (one query *per row* in a loop) exists — the
Supabase store was already doing a single `select('*').limit(500)` per request.
The real problem was the *opposite* of batching: **every** sessions endpoint
loaded up to 500 rows and then filtered/sorted in JavaScript, even when it only
needed one snippet's runs.

Fixed by adding a store-level `query()` (see below) so the database does the
filtering, and refactoring the per-snippet / per-mode / per-language endpoints
to use it:

| Endpoint | Before | After |
|---|---|---|
| `GET /api/sessions/benchmark/:id` | load all → JS `.filter(snippetId)` | `store.query({ snippetId })` → `.eq('snippet_id', …)` |
| `GET /api/sessions/pbest/:id` | load all → JS filter | `store.query({ snippetId })` |
| `GET /api/sessions/pbests` | load all → JS filter mode/language | `store.query({ mode, language })` |
| `GET /api/daily` | load all → JS filter daily+snippet | `store.query({ daily, snippetId })` + one `all()` for the streak |

`store.query()` (`backend/src/store/supaStore.js`) builds an `.eq()`/`.order()`/
`.limit()`/`.range()` chain for Supabase and an equivalent single-pass filter
for the local JSON store, so route code is store-agnostic.

The genuinely aggregate endpoints — `summary`, `keystats`, `fingerstats`,
`drills/adaptive`, and `pbest-snippets` (group-by) — still read the full set by
definition. They are single-pass reductions (one query), not loops. If those
ever become a bottleneck at scale, they are the candidates to push into
Postgres with `jsonb` aggregation + a materialized view.

## 2. Missing indexes

`supabase/schema.sql` previously had only `(user_id, created_at desc)`. The
columns actually used for filtering/searching were unindexed, forcing a
sequential scan of the user's rows.

Added (see `supabase/migrations/20260830_add_query_indexes.sql` and the idempotent
statements in `schema.sql`):

* `sessions_user_snippet_idx  (user_id, snippet_id, created_at desc)` — ghost race / benchmark / daily
* `sessions_user_mode_lang_idx (user_id, mode, language, created_at desc)` — personal bests
* `sessions_user_daily_idx     (user_id, daily, created_at desc)` — streak

Each leads with `user_id` to match the RLS predicate `auth.uid() = user_id`.

### Before / after query plan

Run in the Supabase SQL editor (substitute a real `user_id`):

```sql
explain analyze
select snippet_id, time_sec
from public.sessions
where user_id = '<uuid>' and snippet_id = 'py-alg-01';
```

* **Before** (no index): `Seq Scan on sessions` with a `Filter` on
  `user_id AND snippet_id` — every row for that user is read.
* **After** (with `sessions_user_snippet_idx`): `Bitmap Index Scan` on the
  composite index — only matching rows are touched (≈ O(log n)).

`EXPLAIN ANALYZE` timings depend on your live row count, so the actual numbers
must be captured against your Supabase DB — the migration file documents the
expected plan shape for both cases.

## 3. Missing pagination

| Endpoint | Before | After |
|---|---|---|
| `GET /api/sessions` | `limit` only (default 20, capped 100) | **cursor-based** pagination: `cursor` = `createdAt` of last row; returns `{ sessions, nextCursor, hasMore, limit }` |
| `GET /api/sessions/pbest-snippets` | returned *all* bests | **offset-based**: `limit` (default 20) + `offset`; returns `{ snippets, total, limit, offset }` |

* Cursor pagination was chosen for `sessions` (a large, monotonically-appended
  table) because it stays cheap as rows grow; offset pagination for
  `pbest-snippets` (bounded by the number of snippets ever typed) is fine.
* Frontend `api.js` gained `sessions(limit, cursor)` and
  `pbestSnippets({ limit, offset })`.

### Intentionally not paginated

* `GET /api/snippets` — a **fixed curated catalog** (82 summaries, no code) that
  the typing engine needs in full to populate language/mode pickers. Paginating
  it would break the client. It is already "light" (summaries only; code is
  fetched per-snippet on demand).
* `summary` / `keystats` / `fingerstats` / `drills/adaptive` — aggregate
  endpoints, not lists; they return a handful of computed values.

## 4. Images

* **No `<img>` elements** exist anywhere in `frontend/src` — the UI is all CSS
  and vector rendering, so there is nothing to lazy-load and no runtime images
  to convert.
* Static assets: `favicon.svg` (242 B), `apple-touch-icon.png` (2.4 KB),
  `og-image.png` (49 KB).
  * `og-image.png` is the only sizable image. It is **deliberately PNG**:
    Open Graph / social scrapers expect PNG/JPEG and frequently reject WebP/AVIF.
    Converting it would break link previews, so it is left as-is. (If you want
    to shave bytes for a generic `<img>` use case, provide `og-image.webp`
    alongside it and keep the PNG for the `og:image` tag — there is no such
    `<img>` use today.)
* Recommendation: none required. If you later add in-app raster images, use
  WebP/AVIF with a JPEG fallback and `loading="lazy"` for below-the-fold images.

## 5. Code splitting / bundle size

* Previously everything resolved from a single entry with no dynamic imports.
* Added **`React.lazy` + `<Suspense>`** in `App.jsx` for every non-initial view:
  `AnalyticsView` (drags in **recharts**, the heaviest dependency), `ProfileView`,
  `RaceView`, and the four marketing pages. The home `TrainView` and the app
  chrome (TopBar/footer/help/consent) load eagerly so first paint is instant.
* Each view now becomes its own chunk and downloads only when first opened.

> Note: I could not run a production build in this sandbox — the pre-installed
> `frontend/node_modules` has a macOS-native Rollup binary, so `vite build`
> fails on `@rollup/rollup-linux-x64-gnu` (an environment issue, unrelated to
> these changes). After `npm install` on a normal machine, run
> `npm run build` and check `dist/assets/*.js`. Expect the **initial chunk to
> shrink** once recharts/qrcode/marketing code move into on-demand chunks.
> To hit a hard <200 KB initial budget you may still want to split the
> Supabase client (auth) out of the critical path, since `@supabase/supabase-js`
> is the other large vendor dependency.
