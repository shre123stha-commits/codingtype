# CODETYPE // Dev-Tuned Typing Telemetry

A production-ready, developer-focused typing trainer — a specialized alternative to Monkeytype,
engineered around the motor skills, symbol hierarchies, and syntax workflows of software engineers.

Tactical cyber-HUD aesthetic: obsidian slate (`#0b0f19` / `#0f172a`), structural borders (`#1e293b`),
JetBrains Mono everywhere, neon amber (`#FACC15`) + cyan (`#38bdf8`) accents, corner crosshairs,
grid-dot backgrounds, and glowing status badges.

**v1.2.0** — three top-level tabs (`TRAIN` / `RACE` / `ANALYTICS`), daily challenge + streak,
adaptive micro-drills, ghost races, blind mode, import-your-own-code, interview sprints with
median benchmark, real 1v1 WebSocket races **with bot fallback**, share cards, a full analytics
suite (key heatmap, finger-strength, velocity trend), a tab-rail control deck, a `✦ FEATURES`
index in the top bar, and a 78-target snippet repo.

---

## Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React 18 + Vite 5 + Tailwind CSS 3.4 + Zustand 4 + Prism (tokenizer) + Recharts (telemetry) |
| Backend   | Node.js 20 + Express 4 (ESM) + `ws` (races), JSON-file persistence (atomic writes, bounded at 500 sessions) |
| Shared    | `shared/snippets.js` (snippet repo), `shared/fingers.js` (finger map), `shared/daily.js` (date-stable challenge picker) — imported by both sides |

## Quickstart

```bash
npm run setup        # installs root + backend + frontend deps
npm run dev          # starts API :3001 and web :5173 (Vite proxies /api + ws)
```

- Web: http://localhost:5173
- API: http://localhost:3001 (root prints the route map)

If the API is down the frontend degrades gracefully: it serves the bundled copy of the snippet
repo (top bar shows `API LINK: LOCAL`) and disables session persistence, daily, and races.

## Accounts + cloud sync (optional, Supabase)

Out of the box CodeType is 100% local: **no account, no external service, no key needed** — all
runs are saved to `backend/data/db.json` on this machine and the site works fully offline
(degraded). Everything still works if you never touch Supabase.

To turn on **login/signup + per-user cloud storage** (so a user's sessions, PBs, heatmap,
finger stats, benchmark and daily streak follow their account across devices, and the daily
leaderboard becomes global):

1. Create a free project at https://supabase.com.
2. Run `supabase/schema.sql` **once** in **SQL Editor → New query** (creates the `sessions`
   table + row-level-security so each user can only see their own rows).
3. From **Project Settings → API**, copy the **Project URL** and the **anon / public key**,
   and put the same pair in **two** files:
   - `frontend/.env` → `VITE_SUPABASE_URL=…` and `VITE_SUPABASE_ANON_KEY=…`
   - `backend/.env` → `SUPABASE_URL=…` and `SUPABASE_ANON_KEY=…`
   (`.env.example` in each folder shows the exact lines. The anon key is safe for the browser —
   RLS is what enforces per-user isolation. Do **not** put the `service_role` key anywhere.)
4. Restart both processes. The top-right now shows **⊕ SIGN IN**; `GET /api/health` reports
   `"supabase":"on"`.

How it behaves:
- **Guest (no login):** unchanged — data stays in the local file, no auth UI is sent along.
- **Signed in:** the frontend attaches the Supabase JWT to every `/api/*` call
   (`Authorization: Bearer …`); the backend verifies it and reads/writes that user's Supabase
   `sessions` rows instead of the local file. Sign out and it falls back to local again.
- **Bad/expired token or Supabase unreachable:** the backend silently falls back to the local
  file so the site never breaks.

The anon key is a public credential; all real protection comes from the RLS policies in
`schema.sql`. If you'd rather skip the confirmation email on signup, toggle
**Authentication → Providers → Email → Confirm email** off in the dashboard.

## Information architecture

Everything lives under **three top-level tabs** in the top bar; no feature floats free.

### 1 — TRAIN
Single screen, three columns: **Control Deck** (left), **Typing Arena + Live HUD** (center),
**Post-run Diagnostics** (right/bottom after a run).

