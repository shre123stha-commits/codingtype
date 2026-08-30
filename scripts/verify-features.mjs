import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'backend', 'package.json'));
const { WebSocket } = require('ws');

const shotDir = path.join(os.tmpdir(), 'codetype-e2e');
fs.mkdirSync(shotDir, { recursive: true });
// debug screenshots are non-fatal; written to the OS temp dir, never the repo
const shot = async (page, name, opts = {}) => {
  try {
    await page.screenshot({ path: path.join(shotDir, name), ...opts });
  } catch {
    /* ignore */
  }
};

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('fonts.')) errors.push(`console: ${m.text()}`);
});
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url().slice(0, 140)}`);
});
let passCount = 0;
let failCount = 0;
const ok = (name, cond) => {
  if (cond) passCount++;
  else failCount++;
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
};

// deck tab rail helper (left rail of the TRAIN control deck)
const TITLES = {
  DAILY: 'DAILY CHALLENGE',
  DRILL: 'DRILL CATEGORY',
  TARGET: 'TARGETS',
  IMPORT: 'IMPORT CODE',
  AI: 'AI MICRO-DRILL'
};
const deckTab = (label) => page.locator(`nav[aria-label="control deck sections"] button[title="${TITLES[label]}"]`);
const deckContent = page.locator('nav[aria-label="control deck sections"] ~ div');

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('text=CONTROL DECK', { timeout: 15000 });

// 1. tabs + features menu
for (const t of ['TRAIN', 'RACE', 'ANALYTICS']) {
  ok(`tab ${t} visible`, await page.locator(`header nav button:has-text("${t}")`).count() === 1);
}
await page.locator('header nav button:has-text("FEATURES")').click();
await page.waitForTimeout(300);
ok('features: dropdown lists areas', (await page.locator('text=DAILY CHALLENGE').count()) >= 1 && (await page.locator('text=KEY HEATMAP').count()) >= 1);
// direct navigation from menu items
await page.locator('[role="menu"] button:has-text("AI MICRO-DRILL")').click();
await page.waitForTimeout(400);
ok('features: AI item navigates (train + AI tab)', (await deckContent.locator('button:has-text("GENERATE DRILL")').count()) === 1);
await page.locator('header nav button:has-text("FEATURES")').click();
await page.waitForTimeout(200);
await page.locator('[role="menu"] button:has-text("DAILY CHALLENGE")').click();
await page.waitForTimeout(300);
ok('features: DAILY item navigates (train + daily tab)', (await page.locator('button:has-text("RUN DAILY")').count()) === 1);

// 2. ANALYTICS view renders
await page.locator('header nav button:has-text("ANALYTICS")').click();
await page.waitForTimeout(800);
ok('analytics: key heatmap', await page.locator('text=KEY HEATMAP').count() === 1);
ok('analytics: finger panel', await page.locator('text=FINGER STRENGTH').count() === 1);
ok('analytics: trend', await page.locator('text=VELOCITY TREND').count() === 1);
// no element inside the heatmap card may stick out of the card box
const heatFit = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.hud-card')].find((c) => c.textContent?.includes('TOP FRICTION KEYS'));
  if (!card) return { found: false, worst: 0 };
  const cr = card.getBoundingClientRect();
  let worst = 0;
  for (const el of card.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    worst = Math.max(worst, r.right - cr.right, r.bottom - cr.bottom);
  }
  return { found: true, worst: Math.round(worst * 100) / 100 };
});
ok(`analytics: heatmap content fits its box (worst overflow ${heatFit.worst}px)`, heatFit.found && heatFit.worst <= 1);
await shot(page, 'f-analytics.png');

// 3. back to TRAIN, DAILY tab (default)
await page.locator('header nav button:has-text("TRAIN")').click();
await page.waitForTimeout(600);
const dailyMeta = await (await page.request.get('http://127.0.0.1:3001/api/daily')).json();
const dailyFull = await (await page.request.get(`http://127.0.0.1:3001/api/snippets/${dailyMeta.snippetId}`)).json();
ok('daily: RUN DAILY button', (await page.locator('button:has-text("RUN DAILY")').count()) === 1);
ok('daily: preview shown', (await page.locator('pre').count()) >= 1);
await page.locator('button:has-text("RUN DAILY")').click();
await page.waitForTimeout(700);
const arenaSource = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('span')];
  const el = spans.find((s) => s.textContent?.startsWith('// ') && s.className.includes('truncate'));
  return el ? el.textContent.replace('//', '').trim() : null;
});
ok(`daily: loaded (${arenaSource})`, arenaSource === dailyFull.source);

