import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './src/env.js'; // load backend/.env (SUPABASE_URL, SUPABASE_ANON_KEY, …) — real env wins
import { errorHandler, notFound } from './src/middleware/error.js';
import { securityHeaders, bodySizeGuard } from './src/middleware/security.js';
import { createRateLimiter } from './src/middleware/rateLimit.js';
import snippetsRouter from './src/routes/snippets.js';
import sessionsRouter from './src/routes/sessions.js';
import dailyRouter from './src/routes/daily.js';
import drillsRouter from './src/routes/drills.js';
import waitlistRouter from './src/routes/waitlist.js';
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
const API_VERSION = '1.9.0';

// CORS: same-origin by default. Set CORS_ORIGIN to a comma-separated list of
// allowed origins for a split deploy (frontend on Vercel + API on Render).
const allowedOrigins = (process.env.CORS_ORIGIN || '')
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
      : undefined
  )
);

app.set('trust proxy', true); // behind Vercel/Render — rate limit keys on real client IP
app.use(securityHeaders);
app.use(bodySizeGuard(1024 * 1024)); // 1 MB cap — a session row is ~tens of KB
app.use(express.json({ limit: '1mb' }));

// Rate limiting. Auth/account-like write routes (waitlist signup, session
// persist) get the strict 5-per-15-minutes bucket; everything else shares a
// generous general limit. Tune via env for shared deployments.
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'too_many_attempts'
});
const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 300,
  message: 'too_many_requests'
});
app.use(generalLimiter);

app.get('/', (req, res) => {
  res.json({
    service: 'codetype-api',
    version: API_VERSION,
    routes: {
      'GET /api/health': 'liveness probe',
      'GET /api/snippets': 'list snippets (query: mode, language, q)',
      'GET /api/snippets/meta': 'languages, modes, counts',
      'POST /api/sessions': 'persist a completed typing session',
      'GET /api/sessions': 'recent sessions (query: limit)',
      'GET /api/sessions/pbests': 'personal bests grouped by mode+language',
      'GET /api/sessions/summary': 'aggregate operator telemetry',
      'GET /api/sessions/keystats': 'per-character typed/error totals (key heatmap)',
      'GET /api/sessions/fingerstats': 'per-finger typed/error totals',
      'GET /api/sessions/benchmark/:snippetId': 'median/best/clear times for a snippet',
      'GET /api/sessions/pbest/:snippetId': 'fastest run for a snippet (ghost race data)',
      'GET /api/daily': "today's challenge + streak + top runs",
      'GET /api/drills/adaptive': 'worst friction symbols for AI micro-drills',
      'GET /api/waitlist': 'waitlist count',
      'POST /api/waitlist': 'join the waitlist ({ email })',
      'WS /api/ws': '1v1 race lobbies (create/join-by-code/start/progress/finish/result)',
      'AUTH': 'optional Supabase accounts — send "Authorization: Bearer <jwt>" to read/write that user\'s cloud data; without it data stays local'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'codetype-api', version: API_VERSION, supabase: supaConfigured ? 'on' : 'off', ts: Date.now() });
});

app.use('/api/snippets', snippetsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/daily', dailyRouter);
app.use('/api/drills', drillsRouter);
// Strict auth/account bucket: waitlist signup (email collection) is the
// closest thing to an account/credential endpoint this API exposes. Supabase
// Auth itself is rate-limited in the Supabase dashboard, not here.
app.use('/api/waitlist', authLimiter, waitlistRouter);

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 3001;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[codetype-api] listening on :${port}`);
});

createRaceWs(server);