The Control Deck has a **left tab rail** (01–07) — one section on screen at a time, nothing
stacked:

| # | Tab | Contents |
|---|-----|----------|
| 01 | DAILY | today's challenge — title, source, **code preview**, `RUN DAILY`, streak, "same target for everyone today" |
| 02 | DRILL | `ALGO` / `REAL-REPO` / `SPRINT` / `INTERVIEW` chips + blurb |
| 03 | LANG | PY / JS / JAVA / CPP / RUST / SQL |
| 04 | TARGET | **dropdown of every target for the language** (13, mode-badged, char counts) + `SHUFFLE TARGET` + `RESET SESSION` |
| 05 | IMPORT | paste your own code **or** a GitHub blob URL → `LOAD AS TARGET` |
| 06 | AI | `GENERATE DRILL` — top-3 error symbols from your history → 55-char drill |
| 07 | FLAGS | `STRICT`/`NATURAL`, `GHOST PAIRS` on/off, `INDENT ASSIST` on/off, `BLIND` 3-state (off → 3-ch window → fully blind) |

Top bar: target readout, **✦ FEATURES** dropdown (full feature index grouped by TRAIN / RACE /
ANALYTICS — every entry is a button that navigates straight to its view *and* sub-tab,
e.g. `AI MICRO-DRILL →` opens TRAIN on the 06 AI tab), THEMES dropdown (4 themes),
API LINK status, version.
After finishing a run the arena swaps to the **Diagnostic Dashboard**: velocity chart,
symbol friction matrix, stutter timeline, line blame, share card, ghost-benchmark, daily-complete
badge, and (interview mode) the YOU / MEDIAN / BEST benchmark bar.

### 2 — RACE
Two race types, always both visible, over a real WebSocket — no HTTP polling:

- **GHOST RACE** card — race your past self. Lists every snippet you have a personal
  best on (`GET /api/sessions/pbest-snippets`); pick one → it loads into the arena and
  the green ghost caret replays your PB keystroke-by-keystroke. No practice data yet
  (first visit)? It says so: *"do a practice session in TRAIN first — your best run
  becomes your ghost."*
- **1V1 QUICK RACE** card — a 2-slot **code lobby**:
  - `⚔ CREATE RACE` → pick target (language → snippet), duration (first-to-finish /
    30 / 60 / 90 s), mode (strict / natural), bot fallback on/off → a **random 6-digit
    code** is generated and shown with a live `CODE EXPIRES IN MM:SS` countdown.
    Codes are unique, random on every creation, and valid **15 minutes** only.
  - `⊕ JOIN RACE` → enter a 6-digit code. Valid code + 1 person in the lobby → you join
    and both players get the synced start. Wrong/expired code → `INVALID CODE — CHECK
    AND RE-ENTER` (re-enter right there). Two people already → `LOBBY IS FULL (2/2)`.
  - Solo lobby + bot fallback on → a **CT-BOT** fills the second slot after 8 s.
  - `✕ CANCEL RACE` (waiting) / `✕ FORFEIT` (live) — the rival is settled
    (`result.reason = 'quit'`, quitter loses).
- **RACE TRACK** — two side-by-side progress bars (YOU / RIVAL) with live char counts,
  plus a countdown clock for timed races (winner = most chars when time runs out).
- Synced 4-3-2-1-GO start; both players always get the **exact same snippet**.
- Winner screen (`VICTORY` / `DEFEAT`), reason: `finish` / `quit` / `timeout`;
  race log keeps the last 5 results.

### 3 — ANALYTICS
Four panels, all fed by the session store:

| Panel | Data |
|-------|------|
| KEY HEATMAP | QWERTY grid + spacebar, error rate per key (darker red = more errors) + TOP FRICTION KEYS |
| FINGER STRENGTH | per-finger accuracy bars (8 fingers via `shared/fingers.js`), WEAKEST / STRONGEST callout |
| VELOCITY TREND | last 24 runs: WPM + ACCURACY on the left axis, CPM on the right axis (dual Y) |
| SESSION LOG / PBs | recent runs (mode/language labeled) and personal bests per mode+language |

---

