import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'load', timeout: 30000 });
await page.waitForSelector('text=SHUFFLE TARGET', { timeout: 10000 });

// --- Feature 1: theme dropdown ---
await page.locator('button:has-text("THEMES")').click();
await page.waitForTimeout(150);
const menuItems = await page.locator('[role="menu"] button').allInnerTexts();
console.log('MENU ITEMS:', menuItems.map((s) => s.trim()).join(' | '));
await page.screenshot({ path: '/home/user/codetype/.shot-menu.png' });
await page.locator('[role="menu"] button:has-text("PAPER")').click();
await page.waitForTimeout(200);
const dataTheme = await page.evaluate(() => document.documentElement.dataset.theme);
const menuClosed = await page.locator('[role="menu"]').count();
console.log('THEME AFTER CLICK:', dataTheme, '| menu closed:', menuClosed === 0);

// --- Feature 2: glow typing, no shift ---
const snippetSource = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('span')];
  const el = spans.find((s) => s.textContent?.startsWith('// ') && s.className.includes('truncate'));
  return el ? el.textContent.replace('//', '').trim() : null;
});
const res = await (await page.request.get('http://127.0.0.1:3001/api/snippets')).json();
const sn = res.snippets.find((s) => s.source === snippetSource);
const code = (await (await page.request.get(`http://127.0.0.1:3001/api/snippets/${sn.id}`)).json()).code;
console.log(`TYPING ${code.length} CHARS of ${sn.id} (paper theme)`);

await page.locator('text=TYPING ARENA').click();

// type first chunk, with one deliberate wrong key at pos 12
const wrongAt = 12;
const wrongKey = code[wrongAt] === 'q' ? 'z' : 'q';
const seq = code.slice(0, wrongAt) + wrongKey + code.slice(wrongAt + 1);
await page.keyboard.type(seq.slice(0, 60), { delay: 20 });
await page.keyboard.type(seq.slice(60, 100), { delay: 250 }); // slow: catch glow
await page.screenshot({ path: '/home/user/codetype/.shot-typing.png' });

const states = await page.evaluate(() => {
  const q = (sel) => document.querySelectorAll(sel).length;
  return {
    done: q('.c-done'),
    err: q('.c-err'),
    curr: q('.c-curr'),
    caret: q('.animate-blink')
  };
});
console.log('MID-STATE counts:', JSON.stringify(states));

await page.keyboard.type(seq.slice(100), { delay: 15 });
await page.waitForTimeout(1200);
const body = await page.evaluate(() => document.body.innerText);
console.log('FINISHED:', body.includes('TELEMETRY DUMP'));
const errCountShown = await page.evaluate(() => {
  const m = document.body.innerText.match(/ERRORS\s*\n?\s*(\d+)/i);
  return m ? m[1] : '?';
});
console.log('ERRORS SHOWN ON DASH:', errCountShown, '(expected 1)');
await page.screenshot({ path: '/home/user/codetype/.shot-final.png', fullPage: false });

console.log('--- ERRORS ---');
console.log(errors.length ? errors.join('\n\n') : '(none)');
await browser.close();
