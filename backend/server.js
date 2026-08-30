import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './src/env.js'; // load backend/.env (SUPABASE_URL, SUPABASE_ANON_KEY, …) — real env wins
import { errorHandler, notFound } from './src/middleware/error.js';
import { securityHeaders, bodySizeGuard } from './src/middleware/security.js';
import { createRateLimiter, createWsGuard } from './src/middleware/rateLimit.js';
import snippetsRouter from './src/routes/snippets.js';
import sessionsRouter from './src/routes/sessions.js';
import dailyRouter from './src/routes/daily.js';
import drillsRouter from './src/routes/drills.js';
import waitlistRouter from './src/routes/waitlist.js';
import leaderboardRouter from './src/routes/leaderboard.js';
import { createRaceWs } from './src/ws/race.js';
import { supaConfigured } from './src/store/supaStore.js';

// Crash guard: a single bad request must never take the API down silently.
const here = path.dirname(fileURLToPath(import.meta.url));
const crashLog = path.join(here, 'data', 'crash.log');
const logCrash = (kind, err) => {
  const entry = `\n[${new Date().toISOString()}] ${kind}\n${(err && err.stack) || err}\n`;
  try {
    fs.mkdirSync(path.dirname(crashLog), { recursive: true });
    fs.appendFileSync(crashLog, entry);
  } catch {
    /* best effort */
  }
  console.error(entry);
};
process.on('uncaughtException', (err) => logCrash('uncaughtException', err));
process.on('unhandledRejection', (err) => logCrash('unhandledRejection', err));

const app = express();
const API_VERSION = '2.0.0';

const numEnv = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// ── Proxy trust ────────────────────────────────────────────────────────────
// `trust proxy: true` would let ANY client send `X-Forwarded-For: <random>`
// and mint a fresh rate-limit bucket per request — the limiter would be
// worthless. We trust a bounded number of proxy hops instead (1 = the single
// Vercel/Render edge in front of this process). Set TRUST_PROXY=0 if the API
// is exposed directly, or to the exact hop count of your setup.
const trustProxy = Number(process.env.TRUST_PROXY ?? 1);
app.set('trust proxy', Number.isFinite(trustProxy) ? trustProxy : 1);

// ── CORS ───────────────────────────────────────────────────────────────────
// Same-origin by default. Set CORS_ORIGIN to a comma-separated allowlist for a
// split deploy (frontend on Vercel + API on Render).
const allowedOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors(
    allowedOrigins.length
      ? {
          origin(origin, cb) {
            // no origin = same-origin / curl / native clients → allow
            if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
            return cb(new Error('cors_origin_not_allowed'));
          }
        }
      : // No allowlist configured. The API is stateless (Bearer JWT, no
        // cookies), so a wildcard cannot leak a signed-in user's rows to
        // another origin — but it does let any site call the public endpoints.
        // Set CORS_ORIGIN=https://your-frontend.vercel.app to lock it down.
        { origin: '*', credentials: false }
  )
);

if (!allowedOrigins.length) {
  console.warn(
    '[codetype-api] CORS_ORIGIN is not set — responding with Access-Control-Allow-Origin: *. ' +
      'Set CORS_ORIGIN to your frontend origin (comma-separated for several) to restrict it.'
  );
}

app.use(securityHeaders);
app.use(bodySizeGuard(numEnv('MAX_BODY_BYTES', 1024 * 1024))); // 1 MB — a session row is tens of KB
// JSON only: anything else is a 415 rather than a silently-ignored body.
app.use(express.json({ limit: `${numEnv('MAX_BODY_BYTES', 1024 * 1024)}b`, strict: true }));

// ── Rate limiting — every endpoint is covered ──────────────────────────────
const WINDOW_MS = numEnv('RATE_LIMIT_WINDOW_MIN', 15) * 60 * 1000;