// 4. AI micro-drill (AI tab)
await deckTab('AI').click();
await page.waitForTimeout(200);
await page.locator('button:has-text("GENERATE DRILL")').click();
await page.waitForTimeout(700);
const drillSource = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('span')];
  const el = spans.find((s) => s.textContent?.startsWith('// ') && s.className.includes('truncate'));
  return el ? el.textContent.replace('//', '').trim() : '';
});
ok(`ai-drill: loaded (${drillSource.slice(0, 24)}…)`, drillSource.startsWith('ai://drill'));

// 5. import code (IMPORT tab)
await deckTab('IMPORT').click();
await page.waitForTimeout(200);
await page.fill('textarea', 'let x = 1;\nconsole.log(x);');
await page.locator('button:has-text("LOAD AS TARGET")').click();
await page.waitForTimeout(700);
const impSource = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('span')];
  const el = spans.find((s) => s.textContent?.startsWith('// ') && s.className.includes('truncate'));
  return el ? el.textContent.replace('//', '').trim() : '';
});
ok(`import: loaded (${impSource})`, impSource.startsWith('import/'));

// 5b. targets dropdown lists >= 10 for the language (TARGET tab)
await deckTab('TARGET').click();
await page.waitForTimeout(200);
await deckContent.locator('button[aria-expanded]').first().click();
await page.waitForTimeout(300);
const targetRows = await deckContent.locator('div.max-h-60 button').count();
ok(`targets: dropdown lists ${targetRows} targets (>= 10)`, targetRows >= 10);

// 6. blind mode (live HUD chip — MODES & FLAGS tab moved into the HUD)
const hud = page.locator('div.hud-card').filter({ hasText: 'WPM' }).first();
await hud.getByRole('button', { name: 'BLIND', exact: true }).click(); // OFF -> 3CH
await page.waitForTimeout(200);
ok('blind: HUD chip ON (3 CH)', (await hud.getByRole('button', { name: 'BLIND 3CH', exact: true }).count()) === 1);
await page.locator('text=TYPING ARENA').click();
await page.waitForTimeout(200);
await page.keyboard.type('let x', { delay: 40 });
await page.waitForTimeout(300);
ok('blind: hidden chars rendered', (await page.locator('.c-blind').count()) > 0);
await shot(page, 'f-blind.png', { clip: { x: 0, y: 100, width: 1280, height: 500 } });
await hud.getByRole('button', { name: 'BLIND 3CH', exact: true }).click(); // 3CH -> FULL
ok('blind: cycles to FULL', (await hud.getByRole('button', { name: 'BLIND FULL', exact: true }).count()) === 1);
await hud.getByRole('button', { name: 'BLIND FULL', exact: true }).click(); // FULL -> OFF

// 7. ghost race: load a repo snippet via TARGET dropdown, type it fully (creates charTimes PB), restart, type 1 char
await deckTab('DRILL').click();
await page.getByRole('button', { name: 'REAL-REPO', exact: true }).click();
// language now lives in the centered home row, not the deck
await page.locator('div[aria-label="choose language"] button:has-text("JAVASCRIPT")').click();
await page.waitForTimeout(700);
const res = await (await page.request.get('http://127.0.0.1:3001/api/snippets?mode=repo&language=javascript')).json();
const target = res.snippets[0];
const code = (await (await page.request.get(`http://127.0.0.1:3001/api/snippets/${target.id}`)).json()).code;
await deckTab('TARGET').click();
await page.waitForTimeout(200);
await deckContent.locator('button[aria-expanded]').first().click();
await page.waitForTimeout(300);
await deckContent.locator(`button:has-text("${target.title}")`).first().click();
await page.waitForTimeout(700);
await page.locator('text=TYPING ARENA').click();
await page.keyboard.type(code, { delay: 8 });
await page.waitForTimeout(1200);
ok('ghost: first run finished', (await page.locator('text=TELEMETRY DUMP').count()) === 1);
// share card on dashboard
const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await page.locator('button:has-text("SHARE PNG")').click();
const dl = await downloadPromise;
ok('share: png download triggered', dl !== null);
// restart (RUN AGAIN) and type a few chars to activate ghost
await page.locator('button:has-text("RUN AGAIN")').click();
await page.waitForTimeout(400);
await page.locator('text=TYPING ARENA').click();
await page.keyboard.type(code.slice(0, 12), { delay: 60 });
await page.waitForTimeout(600);
ok('ghost: RACE delta chip live', (await page.locator('text=RACE Δ').count()) === 1);
await shot(page, 'f-ghost.png', { clip: { x: 0, y: 60, width: 1280, height: 620 } });