## Feature map

### Typing engine (`frontend/src/store/gameStore.js`, `hooks/useTypingEngine.js`)
- **Instant start** — a random target auto-deploys on load; switching mode/language re-rolls.
- **Four themes** (top-bar THEMES dropdown, persisted): `OBSIDIAN`, `PHANTOM` (dark),
  `PAPER`, `BONE` (light). All tokens flow through CSS variables; the dropdown ignores
  typing while open (`uiOpen` gate in the key matrix).
- **Thin `|` caret** — 2px caret, plain token color (no highlight wash); one-shot green/red
  flash animations on correct/incorrect consumption; code stays fully visible in real syntax
  colors — wrong keys never replace or shift the text.
- **`↻ RESTART`** — resets timer + progress on the same block, no re-roll.
- **Invisible input pattern** — capture-phase global `keydown` + visually hidden focused input.
- **Smart indentation** — `Tab` claims the indent run; `Enter` pre-arms the next line's dotted
  pending-indent; Indent Assist auto-consumes it (excluded from accuracy).
- **Strict vs Natural** — strict blocks advance on error; natural renders errors inline in soft red.
- **Ghost Pairs** — `(` `[` `{` and quotes pre-render matched closers (stack-matched across lines).
- **Backspace** revises the last consumption with telemetry corrected on the way back.

### New in v1.1.0
- **Daily challenge + streak** — FNV-1a over the date string picks one snippet from the
  non-sprint pool for *every* user on that date (`shared/daily.js`); consecutive-day completions
  build a streak; top-5 daily leaderboard by WPM. `GET /api/daily`.
- **Adaptive micro-drills** — `GET /api/drills/adaptive` reads your per-char error history
  (`charStats`), takes the top-3 error symbols, and synthesizes a 55-char drill around
  pattern templates for those symbols (`utils/adaptiveDrill.js`).
- **Import your own code** — paste up to 2,500 chars / 80 lines, or a GitHub `blob` URL
  (auto-converted to `raw`); language select; tokenized and typed like any repo snippet.
- **Ghost races vs your past self** — personal best (per snippet) is stored as `{wpm, charTimes}`;
  the arena replays `charTimes` as a moving green caret (`utils/ghostRace.js`); beating it sets
  a GHOST BEATEN chip + ghost win count.
- **Blind mode** — 3-state: off → 3-char reveal window ahead of the caret → fully blind
  (code hidden until typed). Per-char `blind` state in `LineRow`; ghost pairs mark the blind
  window's extent.
- **Interview sprint mode** — 18 timed DSA blocks (Two Sum, Kadane, Valid Parens, Running
  Total, Top-N-per-group, Streak Islands…) across py/js/java/cpp/rs + SQL; post-run benchmark
  bar compares your time against the **median** of all recorded runs on that block
  (`GET /api/sessions/benchmark/:id`).
- **Share cards** — the diagnostics header renders a 1000×560 PNG on a canvas
  (`utils/shareCard.js`): theme-matched palette, WPM hero, 6 stat cells, top-5 friction bars,
  corner crosshairs. `⤓ SHARE PNG` downloads; `⧉ COPY IMG` writes to the clipboard.
- **Flash cards** — big 1080×1350 (profile + race summary) and 1200×675 (direct result)
  share PNGs drawn on canvas (`utils/flashCard.js`), all four theme palettes:
  - **Profile card** — CONTROL DECK tab **08 · CARDS** (or ✦ FEATURES → FLASH CARDS):
    avatar, handle, level (1 + feats/20), WPM-based rank tier (S/A/B/C/D), 2×2 stat grid,
    next-rank progress bar, streak + personal best, and a scannable **QR code**
    (battle-tested `qrcode` package) encoding a text snapshot of the profile.
  - **Race summary card** — after every 1v1 race: VICTORY/DEFEAT glow, WPM/accuracy/rank
    cells, and a live **performance curve** (your cyan area vs the rival's gold line —
    dashed when the rival is still typing when the race settles), keystrokes, errors,
    career victories, `#RACECHAMPION`.
  - **Direct result share** — winner/loser panels with WPM + accuracy/errors in one
    wide 1200×675 PNG.
  All three open a modal viewer with `⤓ DOWNLOAD PNG`, `⧉ COPY IMAGE` (clipboard),
  `𝕏 POST ON X` (share intent), `⧉ COPY TEXT` (caption).
