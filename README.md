<<<<<<< HEAD
# CODETYPE // Dev-Tuned Typing Telemetry

A production-ready, developer-focused typing trainer — a specialized alternative to Monkeytype,
engineered around the motor skills, symbol hierarchies, and syntax workflows of software engineers.

Tactical cyber-HUD aesthetic: obsidian slate (`#0b0f19` / `#0f172a`), structural borders (`#1e293b`),
JetBrains Mono everywhere, neon amber (`#FACC15`) + cyan (`#38bdf8`) accents, corner crosshairs,
grid-dot backgrounds, and glowing status badges.

**v1.1.0** — three top-level tabs (`TRAIN` / `RACE` / `ANALYTICS`), daily challenge + streak,
adaptive micro-drills, ghost races, blind mode, import-your-own-code, interview sprints with
median benchmark, real 1v1 WebSocket races, share cards, and a full analytics suite
(key heatmap, finger-strength, velocity trend).

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

## Information architecture

Everything lives under **three top-level tabs** in the top bar; no feature floats free.

### 1 — TRAIN
Single screen, three columns: **Control Deck** (left), **Typing Arena + Live HUD** (center),
**Post-run Diagnostics** (right/bottom after a run).

The Control Deck is a numbered deck — every control in its own section:

| # | Section | Controls |
|---|---------|----------|
| 01 | DAILY CHALLENGE | one fixed snippet for everyone per date, `RUN DAILY`, streak badge, "same target for everyone today" note |
| 02 | DRILL CATEGORY | `ALGO` / `REAL-REPO` / `SPRINT` / `INTVIEW` chips |
| 03 | LANGUAGE | PY / JS / JAVA / CPP / RUST / SQL |
| 04 | TARGETS | target list (loaded badge, char/line counts), `SHUFFLE TARGET` |
| 05 | IMPORT CODE | paste your own code **or** a GitHub blob URL → `LOAD AS TARGET` |
| 06 | AI MICRO-DRILL | `GENERATE DRILL` — top-3 error symbols from your history → 55-char drill |
| 07 | MODES & FLAGS | `STRICT`/`NATURAL`, `GHOST PAIRS` on/off, `INDENT ASSIST` on/off, `BLIND` 3-state (off → 3-ch window → fully blind) |

Top bar: target readout, THEMES dropdown (4 themes), API LINK status, version.
After finishing a run the arena swaps to the **Diagnostic Dashboard**: velocity chart,
symbol friction matrix, stutter timeline, line blame, share card, ghost-benchmark, daily-complete
badge, and (interview mode) the YOU / MEDIAN / BEST benchmark bar.

### 2 — RACE
1v1 races over a real WebSocket — no HTTP polling:

- **RACE LOBBY** panel — status (`WAITING FOR RIVAL` / `FULL — SYNC IN FLIGHT` / `TIMEOUT`),
  `FIND MATCH` / `FORFEIT`, race-log of the last 5 connections.
- **RACE TRACK** — two side-by-side progress bars (YOU / RIVAL) with live char counts.
- Synced 3-2-1-GO countdown, both players get the **same daily snippet**.
- Winner screen (`VICTORY` / `DEFEAT`, wpm/acc of both sides), reason: `finish` or `quit`.
- Also hosts **GHOST RACE** (your past self) from the TRAIN diagnostics: the green
  ghost caret replays your personal-best keystroke-by-keystroke on the same target.

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
- **Real 1v1 races** — `ws` server on the same HTTP port; single global lobby, 2 slots,
  90s fill timeout, synced start, live progress, winner = first `finishedAt`.
- **Key heatmap + finger strength** — per-key and per-finger accuracy from persisted
  `charStats` (char → finger via `shared/fingers.js`); rendered in ANALYTICS.

