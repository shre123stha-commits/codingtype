import { WebSocketServer } from 'ws';

import { SNIPPETS } from '../../../shared/snippets.js';

const ROOM_TTL_MS = 15 * 60 * 1000;
const COUNTDOWN_MS = 4000;
const BOT_FILL_MS = 8000;
const BOT_NAMES = ['CT-BOT-7', 'CT-BOT-12', 'CT-BOT-42'];
const DURATIONS = new Set([0, 30, 60, 90]);

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

function randomCode(taken) {
  for (let i = 0; i < 50; i++) {
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    if (!taken.has(code)) return code;
  }
  return null;
}

function summarizeRoom(room, forWs) {
  const isCreator = room.a.ws === forWs;
  return {
    code: room.code,
    state: room.state,
    snippet: {
      id: room.snippet.id,
      title: room.snippet.title,
      source: room.snippet.source,
      language: room.snippet.language,
      mode: room.snippet.mode,
      chars: room.snippet.code.length
    },
    durationSec: room.config.durationSec,
    strict: room.config.strict,
    expiresAt: room.expiresAt,
    opp: room.b
      ? { name: room.b.bot ? room.b.bot.name : (isCreator ? 'RIVAL' : 'RIVAL'), bot: Boolean(room.b.bot) }
      : null
  };
}

