import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForSelector('text=SHUFFLE TARGET', { timeout: 10000 });
await page.locator('text=TYPING ARENA').click();
await page.waitForTimeout(300);
await page.keyboard.type('function binarySear', { delay: 50 });
await page.waitForTimeout(700);

const rect = await page.locator('input[aria-label="typing capture"]').evaluate((el) => {
  const r = el.closest('.hud-card').getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: Math.min(230, r.height) };
});
await page.screenshot({ path: '/home/user/codetype/.v-running.png', clip: rect });

const runningState = await page.evaluate(() => ({
  restartBtn: !!document.querySelector('button[title^="Reset timer"]'),
  time: document.body.innerText.match(/TIME\s*\n?\s*(\d\d:\d\d)/)?.[1],
  badge: document.body.innerText.includes('ACTIVE')
}));
console.log('RUNNING:', JSON.stringify(runningState));

await page.locator('button[title^="Reset timer"]').click();
await page.waitForTimeout(400);

const afterReset = await page.evaluate(() => ({
  time: document.body.innerText.match(/TIME\s*\n?\s*(\d\d:\d\d)/)?.[1],
  prog: document.body.innerText.match(/PROG\s*\n?\s*(\d+)%/)?.[1],
  standby: document.body.innerText.includes('STANDBY'),
  restartGone: !document.querySelector('button[title^="Reset timer"]')
}));
console.log('AFTER RESTART:', JSON.stringify(afterReset));
await page.screenshot({ path: '/home/user/codetype/.v-reset.png', clip: rect });

console.log('errors:', errors.length ? errors.join('; ') : '(none)');
await browser.close();