### Snippet repo (`shared/snippets.js`)
- **Sprint** — 15-second symbol drills saturated in braces/brackets/`->`/`::`/`=>`/`;`/`_`.
- **Algorithm** — quick sort, binary search, BFS, Dijkstra, Kahn, Union-Find, SQL windows.
- **Real-repo** — production-shaped blocks with real file paths (Express, Spring, Axum, ECS…).
- **Interview** — timed DSA blocks with canonical problem names.
- 6 languages × 4 categories = **60 targets** (queryable via `/api/snippets/meta`).

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
GET  /api/sessions/pbest/:id       personal best for one snippet
GET  /api/sessions/summary         aggregate telemetry + top friction symbols
GET  /api/sessions/keystats        per-char {t,e} totals (key heatmap feed)
GET  /api/sessions/fingerstats     per-finger {t,e} totals (finger panel feed)
GET  /api/sessions/benchmark/:id   median/best/mean run time for a snippet
GET  /api/daily                    today's snippet, streak, top-5 leaderboard
GET  /api/drills/adaptive          top-3 error symbols + suggested drill payload
```

### WebSocket race protocol (`ws` on the API port, path `/api/ws`)

Single global lobby, 2 slots. Messages are JSON.

Client → server:

| Message | Payload | Effect |
|---------|---------|--------|
| `join` | `{}` | take a free slot; lobby re-announced |
| `leave` | `{}` | vacate slot; opponent gets `result` (reason `quit`) if race live |
| `progress` | `{chars}` | live char count, broadcast to opponent |
| `finish` | `{stats, chars}` | record `finishedAt`; winner = earliest finisher |

Server → client:

| Message | Payload | Meaning |
|---------|---------|---------|
| `lobby` | `{state: waiting\|full\|timeout, you, opp}` | current lobby state |
| `start` | `{at, date, snippet}` | both clients get the same daily snippet; start at `at` (now+4s) |
| `opponent` | `{chars, done}` | rival's live progress |
| `result` | `{winner: you\|opp, you, opp, reason: finish\|quit}` | race over |

30s heartbeat ping/pong; 90s lobby fill timeout; Vite proxies `/api/ws` with `ws: true`.

---

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

- **Multi-lobby races** — the lobby is global today; key `createRaceWs` rooms by `roomId`
  in the `join` payload to shard.
- **Team leaderboards** — sessions already carry mode/language/snippetId + charTimes;
  group by user id once auth exists.
- **More drill patterns** — add symbol → template rows to `utils/adaptiveDrill.js` PATTERNS.

## Layout

```
codetype/
├── shared/
│   ├── snippets.js               # canonical snippet repo (60 targets)
│   ├── fingers.js                # char → finger map (heatmap/finger panel)
│   └── daily.js                  # date-stable daily snippet picker
├── backend/
│   ├── server.js                 # express app + ws race server + route mounts
│   ├── src/
│   │   ├── ws/race.js            # lobby state machine
│   │   ├── routes/snippets.js
│   │   ├── routes/sessions.js    # runs + PBs + benchmark + keystats + fingerstats
│   │   ├── routes/daily.js       # daily snippet + streak + leaderboard
│   │   ├── routes/drills.js      # adaptive drill feed
│   │   ├── store/fileStore.js    # atomic JSON persistence
│   │   └── middleware/error.js
│   └── data/db.json              # local DB (created at runtime)
└── frontend/
    ├── vite.config.js            # host 0.0.0.0, allowedHosts, /api + ws proxy
    ├── tailwind.config.js        # design tokens
    └── src/
        ├── store/gameStore.js    # zustand engine: keys, modes, telemetry, views
        ├── hooks/                # key matrix, ticker, api, race (ws client)
        ├── utils/                # tokenizer, snippet prep, metrics, symbols, api,
        │                         # ghostRace, adaptiveDrill, shareCard, themes
        └── components/           # TopBar, TrainView, RaceView, AnalyticsView,
                                  # ModeDeck, LiveHud, TypingArena, LineRow,
                                  # DiagnosticDashboard, VelocityChart, SymbolMatrix,
                                  # StutterTimeline, HistoryPanel, FrictionPreview,
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
node scripts/verify-features.mjs   # 25-check E2E incl. full 2-player ws race (Playwright)
```
=======
# codetype
A website for to practice touch typing through code 
>>>>>>> 57554139a67450843fa874c764947f3f66eeb3fe