// 8. interview mode (DRILL tab)
await deckTab('DRILL').click();
await page.getByRole('button', { name: 'INTERVIEW', exact: true }).click();
await page.waitForTimeout(800);
const interviewLoaded = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('span')];
  const el = spans.find((s) => s.textContent?.startsWith('// ') && s.className.includes('truncate'));
  return el ? el.textContent.replace('//', '').trim() : '';
});
ok(`interview: auto-loaded (${interviewLoaded})`, interviewLoaded.startsWith('interview/'));

// 9. race view — reached via the FEATURES menu (direct navigation)
await page.locator('header nav button:has-text("FEATURES")').click();
await page.waitForTimeout(300);
await page.locator('[role="menu"] button:has-text("GHOST RACE")').click();
await page.waitForTimeout(600);
ok('race: both cards visible (GHOST RACE + 1V1 QUICK RACE)', (await page.locator('text=GHOST RACE').count()) >= 1 && (await page.locator('text=1V1 QUICK RACE').count()) >= 1);

// 9a. ghost card reflects practice data (PB list, or first-visit prompt)
const pbestList = await (await page.request.get('http://127.0.0.1:3001/api/sessions/pbest-snippets')).json();
if (pbestList.snippets.length === 0) {
  ok('race: ghost first-visit prompt (no practice data)', (await page.locator('text=DO A PRACTICE SESSION').count()) === 1);
} else {
  ok(
    `race: ghost PB selector lists ${pbestList.snippets.length} PBs`,
    (await page.locator('select[aria-label="ghost target"] option').count()) === pbestList.snippets.length
  );
}

// 9b. join flow: invalid code → error + re-enter stays possible
await page.locator('button:has-text("JOIN RACE (HAVE A CODE?)")').click();
await page.waitForTimeout(300);
await page.fill('input[aria-label="race code"]', '999999');
await page.locator('button:has-text("⊕ JOIN RACE")').click();
await page.waitForTimeout(800);
ok('race: invalid code → INVALID CODE error', (await page.locator('text=INVALID CODE — CHECK AND RE-ENTER').count()) === 1);
ok('race: re-enter possible (code input still there)', (await page.locator('input[aria-label="race code"]').count()) === 1);
await shot(page, 'f-race-join-invalid.png');
await page.locator('button:has-text("← BACK")').click();
await page.waitForTimeout(300);

// 9c. create flow: language/target pick → 6-digit code + expiry → cancel
await page.locator('button:has-text("⚔ CREATE RACE")').click(); // menu button
await page.waitForTimeout(300);
await page.selectOption('select[aria-label="race language"]', 'python');
await page.waitForTimeout(200);
await page.locator('button:has-text("⚔ CREATE RACE")').last().click(); // form button
await page.waitForTimeout(900);
ok('race: create → 6-digit code shown', (await page.locator('text=/^[0-9]{6}$/').count()) >= 1);
ok('race: code expiry countdown shown', (await page.locator('text=CODE EXPIRES IN').count()) === 1);
ok('race: waiting for opponent', (await page.locator('text=WAITING FOR OPPONENT').count()) === 1);
await shot(page, 'f-race-create.png');
await page.locator('button:has-text("CANCEL RACE")').click();
await page.waitForTimeout(500);
ok('race: cancel → back to menu', (await page.locator('button:has-text("JOIN RACE (HAVE A CODE?)")').count()) === 1);

// 9d. bot fills a solo lobby after 8s, then cancel
await page.locator('button:has-text("⚔ CREATE RACE")').click();
await page.waitForTimeout(300);
await page.locator('button:has-text("⚔ CREATE RACE")').last().click();
await page.waitForTimeout(9500);
ok('race: bot auto-joined after 8s (CT-BOT)', (await page.locator('text=CT-BOT').count()) >= 1);
await shot(page, 'f-race-bot.png');
// by now the synced start has begun → button is FORFEIT (or CANCEL if still waiting)
await page.locator('button:has-text("CANCEL RACE"), button:has-text("FORFEIT")').first().click();
await page.waitForTimeout(500);
ok('race: bot race cancelled → menu', (await page.locator('button:has-text("JOIN RACE (HAVE A CODE?)")').count()) === 1);
await shot(page, 'f-race.png');

