// Waitlist — simple, dependency-free email collection for feature announcements.
// GET  /api/waitlist      → { ok, count }
// POST /api/waitlist      → { email } → { ok, count, already? }
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, '..', '..', 'data', 'waitlist.json');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const router = Router();

const read = () => {
  try {
    const rows = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

const write = (rows) => {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
};

router.get('/', (req, res) => {
  res.json({ ok: true, count: read().length });
});

router.post('/', (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return res.status(400).json({ ok: false, error: 'VALID EMAIL REQUIRED' });
  }
  const rows = read();
  if (rows.some((r) => r.email === email)) {
    return res.json({ ok: true, count: rows.length, already: true });
  }
  rows.push({ email, ts: new Date().toISOString() });
  write(rows);
  res.json({ ok: true, count: rows.length });
});

export default router;
