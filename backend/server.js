import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import './src/env.js'; // load backend/.env (SUPABASE_URL, SUPABASE_ANON_KEY, …) — real env wins
import { errorHandler, notFound } from './src/middleware/error.js';
import snippetsRouter from './src/routes/snippets.js';
import sessionsRouter from './src/routes/sessions.js';
import dailyRouter from './src/routes/daily.js';
import drillsRouter from './src/routes/drills.js';
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
const API_VERSION = '1.2.0';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

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

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 3001;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[codetype-api] listening on :${port}`);
});

createRaceWs(server);
