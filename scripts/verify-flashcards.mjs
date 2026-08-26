// E2E for the flash-card feature + the race-result glitch fix:
//  1. FEATURES menu lists FLASH CARDS and navigates to the deck tab (canvas preview + actions)
//  2. deck tab 08 (FLASH CARDS) is directly clickable
//  3. profile card: PNG download fires, card is painted, QR white-box present
//  4. full bot race through the UI: create → bot joins → countdown → type the code →
//     VICTORY (first finisher) with NO stale DEFEAT and NO lingering "waiting" state,
//     then the 3 share buttons: RACE FLASH CARD / PROFILE CARD / SHARE RESULT modals.
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const shotDir = path.join(os.tmpdir(), 'codetype-e2e');
fs.mkdirSync(shotDir, { recursive: true });

const shot = async (page, name, opts = {}) => {
  try {
    await page.screenshot({ path: path.join(shotDir, name), ...opts });
  } catch {
    /* ignore */
  }
};

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1440, height: 900 } });
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

const previewCanvas = page.locator('canvas[aria-label="profile flash card preview"]');

// click with retries — the sticky header can briefly cover targets while the
// first paint settles
const click = async (locator, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try {
      await locator.click({ timeout: 4000 });
      return;
    } catch {
      await page.waitForTimeout(400);
    }
  }
  await locator.click({ timeout: 4000 });
};

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('text=CONTROL DECK', { timeout: 15000 });
await page.waitForTimeout(600);

// 1. FEATURES menu → FLASH CARDS
await click(page.locator('nav button:has-text("FEATURES")'));
await page.waitForTimeout(300);
ok('features menu lists FLASH CARDS', (await page.locator('[role="menu"] button:has-text("FLASH CARDS")').count()) === 1);
await click(page.locator('[role="menu"] button:has-text("FLASH CARDS")'));
// card render is async (font load + canvas paint) — wait for it, don't guess
await previewCanvas.waitFor({ state: 'visible', timeout: 10000 });
await page.waitForFunction(
  () => {
    const c = document.querySelector('canvas[aria-label="profile flash card preview"]');
    if (!c) return false;
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let nonBlank = 0;
    for (let i = 0; i < data.length; i += 16) if (data[i] + data[i + 1] + data[i + 2] > 90) nonBlank++;
    return nonBlank > 1000;
  },
  { timeout: 10000 }
).catch(() => {});
ok('flash tab: profile card preview canvas rendered', (await previewCanvas.count()) === 1);
ok('flash tab: DOWNLOAD PNG action', (await page.locator('button:has-text("⤓ DOWNLOAD PNG")').count()) >= 1);
ok('flash tab: COPY IMAGE action', (await page.locator('button:has-text("⧉ COPY IMAGE")').count()) >= 1);
ok('flash tab: POST ON X action', (await page.locator('button:has-text("POST ON X")').count()) >= 1);

// card is actually painted (not a blank canvas) + QR white box present
const cardStats = await page.evaluate(() => {
  const c = document.querySelector('canvas[aria-label="profile flash card preview"]');
  if (!c) return { found: false };
  const ctx = c.getContext('2d');
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let nonBlank = 0;
  let white = 0;
  for (let i = 0; i < data.length; i += 16) {
    if (data[i] + data[i + 1] + data[i + 2] > 90) nonBlank++;
    if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235) white++;
  }
  return { found: true, w: c.width, h: c.height, nonBlank, white };
});
ok(`flash tab: card painted (${cardStats.nonBlank} sampled px)`, cardStats.found && cardStats.nonBlank > 1000);
ok(`flash tab: QR white box present (${cardStats.white} sampled white px)`, cardStats.white > 1500);
// buttons must be full-width rows in the 300px deck rail, not squashed slivers
const btnRect = await page.locator('button:has-text("⤓ DOWNLOAD PNG")').first().boundingBox();
ok(`flash tab: action buttons not squashed (w=${Math.round(btnRect?.width ?? 0)}px)`, (btnRect?.width ?? 0) >= 150);
await shot(page, 'fc-profile-tab.png');

// 2. deck tab 08 directly clickable
await click(page.locator('nav button:has-text("TRAIN")'));
await page.waitForTimeout(500);
await click(page.locator('nav[aria-label="control deck sections"] button[title="FLASH CARDS"]'));
await previewCanvas.waitFor({ state: 'visible', timeout: 10000 });
await page.waitForTimeout(400);
ok('deck tab 08: direct click lands on flash cards', (await previewCanvas.count()) === 1);

