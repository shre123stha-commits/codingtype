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
const ok = (name, cond) => console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('text=SHUFFLE TARGET', { timeout: 15000 });

// 1. tabs
for (const t of ['TRAIN', 'RACE', 'ANALYTICS']) {
  ok(`tab ${t} visible`, await page.locator(`nav button:has-text("${t}")`).count() === 1);
}

// 2. ANALYTICS view renders
await page.locator('nav button:has-text("ANALYTICS")').click();
await page.waitForTimeout(800);
ok('analytics: key heatmap', await page.locator('text=KEY HEATMAP').count() === 1);
ok('analytics: finger panel', await page.locator('text=FINGER STRENGTH').count() === 1);
ok('analytics: trend', await page.locator('text=VELOCITY TREND').count() === 1);
await shot(page, 'f-analytics.png');

// 3. back to TRAIN, DAILY section
await page.locator('nav button:has-text("TRAIN")').click();
await page.waitForTimeout(600);
const dailySrc = await page.locator('button:has-text("RUN DAILY")').count();
ok('daily: RUN DAILY button', dailySrc === 1);
await page.locator('button:has-text("RUN DAILY")').click();
await page.waitForTimeout(500);
const arenaSource = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('span')];
  const el = spans.find((s) => s.textContent?.startsWith('// ') && s.className.includes('truncate'));
  return el ? el.textContent.replace('//', '').trim() : null;
});
ok(`daily: loaded (${arenaSource})`, arenaSource === 'src/handlers/orders.rs');

// 4. AI micro-drill
await page.locator('button:has-text("GENERATE DRILL")').click();
await page.waitForTimeout(700);
const drillSource = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('span')];
  const el = spans.find((s) => s.textContent?.startsWith('// ') && s.className.includes('truncate'));
  return el ? el.textContent.replace('//', '').trim() : '';
});
ok(`ai-drill: loaded (${drillSource.slice(0, 24)}…)`, drillSource.startsWith('ai://drill'));

// 5. import code
await page.fill('textarea', 'let x = 1;\nconsole.log(x);');
await page.locator('button:has-text("LOAD AS TARGET")').click();
await page.waitForTimeout(500);
const impSource = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('span')];
  const el = spans.find((s) => s.textContent?.startsWith('// ') && s.className.includes('truncate'));
  return el ? el.textContent.replace('//', '').trim() : '';
});
ok(`import: loaded (${impSource})`, impSource.startsWith('import/'));

// 6. blind mode
await page.locator('button:has-text("BLIND WINDOW")').click();
await page.waitForTimeout(200);
ok('blind: chip ON (3 CH)', (await page.locator('button:has-text("BLIND: 3 CH")').count()) === 1);
await page.locator('text=TYPING ARENA').click();
await page.waitForTimeout(200);
await page.keyboard.type('let x', { delay: 40 });
await page.waitForTimeout(300);
ok('blind: hidden chars rendered', (await page.locator('.c-blind').count()) > 0);
await shot(page, 'f-blind.png', { clip: { x: 0, y: 100, width: 1280, height: 500 } });
await page.locator('button:has-text("BLIND: 3 CH")').click(); // OFF

// 7. ghost race: load a repo snippet, type it fully (creates charTimes PB), restart, type 1 char
await page.getByRole('button', { name: 'REAL-REPO', exact: true }).click();
await page.getByRole('button', { name: 'JS', exact: true }).click();
await page.waitForTimeout(700);
const res = await (await page.request.get('http://127.0.0.1:3001/api/snippets?mode=repo&language=javascript')).json();
const target = res.snippets[0];
const code = (await (await page.request.get(`http://127.0.0.1:3001/api/snippets/${target.id}`)).json()).code;
await page.locator(`button:has-text("${target.title}")`).first().click();
await page.waitForTimeout(400);
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

// 8. interview mode
await page.getByRole('button', { name: 'INTERVIEW', exact: true }).click();
await page.waitForTimeout(600);
const interviewLoaded = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('span')];
  const el = spans.find((s) => s.textContent?.startsWith('// ') && s.className.includes('truncate'));
  return el ? el.textContent.replace('//', '').trim() : '';
});
ok(`interview: auto-loaded (${interviewLoaded})`, interviewLoaded.startsWith('interview/'));

// 9. race tab
await page.locator('nav button:has-text("RACE")').click();
await page.waitForTimeout(400);
ok('race: lobby visible', (await page.locator('text=RACE LOBBY').count()) === 1);
await page.locator('button:has-text("JOIN QUICK RACE")').click();
await page.waitForTimeout(700);
ok('race: waiting state', (await page.locator('text=WAITING FOR OPPONENT').count()) === 1);
ok('race: forfeit button', (await page.locator('button:has-text("FORFEIT"), button:has-text("LEAVE LOBBY")').count()) === 1);
await page.locator('button:has-text("LEAVE LOBBY")').click();
await page.waitForTimeout(300);
ok('race: back to idle', (await page.locator('text=LOBBY IDLE').count()) === 1);
await shot(page, 'f-race.png');

console.log('--- errors ---');
console.log(errors.length ? errors.slice(0, 5).join('\n') : '(none)');
await browser.close();

// 10. real 2-player WS race
await twoPlayerRace();

async function twoPlayerRace() {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const url = 'ws://127.0.0.1:3001/api/ws';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const A = new WebSocket(url);
  const aMsgs = [];
  A.on('message', (d) => aMsgs.push(JSON.parse(d.toString())));
  await new Promise((r) => A.on('open', r));
  A.send(JSON.stringify({ type: 'join' }));
  await sleep(300);
  ok('ws: A waiting', aMsgs.some((m) => m.type === 'lobby' && m.state === 'waiting'));
  const B = new WebSocket(url);
  const bMsgs = [];
  B.on('message', (d) => bMsgs.push(JSON.parse(d.toString())));
  await new Promise((r) => B.on('open', r));
  B.send(JSON.stringify({ type: 'join' }));
  await new Promise((r) => setTimeout(r, 600));
  const aStart = aMsgs.find((m) => m.type === 'start');
  const bStart = bMsgs.find((m) => m.type === 'start');
  ok('ws: both got start + same snippet', !!aStart && !!bStart && aStart.snippet.id === bStart.snippet.id);
  const at = aStart.at;
  await new Promise((r) => setTimeout(r, at - Date.now() + 200));
  A.send(JSON.stringify({ type: 'progress', chars: 10 }));
  await new Promise((r) => setTimeout(r, 300));
  ok('ws: B saw A progress', bMsgs.some((m) => m.type === 'opponent' && m.chars === 10));
  A.send(JSON.stringify({ type: 'finish', stats: { wpm: 100, rawWpm: 110, cpm: 500, accuracy: 99, timeSec: 40, errors: 1 }, chars: 120 }));
  await new Promise((r) => setTimeout(r, 300));
  ok('ws: B saw A done', bMsgs.some((m) => m.type === 'opponent' && m.done));
  B.send(JSON.stringify({ type: 'finish', stats: { wpm: 80, rawWpm: 85, cpm: 400, accuracy: 95, timeSec: 55, errors: 5 }, chars: 120 }));
  await new Promise((r) => setTimeout(r, 500));
  const aRes = aMsgs.find((m) => m.type === 'result');
  const bRes = bMsgs.find((m) => m.type === 'result');
  ok('ws: results sent', !!aRes && !!bRes);
  ok('ws: A won (first finisher)', aRes?.winner === 'you' && bRes?.winner === 'opp');
  A.close();
  B.close();
}