// AUTH / ACCOUNT bucket — 5 attempts per 15 minutes. Applied to the credential
// and identity-capture routes: the waitlist email signup (POST).
// GET /api/waitlist is deliberately NOT in this bucket, otherwise five page
// loads would lock a visitor out of seeing the subscriber count.
const authLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  max: numEnv('AUTH_RATE_LIMIT_MAX', 5),
  message: 'too_many_attempts'
});

// WRITE bucket — completed-run persistence. Generous enough for continuous
// practice (≈ one run every 10 s) but it caps bulk-flooding the store.
const writeLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  max: numEnv('WRITE_RATE_LIMIT_MAX', 90),
  message: 'too_many_writes'
});

// GENERAL bucket — reads. 300 requests / 15 min / client / path.
const generalLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  max: numEnv('RATE_LIMIT_MAX', 300),
  message: 'too_many_requests'
});

app.use(generalLimiter);

app.get('/', (req, res) => {
  res.json({
    service: 'codetype-api',
    version: API_VERSION,
    routes: {
      'GET /api/health': 'liveness probe',
      'GET /api/snippets': 'list snippets (query: mode, language, q, limit=20, offset)',
      'GET /api/snippets/meta': 'languages, modes, counts',
      'POST /api/sessions': 'persist a completed typing session',
      'GET /api/sessions': 'recent sessions (query: limit=20, cursor) — cursor paginated',
      'GET /api/sessions/pbests': 'personal bests grouped by mode+language (limit, offset)',
      'GET /api/sessions/pbest-snippets': 'best run per snippet (limit=20, offset)',
      'GET /api/sessions/summary': 'aggregate operator telemetry',
      'GET /api/sessions/keystats': 'per-character typed/error totals (key heatmap)',
      'GET /api/sessions/fingerstats': 'per-finger typed/error totals',
      'GET /api/sessions/benchmark/:snippetId': 'median/best/clear times for a snippet',
      'GET /api/sessions/pbest/:snippetId': 'fastest run for a snippet (ghost race data)',
      'GET /api/daily': "today's challenge + streak + top runs",
      'GET /api/drills/adaptive': 'worst friction symbols for AI micro-drills',
      'GET /api/leaderboard': 'all top-10 boards (category x board)',
      'GET /api/leaderboard/meta': 'categories, boards, accuracy gate',
      'GET /api/leaderboard/:category/:board': 'one top-10 board',
      'GET /api/waitlist': 'waitlist count',
      'POST /api/waitlist': 'join the waitlist ({ email }) — 5 attempts / 15 min',
      'WS /api/ws': '1v1 race lobbies (create/join-by-code/start/progress/finish/result)',
      AUTH:
        'optional Supabase accounts — send "Authorization: Bearer <jwt>" to read/write that user\'s cloud data; without it data stays local'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'codetype-api',
    version: API_VERSION,
    supabase: supaConfigured ? 'on' : 'off',
    ts: Date.now()
  });
});

// Auth/account bucket first, then the router — POST only.
app.post('/api/waitlist', authLimiter);
// Write bucket for run persistence.
app.post('/api/sessions', writeLimiter);

app.use('/api/snippets', snippetsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/daily', dailyRouter);
app.use('/api/drills', drillsRouter);
app.use('/api/waitlist', waitlistRouter);
app.use('/api/leaderboard', leaderboardRouter);

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 3001;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[codetype-api] listening on :${port}`);
});

// Slow-loris / held-socket protection: bound how long a client may take to
// send headers and a body. Node's defaults are effectively unlimited.
server.requestTimeout = numEnv('REQUEST_TIMEOUT_MS', 30000);
server.headersTimeout = numEnv('HEADERS_TIMEOUT_MS', 35000);
server.keepAliveTimeout = numEnv('KEEP_ALIVE_MS', 10000);

createRaceWs(server, {
  guard: createWsGuard({
    maxConnectionsPerIp: numEnv('WS_MAX_CONNECTIONS_PER_IP', 6),
    maxCreatesPerIpPer15Min: numEnv('WS_MAX_CREATES_PER_IP', 30),
    maxMessagesPerMin: numEnv('WS_MAX_MESSAGES_PER_MIN', 240)
  }),
  allowedOrigins
});
