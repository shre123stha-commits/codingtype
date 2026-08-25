import { WebSocketServer } from 'ws';

import { dailySnippet, todayStr } from '../../../shared/daily.js';

const LOBBY_TIMEOUT_MS = 90000;
const COUNTDOWN_MS = 4000;

function sanitizeStats(stats) {
  if (!stats || typeof stats !== 'object') return null;
  return {
    wpm: Number(stats.wpm) || 0,
    rawWpm: Number(stats.rawWpm) || 0,
    cpm: Number(stats.cpm) || 0,
    accuracy: Number(stats.accuracy) || 0,
    timeSec: Number(stats.timeSec) || 0,
    errors: Number(stats.errors) || 0
  };
}

export function createRaceWs(server) {
  const wss = new WebSocketServer({ noServer: true });
  let waiting = null;
  let active = null;

  const send = (ws, msg) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  };

  const clearWaiting = () => {
    if (!waiting) return;
    clearTimeout(waiting.timer);
    waiting = null;
  };

  const finishRace = (reason) => {
    if (!active) return;
    const { a, b } = active;
    const aWon = a.finishedAt <= b.finishedAt;
    send(a.ws, {
      type: 'result',
      winner: aWon ? 'you' : 'opp',
      you: { stats: a.stats, done: a.done },
      opp: { stats: b.stats, done: b.done },
      reason
    });
    send(b.ws, {
      type: 'result',
      winner: aWon ? 'opp' : 'you',
      you: { stats: b.stats, done: b.done },
      opp: { stats: a.stats, done: a.done },
      reason
    });
    active = null;
  };

  const joinLobby = (ws) => {
    if (active) {
      send(ws, { type: 'lobby', state: 'full' });
      return;
    }
    if (!waiting) {
      waiting = { ws, joinedAt: Date.now() };
      waiting.timer = setTimeout(() => {
        const w = waiting;
        clearWaiting();
        send(w.ws, { type: 'lobby', state: 'timeout' });
        try {
          w.ws.close();
        } catch {
          /* already gone */
        }
      }, LOBBY_TIMEOUT_MS);
      send(ws, { type: 'lobby', state: 'waiting' });
      return;
    }
    const first = waiting;
    clearWaiting();
    active = { a: { ws: first.ws, done: false, stats: null, finishedAt: 0 }, b: { ws, done: false, stats: null, finishedAt: 0 } };
    const payload = { type: 'start', at: Date.now() + COUNTDOWN_MS, date: todayStr(), snippet: dailySnippet() };
    send(first.ws, payload);
    send(ws, payload);
  };

  const dropPlayer = (ws) => {
    if (waiting && waiting.ws === ws) {
      clearWaiting();
      return;
    }
    if (active && (active.a.ws === ws || active.b.ws === ws)) {
      const mine = active.a.ws === ws ? active.a : active.b;
      const opp = mine === active.a ? active.b : active.a;
      send(opp.ws, {
        type: 'result',
        winner: 'you',
        you: { stats: opp.stats, done: opp.done },
        opp: { stats: mine.stats, done: false },
        reason: 'quit'
      });
      active = null;
    }
  };

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('message', (buf) => {
      let msg;
      try {
        msg = JSON.parse(buf.toString());
      } catch {
        return;
      }
      if (msg.type === 'join') {
        if (waiting && waiting.ws === ws) return;
        if (active && (active.a.ws === ws || active.b.ws === ws)) return;
        joinLobby(ws);
        return;
      }
      if (msg.type === 'leave') {
        dropPlayer(ws);
        return;
      }
      if (!active) return;
      if (active.a.ws !== ws && active.b.ws !== ws) return;
      const mine = active.a.ws === ws ? active.a : active.b;
      const opp = mine === active.a ? active.b : active.a;
      if (msg.type === 'progress' && !mine.done) {
        send(opp.ws, { type: 'opponent', chars: Math.max(0, Math.min(Number(msg.chars) || 0, 100000)), done: opp.done });
      } else if (msg.type === 'finish' && !mine.done) {
        mine.done = true;
        mine.stats = sanitizeStats(msg.stats);
        mine.finishedAt = Date.now();
        send(opp.ws, { type: 'opponent', chars: Number(msg.chars) || 0, done: true });
        if (opp.done) finishRace('finish');
      }
    });
    ws.on('close', () => dropPlayer(ws));
    ws.on('error', () => dropPlayer(ws));
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        dropPlayer(ws);
        try {
          ws.terminate();
        } catch {
          /* already gone */
        }
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  heartbeat.unref();

  server.on('upgrade', (req, socket, head) => {
    const pathname = (req.url || '').split('?')[0];
    if (pathname !== '/api/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws);
    });
  });

  return wss;
}
