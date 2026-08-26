// Raw WS race protocol test — verifies the fixed settle logic:
//  1. human vs human: A finishes first -> A gets winner 'you' immediately,
//     opp.done=false; B finishing later gets winner 'opp'.
//  2. human vs bot: human finishes early -> result within ~1s, winner 'you',
//     bot frozen at its real (partial) progress, honest partial stats,
//     NO fake 100% "opponent done" before the result.
// Run with the API up:  node scripts/verify-race.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'backend', 'package.json'));
const { WebSocket } = require('ws');

const SNIPPET_ID = 'js-alg-01';
const URL = 'ws://127.0.0.1:3001/api/ws';
let pass = 0;
let fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
};

function conn() {
  return new Promise((resolve) => {
    const ws = new WebSocket(URL);
    ws._msgs = [];
    ws.on('message', (buf) => {
      const m = JSON.parse(buf.toString());
      ws._msgs.push(m);
      if (ws._waiter && ws._waiter.type === m.type) {
        const w = ws._waiter;
        ws._waiter = null;
        w.resolve(m);
      }
    });
    ws.on('open', () => resolve(ws));
  });
}
const wait = (ws, type, timeout = 12000) =>
  new Promise((resolve, reject) => {
    const found = ws._msgs.find((m) => m.type === type);
    if (found) return resolve(found);
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeout);
    ws._waiter = {
      type,
      resolve: (m) => {
        clearTimeout(t);
        resolve(m);
      }
    };
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- case 1: human vs human, A finishes first ----------
{
  const a = await conn();
  const b = await conn();
  a.send(JSON.stringify({ type: 'create', snippetId: SNIPPET_ID, durationSec: 0, strict: false, botAllowed: false }));
  const created = await wait(a, 'createResult');
  ok('c1 create ok', created.ok === true);
  b.send(JSON.stringify({ type: 'join', code: created.code }));
  const joined = await wait(b, 'joinResult');
  ok('c1 join ok', joined.ok === true);
  await wait(a, 'lobby');
  const startA = await wait(a, 'start');
  const total = startA.snippet.code.length;
  ok('c1 both got start', (await wait(b, 'start')).type === 'start');

  // A sends progress then finishes first — race must settle at once
  a.send(JSON.stringify({ type: 'progress', chars: total }));
  const aFinishT = Date.now();
  a.send(JSON.stringify({ type: 'finish', stats: { wpm: 110, rawWpm: 120, cpm: 550, accuracy: 97, timeSec: 20, errors: 3 }, chars: total }));
  const resA = await wait(a, 'result', 3000);
  const settleMs = Date.now() - aFinishT;
  ok('c1 A wins (finished first)', resA.winner === 'you', `settled in ${settleMs}ms`);
  ok('c1 A result reason=finish', resA.reason === 'finish');
  ok('c1 opponent NOT marked done', resA.opp.done === false, `opp.done=${resA.opp.done}`);
  ok('c1 A stats preserved', resA.you.stats.wpm === 110);
  ok('c1 B stats null (never finished)', resA.opp.stats === null);

  // B gets the loss the same instant — no waiting
  const resB = await wait(b, 'result', 1500);
  ok('c1 B loses, settled immediately', resB.winner === 'opp');
  ok('c1 B sees A done at A\'s chars', resB.opp.done === true && resB.opp.stats.wpm === 110);
  // any late finish from B is ignored — no second result for A
  b.send(JSON.stringify({ type: 'progress', chars: Math.floor(total * 0.7) }));
  b.send(JSON.stringify({ type: 'finish', stats: { wpm: 80, rawWpm: 85, cpm: 400, accuracy: 95, timeSec: 26, errors: 5 }, chars: total }));
  await sleep(500);
  ok('c1 late finish ignored', a._msgs.filter((m) => m.type === 'result').length === 1);
  a.close();
  b.close();
}

// ---------- case 2: human vs bot, human finishes first ----------
{
  const a = await conn();
  a.send(JSON.stringify({ type: 'create', snippetId: SNIPPET_ID, durationSec: 0, strict: false, botAllowed: true }));
  const created = await wait(a, 'createResult');
  ok('c2 create ok', created.ok === true);
  // bot fills after 8s
  const lobby = await wait(a, 'lobby', 12000);
  ok('c2 bot filled lobby', Boolean(lobby.room.opp && lobby.room.opp.bot), lobby.room.opp?.name);
  const startA = await wait(a, 'start');
  const total = startA.snippet.code.length;
  // wait past the 4s countdown + ~2s of real bot typing, then finish fast
  await sleep(6000);
  const oppMsgs = a._msgs.filter((m) => m.type === 'opponent');
  const botCharsSeen = oppMsgs.length ? oppMsgs[oppMsgs.length - 1].chars : 0;
  ok('c2 bot actually typing', botCharsSeen > 0, `chars=${botCharsSeen}`);
  a.send(JSON.stringify({ type: 'progress', chars: total }));
  const t0 = Date.now();
  a.send(JSON.stringify({ type: 'finish', stats: { wpm: 130, rawWpm: 140, cpm: 650, accuracy: 98, timeSec: 12, errors: 2 }, chars: total }));
  const resA = await wait(a, 'result', 2500);
  const settleMs = Date.now() - t0;
  ok('c2 A wins (finished first)', resA.winner === 'you', `settled in ${settleMs}ms`);
  ok('c2 settled IMMEDIATELY (<1s)', settleMs < 1000, `${settleMs}ms`);
  ok('c2 bot frozen, NOT "done"', resA.opp.done === false, `opp.done=${resA.opp.done}`);
  ok('c2 bot stats present (partial)', resA.opp.stats && resA.opp.stats.wpm > 0 && resA.opp.stats.wpm < 130, `bot wpm=${resA.opp.stats?.wpm}`);
  ok('c2 bot timeSec is partial (<15s)', resA.opp.stats.timeSec < 15, `${resA.opp.stats.timeSec}s`);
  ok('c2 bot wpm plausible (<250)', resA.opp.stats.wpm < 250);
  // the last opponent ping before the result must NOT claim 100% done
  const lastOpp = [...a._msgs].reverse().find((m) => m.type === 'opponent');
  ok('c2 no fake 100% opponent', !lastOpp || lastOpp.done === false || lastOpp.chars < total, `chars=${lastOpp?.chars}/${total} done=${lastOpp?.done}`);
  ok('c2 bot frozen near where it was', resA.opp.stats.cpm > 0 && botCharsSeen > 0 && resA.opp.stats.timeSec < 10, `bot cpm=${resA.opp.stats?.cpm} seen=${botCharsSeen}`);
  a.close();
  await sleep(200);
}

console.log(fail === 0 ? `RACE_RAW_PASS (${pass}/${pass + fail})` : `RACE_RAW_FAIL (${fail} failed)`);
process.exit(fail === 0 ? 0 : 1);