console.log('--- errors ---');
console.log(errors.length ? errors.slice(0, 5).join('\n') : '(none)');
await browser.close();

// 10. real 2-player WS race (code-lobby protocol)
await twoPlayerRace();

async function twoPlayerRace() {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const url = 'ws://127.0.0.1:3001/api/ws';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const client = (tag) => {
    const ws = new WebSocket(url);
    const msgs = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
    return { tag, ws, msgs };
  };
  const A = client('A');
  await new Promise((r) => A.ws.on('open', r));
  A.ws.send(JSON.stringify({ type: 'create', snippetId: 'js-alg-01', durationSec: 0, strict: false, botAllowed: false }));
  await sleep(300);
  const cr = A.msgs.find((m) => m.type === 'createResult');
  ok('ws: create ok + random 6-digit code', !!cr && cr.ok === true && /^\d{6}$/.test(cr.code));
  const code = cr?.code;

  // invalid code → invalid
  const C = client('C');
  await new Promise((r) => C.ws.on('open', r));
  C.ws.send(JSON.stringify({ type: 'join', code: '999999' }));
  await sleep(300);
  ok('ws: invalid code rejected', C.msgs.some((m) => m.type === 'joinResult' && m.ok === false && m.reason === 'invalid'));
  C.ws.close();

  // valid code + 1 person in lobby → join ok
  const B = client('B');
  await new Promise((r) => B.ws.on('open', r));
  B.ws.send(JSON.stringify({ type: 'join', code }));
  await sleep(300);
  ok('ws: B joined by code', B.msgs.some((m) => m.type === 'joinResult' && m.ok === true));
  ok('ws: A lobby shows opponent', A.msgs.some((m) => m.type === 'lobby' && m.room.opp));

  // 3rd person → lobby full
  const D = client('D');
  await new Promise((r) => D.ws.on('open', r));
  D.ws.send(JSON.stringify({ type: 'join', code }));
  await sleep(300);
  ok('ws: lobby full (2/2)', D.msgs.some((m) => m.type === 'joinResult' && m.ok === false && m.reason === 'full'));
  D.ws.close();

  // auto-start ~1.2s after join, then race
  await sleep(1500);
  const aStart = A.msgs.find((m) => m.type === 'start');
  const bStart = B.msgs.find((m) => m.type === 'start');
  ok('ws: both got start + same snippet', !!aStart && !!bStart && aStart.snippet.id === bStart.snippet.id);
  A.ws.send(JSON.stringify({ type: 'progress', chars: 10 }));
  await sleep(300);
  ok('ws: B saw A progress', B.msgs.some((m) => m.type === 'opponent' && m.chars === 10));
  A.ws.send(JSON.stringify({ type: 'finish', stats: { wpm: 100, rawWpm: 110, cpm: 500, accuracy: 99, timeSec: 40, errors: 1 }, chars: 120 }));
  await sleep(300);
  ok('ws: B saw A done', B.msgs.some((m) => m.type === 'opponent' && m.done));
  B.ws.send(JSON.stringify({ type: 'finish', stats: { wpm: 80, rawWpm: 85, cpm: 400, accuracy: 95, timeSec: 55, errors: 5 }, chars: 120 }));
  await sleep(500);
  const aRes = A.msgs.find((m) => m.type === 'result');
  const bRes = B.msgs.find((m) => m.type === 'result');
  ok('ws: results sent', !!aRes && !!bRes);
  ok('ws: A won (first finisher)', aRes?.winner === 'you' && bRes?.winner === 'opp');
  A.ws.close();
  B.ws.close();
}

console.log(`\nE2E TOTAL: ${passCount} pass, ${failCount} fail${errors.length ? `, console/http: ${errors.length}` : ''}`);
// http 404s are expected "no data yet" responses (pbest, benchmark); page errors are not
const hardErrors = errors.filter((e) => e.startsWith('pageerror'));
process.exitCode = failCount || hardErrors.length ? 1 : 0;
