import express from 'express';
import cors from 'cors';

import { errorHandler, notFound } from './src/middleware/error.js';
import snippetsRouter from './src/routes/snippets.js';
import sessionsRouter from './src/routes/sessions.js';
import dailyRouter from './src/routes/daily.js';
import drillsRouter from './src/routes/drills.js';
import { createRaceWs } from './src/ws/race.js';

const app = express();
const API_VERSION = '1.1.0';

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
      'WS /api/ws': '1v1 race lobbies (join/start/progress/finish/result)'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'codetype-api', version: API_VERSION, ts: Date.now() });
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