- **Real 1v1 races** — `ws` server on the same HTTP port; **per-code 2-slot lobbies**:
  creating a race mints a **random 6-digit code** (unique, valid 15 min, expires on its own),
  a second player joins by entering the code, synced start, live progress. **First to
  finish wins** — the result lands the instant anyone finishes; an unfinished rival is
  frozen at its real progress (partial, honest stats — never a fake 100%) and the result
  screen shows VICTORY/DEFEAT the moment it is settled (a timed race's bell is only a
  fallback — most chars wins — if nobody finishes in time). **No human in 8s? A bot
  fills the slot** (240–420 CPM pace, labeled `CT-BOT-n`) so quick races always start.
- **Ghost race picker** — `GET /api/sessions/pbest-snippets` returns one row per snippet
  you have a PB on (title, wpm, timeSec, accuracy); the RACE tab lists them so you can
  race your past self on any target, or shows a "practice first" hint on first visit.
- **Key heatmap + finger strength** — per-key and per-finger accuracy from persisted
  `charStats` (char → finger via `shared/fingers.js`); rendered in ANALYTICS.

### Snippet repo (`shared/snippets.js`)
- **Sprint** — 15-second symbol drills saturated in braces/brackets/`->`/`::`/`=>`/`;`/`_`.
- **Algorithm** — quick sort, binary search, BFS, Dijkstra, Kahn, Union-Find, SQL windows.
- **Real-repo** — production-shaped blocks with real file paths (Express, Spring, Axum, ECS…).
- **Interview** — timed DSA blocks with canonical problem names.
- 6 languages × 4 categories = **78 targets** (13 per language; queryable via `/api/snippets/meta`).

### Tokenization (`utils/tokenizer.js`, `utils/snippetEngine.js`)
Prism → **per-character class array** (not a flat string): exact syntax highlighting,
error mapping, ghost-pair resolution (matched-bracket + quote index maps), indent-run
detection, and `text`/`cls` per line for the arena.

### Live HUD
Time, CPM, WPM, RAW, live accuracy %, errors, progress, RACE Δ chip — 10 Hz updates
without re-rendering the token grid.

### Post-test diagnostics (`components/DiagnosticDashboard.jsx`)
Velocity telemetry (WPM vs RAW vs CPM vs burst), symbol friction matrix, stutter timeline
with backspace overlay + line blame, consistency, share card, ghost-benchmark chips,
daily-complete badge, interview benchmark bar. Runs persist via `POST /api/sessions`
with per-char `charStats`, per-keystroke `charTimes`, `symbolStats`, `lineStats`.

---

## API

```
GET  /api/health                   liveness + version
GET  /api/snippets?mode&language   snippet summaries
GET  /api/snippets/meta            languages / modes / counts
GET  /api/snippets/:id             full snippet + code
POST /api/sessions                 persist a completed run
GET  /api/sessions?limit           recent runs
GET  /api/sessions/pbests          personal bests (query: mode, language)
GET  /api/sessions/pbest-snippets  one PB row per snippet you've practiced (ghost picker)
GET  /api/sessions/pbest/:id       personal best for one snippet (404 `no_pb` if none)
GET  /api/sessions/summary         aggregate telemetry + top friction symbols
GET  /api/sessions/keystats        per-char {t,e} totals (key heatmap feed)
GET  /api/sessions/fingerstats     per-finger {t,e} totals (finger panel feed)
GET  /api/sessions/benchmark/:id   median/best/mean run time for a snippet
GET  /api/daily                    today's snippet, streak, top-5 leaderboard
GET  /api/drills/adaptive          top-3 error symbols + suggested drill payload
```

### WebSocket race protocol (`ws` on the API port, path `/api/ws`)

Room-based: each race is a **room** keyed by a random 6-digit `code`. Creator takes slot `a`,
joiner (or bot) slot `b`. Rooms live 15 min from creation, then expire
(`roomClosed {reason:'expired'}`). If the creator enabled bot fallback and no human joins
within 8 s, a bot takes slot `b` and the race auto-starts. When a joiner is present the race
auto-starts ~1.2 s after the join. Messages are JSON.