export function createRaceWs(server) {
  const wss = new WebSocketServer({ noServer: true });
  /** @type {Map<string, any>} code -> room */
  const rooms = new Map();

  const send = (ws, msg) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  };
  const sendOpp = (room, fromSide, msg) => {
    const opp = fromSide === 'a' ? room.b : room.a;
    if (opp && opp.ws) send(opp.ws, msg);
  };

  const clearRoomTimers = (room) => {
    if (room.botTimer) clearTimeout(room.botTimer);
    if (room.expireTimer) clearTimeout(room.expireTimer);
    if (room.goTimer) clearTimeout(room.goTimer);
    if (room.durationTimer) clearTimeout(room.durationTimer);
    room.botTimer = room.expireTimer = room.goTimer = room.durationTimer = null;
  };

  const destroyRoom = (room, notifyWs, reason) => {
    clearRoomTimers(room);
    rooms.delete(room.code);
    if (notifyWs) send(notifyWs, { type: 'roomClosed', code: room.code, reason });
  };

  const makeBot = (name) => ({
    name,
    cpm: 240 + Math.floor(Math.random() * 180),
    startedAt: 0,
    totalChars: 0,
    currentChars: 0,
    seed: Math.floor(Math.random() * 100),
    timer: null
  });

  const stopBot = (room) => {
    const botSide = room.b && room.b.bot ? room.b : null;
    if (botSide) {
      if (botSide.bot.timer) clearInterval(botSide.bot.timer);
      botSide.bot.timer = null;
    }
  };

  // Honest stats for whatever the bot actually typed. Used both for a full
  // natural finish and for freezing the bot mid-run when the human wins,
  // so the opponent is never shown "finished" or with a padded WPM.
  const botStats = (room, chars) => {
    const bot = room.b.bot;
    const elapsed = Math.max(0.5, (Date.now() - bot.startedAt) / 1000);
    const accuracy = Math.round((93 + (bot.seed % 6)) * 10) / 10; // 93.0-98.0
    const rawWpm = Math.round((chars / 5) / (elapsed / 60));
    const wpm = Math.max(1, Math.round(rawWpm * (accuracy / 100)));
    return {
      wpm,
      rawWpm,
      cpm: Math.round((chars / elapsed) * 60),
      accuracy,
      timeSec: Math.round(elapsed * 10) / 10,
      errors: Math.max(1, Math.round(chars * (1 - accuracy / 100)))
    };
  };

  // Freeze the bot exactly where it is.
  // ended=true  -> the bot itself completed the target (a real finish)
  // ended=false -> the human won and the bot's partial progress is what it is
  const settleBot = (room, ended) => {
    const botSide = room.b;
    if (!room || !botSide || !botSide.bot || botSide.stats) return;
    const bot = botSide.bot;
    if (bot.timer) clearInterval(bot.timer);
    bot.timer = null;
    const chars = Math.min(bot.currentChars, bot.totalChars);
    botSide.done = ended;
    botSide.stats = botStats(room, chars);
    botSide.finishedAt = ended ? Date.now() : (room.a.finishedAt || Date.now()) + 1;
    send(room.a.ws, { type: 'opponent', chars, done: ended });
  };

  const runBot = (room) => {
    const bot = room.b.bot;
    bot.startedAt = Date.now() + COUNTDOWN_MS;
    bot.totalChars = room.snippet.code.length;
    bot.timer = setInterval(() => {
      if (room.state !== 'racing') return stopBot(room);
      const elapsed = (Date.now() - bot.startedAt) / 1000;
      if (elapsed < 0) return;
      const duration = Math.max(8, (bot.totalChars / bot.cpm) * 60);
      const chars = Math.min(bot.totalChars, Math.floor((elapsed / duration) * bot.totalChars + (Math.random() * 2 - 1)));
      bot.currentChars = Math.max(0, chars);
      if (chars >= bot.totalChars) {
        // the bot completed the target first — race over, bot wins
        settleBot(room, true);
        finishRace(room, 'finish');
      } else {
        send(room.a.ws, { type: 'opponent', chars: bot.currentChars, done: false });
      }
    }, 350);
  };

  // characters a side has actually typed (bots don't send progress pings,
  // so their live position comes from the bot state, not liveChars)
  const sideChars = (side) =>
    side && side.bot ? Math.min(side.bot.currentChars, side.bot.totalChars) : (side ? side.liveChars || 0 : 0);

  const finishRace = (room, reason, loserSide) => {
    if (!room || room.state !== 'racing') return;
    room.state = 'done';
    clearRoomTimers(room);
    stopBot(room);
    const { a, b } = room;
    if (b.bot && !b.stats) settleBot(room, false); // fill the bot's partial stats for the result
    let aWon;
    if (reason === 'timeout') {
      aWon = sideChars(a) >= sideChars(b);
    } else if (reason === 'quit') {
      aWon = loserSide !== 'a';
    } else if (a.done && !b.done) {
      // the human finished first — bot is frozen mid-run, never "finished"
      aWon = true;
    } else if (b.done && !a.done) {
      aWon = false;
    } else {
      aWon = a.finishedAt <= b.finishedAt;
    }
    send(a.ws, {
      type: 'result',
      winner: aWon ? 'you' : 'opp',
      you: { stats: a.stats, done: a.done },
      opp: { stats: b.stats, done: b.done, name: b.bot ? b.bot.name : 'RIVAL', bot: Boolean(b.bot) },
      reason,
      code: room.code
    });
    if (b.ws) {
      send(b.ws, {
        type: 'result',
        winner: aWon ? 'opp' : 'you',
        you: { stats: b.stats, done: b.done },
        opp: { stats: a.stats, done: a.done, name: 'RIVAL', bot: false },
        reason,
        code: room.code
      });
    }
    // finished rooms stop accepting joins and are pruned shortly after
    setTimeout(() => {
      if (rooms.get(room.code) === room && room.state === 'done') rooms.delete(room.code);
    }, 5000);
  };

  const startRace = (room) => {
    room.state = 'racing';
    room.a.liveChars = 0;
    room.b.liveChars = 0;
    const at = Date.now() + COUNTDOWN_MS;
    const payload = {
      type: 'start',
      at,
      code: room.code,
      snippet: room.snippet,
      durationSec: room.config.durationSec,
      strict: room.config.strict,
      opp: { name: room.b.bot ? room.b.bot.name : 'RIVAL', bot: Boolean(room.b.bot) }
    };
    send(room.a.ws, payload);
    send(room.b.ws, payload);
    if (room.config.durationSec > 0) {
      room.durationTimer = setTimeout(() => {
        if (room.state === 'racing') finishRace(room, 'timeout');
      }, COUNTDOWN_MS + room.config.durationSec * 1000);
    }
    if (room.b.bot) runBot(room);
  };

  const scheduleBotFill = (room) => {
    if (!room.config.botAllowed) return;
    if (room.botTimer) clearTimeout(room.botTimer);
    room.botTimer = setTimeout(() => {
      if (rooms.get(room.code) !== room || room.state !== 'waiting' || room.b) return;
      const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      room.b = { ws: null, bot: makeBot(name), done: false, stats: null, finishedAt: 0, liveChars: 0 };
      send(room.a.ws, { type: 'lobby', room: summarizeRoom(room, room.a.ws) });
      startRace(room);
    }, BOT_FILL_MS);
  };

  const dropPlayer = (ws) => {
    for (const room of [...rooms.values()]) {
      const isA = room.a.ws === ws;
      const isB = Boolean(room.b && room.b.ws === ws);
      if (!isA && !isB) continue;
      if (isA) {
        // creator leaves
        if (room.state === 'waiting') {
          destroyRoom(room, room.b && room.b.ws, 'closed');
        } else {
          finishRace(room, 'quit', 'a');
          destroyRoom(room, room.b && room.b.ws, 'closed');
        }
      } else if (room.b) {
        // joiner leaves
        if (room.state === 'waiting') {
          room.b = null;
          room.expireTimer = setTimeout(() => {
            if (rooms.get(room.code) === room && room.state === 'waiting') destroyRoom(room, room.a.ws, 'expired');
          }, Math.max(1000, room.expiresAt - Date.now()));
          scheduleBotFill(room);
          send(room.a.ws, { type: 'lobby', room: summarizeRoom(room, room.a.ws) });
        } else {
          finishRace(room, 'quit', 'b');
          destroyRoom(room, room.a.ws, 'closed');
        }
      }
      return;
    }
  };

  const handleCreate = (ws, msg) => {
    // leave any room this socket is in
    dropPlayer(ws);
    const snippet = SNIPPETS.find((s) => s.id === String(msg.snippetId || '').slice(0, 40));
    if (!snippet) return send(ws, { type: 'createResult', ok: false, reason: 'badSnippet' });
    const durationSec = DURATIONS.has(Number(msg.durationSec)) ? Number(msg.durationSec) : 0;
    const code = randomCode(new Set(rooms.keys()));
    if (!code) return send(ws, { type: 'createResult', ok: false, reason: 'busy' });
    const now = Date.now();
    const room = {
      code,
      createdAt: now,
      expiresAt: now + ROOM_TTL_MS,
      state: 'waiting',
      config: { snippetId: snippet.id, durationSec, strict: Boolean(msg.strict), botAllowed: msg.botAllowed !== false },
      snippet,
      a: { ws, done: false, stats: null, finishedAt: 0, liveChars: 0 },
      b: null
    };
    rooms.set(code, room);
    room.expireTimer = setTimeout(() => {
      if (rooms.get(code) === room && room.state === 'waiting') destroyRoom(room, room.a.ws, 'expired');
    }, ROOM_TTL_MS);
    scheduleBotFill(room);
    send(ws, { type: 'createResult', ok: true, code, room: summarizeRoom(room, ws) });
  };

  const handleJoin = (ws, msg) => {
    const code = String(msg.code || '').replace(/\D/g, '').slice(0, 6);
    const room = rooms.get(code);
    if (!room || room.expiresAt < Date.now() || room.state !== 'waiting') {
      return send(ws, { type: 'joinResult', ok: false, code, reason: 'invalid' });
    }
    if (room.b) {
      return send(ws, { type: 'joinResult', ok: false, code, reason: 'full' });
    }
    dropPlayer(ws);
    room.b = { ws, done: false, stats: null, finishedAt: 0, liveChars: 0 };
    send(ws, { type: 'joinResult', ok: true, code, room: summarizeRoom(room, ws) });
    send(room.a.ws, { type: 'lobby', room: summarizeRoom(room, room.a.ws) });
    // both in — let the countdown run for 4s then race
    clearTimeout(room.expireTimer);
    if (room.botTimer) clearTimeout(room.botTimer);
    setTimeout(() => {
      if (rooms.get(code) === room && room.state === 'waiting' && room.b) startRace(room);
    }, 1200);
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
      if (msg.type === 'create') {
        handleCreate(ws, msg);
        return;
      }
      if (msg.type === 'join') {
        handleJoin(ws, msg);
        return;
      }
      if (msg.type === 'leave') {
        dropPlayer(ws);
        return;
      }
      // find the room this socket is in
      let room = null;
      let side = null;
      for (const r of rooms.values()) {
        if (r.a.ws === ws) {
          room = r;
          side = 'a';
          break;
        }
        if (r.b && r.b.ws === ws) {
          room = r;
          side = 'b';
          break;
        }
      }
      if (!room || room.state !== 'racing') return;
      const mine = side === 'a' ? room.a : room.b;
      const opp = side === 'a' ? room.b : room.a;
      if (msg.type === 'progress' && !mine.done) {
        mine.liveChars = Math.max(0, Math.min(Number(msg.chars) || 0, 100000));
        sendOpp(room, side, { type: 'opponent', chars: mine.liveChars, done: opp.done });
      } else if (msg.type === 'finish' && !mine.done) {
        mine.done = true;
        mine.stats = sanitizeStats(msg.stats);
        mine.finishedAt = Date.now();
        // FIRST TO FINISH wins — the race settles the instant anyone
        // finishes. The opponent is frozen exactly where they are (their
        // real progress, never a fake 100% "finished").
        if (opp.bot && !opp.done) settleBot(room, false);
        sendOpp(room, side, { type: 'opponent', chars: mine.liveChars || Number(msg.chars) || 0, done: true });
        finishRace(room, 'finish');
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
    // prune expired waiting rooms
    const now = Date.now();
    for (const room of [...rooms.values()]) {
      if (room.state === 'waiting' && room.expiresAt < now) destroyRoom(room, room.a.ws, 'expired');
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