// 3. download fires
const dlPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await click(page.locator('button:has-text("⤓ DOWNLOAD PNG")').first());
const dl = await dlPromise;
ok('flash tab: PNG download fires', dl !== null);

// 4. full bot race through the UI
await click(page.locator('nav button:has-text("RACE")'));
await page.waitForTimeout(600);
await click(page.locator('button:has-text("CREATE RACE")').first());
await page.waitForTimeout(300);
await page.selectOption('select[aria-label="race language"]', 'python');
await page.waitForTimeout(300);
const targetId = await page.locator('select[aria-label="race target"] option').first().getAttribute('value');
const snippet = await (await page.request.get(`http://127.0.0.1:3001/api/snippets/${targetId}`)).json();
const code = snippet.code || snippet.source;
ok(`race: snippet fetched (${snippet.title || targetId}, ${code.length} chars)`, code.length > 50);
await click(page.locator('button:has-text("⚔ CREATE RACE")').last());
// bot fills the solo lobby at 8s and the synced start begins immediately —
// the lobby card flips to "OPPONENT FOUND — SYNCING START" (a human join would
// show "OPPONENT CONNECTED" first; accept either)
await page.waitForSelector('text=/OPPONENT (CONNECTED|FOUND)/', { timeout: 20000 });
ok('race: opponent in lobby (bot filled at 8s)', true);
await shot(page, 'fc-race-lobby.png');
// synced countdown: wait for it to appear, then for it to go (race is live)
await page.waitForSelector('text=SYNC START', { timeout: 15000 });
await page.waitForSelector('text=SAME TARGET FOR BOTH PLAYERS', { state: 'detached', timeout: 15000 });
await page.waitForTimeout(300);
await click(page.locator('text=TYPING ARENA'));
await page.keyboard.type(code, { delay: 8 });
await page.waitForSelector('text=VICTORY', { timeout: 25000 });
ok('race: VICTORY shown (finished first)', true);
ok('race: NO DEFEAT text on screen', (await page.locator('text=DEFEAT').count()) === 0);
ok('race: waiting state cleared (result landed)', (await page.locator('text=FINISHED — WAITING FOR RIVAL').count()) === 0);
const record = await page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem('codetype-race-record') || 'null');
  } catch {
    return null;
  }
});
ok(`race: career record persisted (${JSON.stringify(record)})`, !!record && (record.w ?? 0) >= 1);
ok('race: 3 share buttons on result card',
  (await page.locator('button:has-text("⚡ RACE FLASH CARD")').count()) === 1 &&
  (await page.locator('button:has-text("▣ PROFILE CARD")').count()) === 1 &&
  (await page.locator('button:has-text("⇗ SHARE RESULT")').count()) === 1);
await shot(page, 'fc-race-result.png');

// race flash card modal
await page.locator('button:has-text("⚡ RACE FLASH CARD")').click();
await page.waitForTimeout(1200);
let dlg = page.locator('[role="dialog"]');
ok('race card: modal opens', (await dlg.count()) === 1);
ok('race card: PNG preview in modal', (await dlg.locator('img[src^="data:image/png"]').count()) === 1);
ok('race card: share actions present',
  (await dlg.locator('button:has-text("⤓ DOWNLOAD PNG")').count()) === 1 &&
  (await dlg.locator('button:has-text("𝕏 POST ON X")').count()) === 1);
await shot(page, 'fc-race-card-modal.png');
await page.locator('[role="dialog"] button[aria-label="close card"]').click();
await page.waitForTimeout(400);
ok('race card: modal closes', (await page.locator('[role="dialog"]').count()) === 0);

// direct result share modal
await page.locator('button:has-text("⇗ SHARE RESULT")').click();
await page.waitForTimeout(1200);
dlg = page.locator('[role="dialog"]');
ok('result card: modal opens with PNG', (await dlg.count()) === 1 && (await dlg.locator('img[src^="data:image/png"]').count()) === 1);
await shot(page, 'fc-result-card-modal.png');
await page.locator('[role="dialog"] button[aria-label="close card"]').click();
await page.waitForTimeout(400);

console.log('--- errors ---');
console.log(errors.length ? errors.slice(0, 5).join('\n') : '(none)');
await browser.close();

console.log(`\nFLASH-CARDS E2E TOTAL: ${passCount} pass, ${failCount} fail${errors.length ? `, console/http: ${errors.length}` : ''}`);
const hardErrors = errors.filter((e) => e.startsWith('pageerror'));
process.exitCode = failCount || hardErrors.length ? 1 : 0;