Client → server:

| Message | Payload | Effect |
|---------|---------|--------|
| `create` | `{snippetId, durationSec: 0\|30\|60\|90, strict, botAllowed}` | mint a room + random 6-digit code; reply `createResult` |
| `join` | `{code}` | enter that room; reply `joinResult {ok, reason?: invalid\|full}` |
| `leave` | `{}` | vacate slot; waiting room destroyed if creator, opponent gets `result` (reason `quit`) if race live |
| `progress` | `{chars}` | live char count, broadcast to opponent |
| `finish` | `{stats, chars}` | record `finishedAt`; winner = earliest finisher (timed: most chars at bell) |

Server → client:

| Message | Payload | Meaning |
|---------|---------|---------|
| `createResult` | `{ok, code, room}` | room minted; `room` = code/state/snippet summary/durationSec/strict/expiresAt/opp |
| `joinResult` | `{ok, code, reason?}` | `invalid` = unknown/expired/finished code, `full` = 2 players already in |
| `lobby` | `{room}` | current room state (opponent joined/left) |
| `start` | `{at, code, snippet, durationSec, strict, opp:{name,bot}}` | both clients get the same full snippet; start at `at` (now+4s) |
| `opponent` | `{chars, done}` | rival's live progress |
| `result` | `{winner: you\|opp, you:{stats,done}, opp:{stats,done,name,bot}, reason: finish\|quit\|timeout, code}` | race over; quitter always loses |
| `roomClosed` | `{code, reason: expired\|closed}` | room gone (expired, or host cancelled while waiting) |

30 s heartbeat ping/pong; finished rooms are pruned 5 s after the result; Vite proxies
`/api/ws` with `ws: true`.

---

## Deploying (Vercel + Render)

