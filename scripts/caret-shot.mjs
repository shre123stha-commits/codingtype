import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForSelector('text=SHUFFLE TARGET', { timeout: 10000 });
await page.locator('text=TYPING ARENA').click();
await page.waitForTimeout(300);
await page.keyboard.type('function qu', { delay: 60 });
await page.waitForTimeout(700);

const rect = await page.locator('input[aria-label="typing capture"]').evaluate((el) => {
  const card = el.closest('.hud-card');
  const r = card.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: Math.min(240, r.height) };
});
await page.screenshot({
  path: '/home/user/codetype/.caret-shot.png',
  clip: { x: Math.max(0, rect.x), y: Math.max(0, rect.y), width: rect.width, height: rect.height }
});
console.log('errors:', errors.length ? errors.join('; ') : '(none)');
await browser.close();