The app splits cleanly: **frontend on Vercel, API on Render** (Render is needed for the
WebSocket race server — Vercel serverless functions don't hold long-lived WS connections).

### 1. API → Render

- New → **Web Service** → connect the repo.
- **Root Directory:** `backend` · **Build Command:** `npm install` · **Start Command:** `node server.js`
- **Environment variables:**
  | Name | Value |
  |------|-------|
  | `SUPABASE_URL` | your Supabase project URL |
  | `SUPABASE_ANON_KEY` | your publishable/anon key |

  (`PORT` is set by Render automatically; the server binds `process.env.PORT`.)
- CORS is open (`app.use(cors())`) and the WS upgrade doesn't filter origins, so any
  frontend domain can talk to it. No code change needed on this side.

### 2. Frontend → Vercel

- Import the same repo. Framework preset: **Vite** (auto-detected).
- **Root Directory:** `frontend` · build `npm run build` · output `dist` (all defaults).
- **Environment variables** (Project → Settings → Environment Variables, all environments):
  | Name | Value |
  |------|-------|
  | `VITE_API_URL` | your Render URL, e.g. `https://codetype-api.onrender.com` |
  | `VITE_SUPABASE_URL` | same Supabase URL (accounts + cloud sync in the browser) |
  | `VITE_SUPABASE_ANON_KEY` | same publishable/anon key |

`VITE_API_URL` is the whole integration: `src/utils/env.js` prefixes every REST call and
derives the `wss://` race endpoint from it. **Leave it unset for local dev** (Vite's
`/api` proxy handles it) or for a single-host deploy. Vite inlines `VITE_*` vars at build
time — after changing it on Vercel, the project must **redeploy**.

### 3. Notes

- **Render free tier sleeps** after ~15 min idle. The first request (and WS connection)
  after a sleep takes ~30–60 s to wake the instance; the top-bar **API LINK** chip shows
  OFFLINE until it answers and recovers on its own (it re-polls). Paid instances stay up.
- **Guest data** (not signed in) lives in the API's JSON store — on Render's free tier the
  disk is ephemeral, so it resets on each deploy/restart. **Signed-in accounts store
  everything in Supabase**, which persists.
- Everything the browser does (typing, sessions, daily streaks) works with the API fully
  offline; only 1v1 races and cloud sync need it.

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| `'vite' is not recognized…` | Frontend deps missing. `npm install --prefix frontend` (or `npm run setup`). |
| `ERR_MODULE_NOT_FOUND: express` | Backend deps missing. `npm install --prefix backend`. |
| `concurrently: command not found` | Root deps missing. `npm install` in project root. |
| `EADDRINUSE :3001` / `:5173` | A previous dev run is alive. Kill it, or set `PORT` (API) / `--port` (web). |

`node_modules` is not committed — `npm run setup` on every fresh checkout.
If the project lives on a synced folder (e.g. OneDrive), dev-server file locks are a known
hazard; pause sync or move the project off the synced path.

## Extension points

- **Matchmaking / ranked ladder** — the code-lobby protocol already shards rooms per race;
  add a ranked queue on top (ELO from `result` payloads).
- **Team leaderboards** — sessions already carry mode/language/snippetId + charTimes;
  group by user id once auth exists.
- **More drill patterns** — add symbol → template rows to `utils/adaptiveDrill.js` PATTERNS.

## Layout

```
codetype/
├── shared/
│   ├── snippets.js               # canonical snippet repo (78 targets)
│   ├── fingers.js                # char → finger map (heatmap/finger panel)
│   └── daily.js                  # date-stable daily snippet picker
├── supabase/
│   └── schema.sql                # one-time Supabase setup (sessions table + RLS)
├── backend/
│   ├── server.js                 # express app + ws race server + route mounts
│   ├── .env.example              # SUPABASE_URL / SUPABASE_ANON_KEY (optional)
│   ├── src/
│   │   ├── env.js                # tiny .env loader (real env wins)
│   │   ├── ws/race.js            # code-lobby room state machine
│   │   ├── routes/snippets.js
│   │   ├── routes/sessions.js    # runs + PBs + benchmark + keystats + fingerstats
│   │   ├── routes/daily.js       # daily snippet + streak + leaderboard
│   │   ├── routes/drills.js      # adaptive drill feed
│   │   ├── store/fileStore.js    # atomic JSON persistence (local fallback)
│   │   ├── store/supaStore.js    # per-request store router: local vs Supabase (JWT)
│   │   └── middleware/error.js
│   └── data/db.json              # local DB (created at runtime)
└── frontend/
    ├── vite.config.js            # host 0.0.0.0, allowedHosts, /api + ws proxy
    ├── tailwind.config.js        # design tokens
    ├── .env.example              # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (optional)
    └── src/
        ├── store/gameStore.js    # zustand engine: keys, modes, telemetry, views, authUser
        ├── hooks/                # key matrix, ticker, api, race (ws client), useAuth
        ├── utils/                # tokenizer, snippet prep, metrics, symbols, api,
        │                         # supabase (client), ghostRace, adaptiveDrill, shareCard, themes
        └── components/           # TopBar (incl. AuthMenu sign in/up + account menu),
                                  # TrainView, RaceView, AnalyticsView, ModeDeck, LiveHud,
                                  # TypingArena, LineRow, DiagnosticDashboard, VelocityChart,
                                  # SymbolMatrix, StutterTimeline, HistoryPanel, FrictionPreview,
                                  # KeyHeatmap, FingerPanel, TrendChart, BenchmarkBar,
                                  # ShareCard, ImportPanel, AdaptivePanel, RestartButton
```

## Keys

| Key | Action |
|-----|--------|
| first key | starts the clock |
| `TAB` | claims the current indent run |
| `ENTER` | newline + caret alignment to next indent level |
| `ESC` | pause / resume |
| `BACKSPACE` | revise last character |
| `ENTER` (when complete) | run again on the same block |

## Tests

```bash
node scripts/smoke.mjs             # 35 engine asserts (headless, no browser)
node scripts/verify-race.mjs       # 22-assert raw-WS race protocol test (first-to-finish settle, bot freeze)
node scripts/verify-features.mjs   # 42-check E2E incl. full 2-player code-lobby ws race (Playwright)
node scripts/verify-flashcards.mjs # E2E: flash-card tab + full bot race → VICTORY → all 3 share modals
```
