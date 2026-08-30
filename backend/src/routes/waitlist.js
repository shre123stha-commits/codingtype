// Waitlist — simple, dependency-free email collection for feature announcements.
// GET  /api/waitlist      → { ok, count }
// POST /api/waitlist      → { email } → { ok, count, already? }
//
// POST is behind the strict 5-per-15-minutes rate bucket (see server.js).
// The stored file is capped so a hostile flood can't grow it without bound.
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { email as toEmail, isPlainBody } from '../middleware/sanitize.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, '..', '..', 'data', 'waitlist.json');
const MAX_ROWS = 100000;

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
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
  fs.renameSync(tmp, FILE); // atomic — a crash can't leave a half-written list
};

router.get('/', (req, res) => {
  res.json({ ok: true, count: read().length });
});

router.post('/', (req, res) => {
  if (!isPlainBody(req.body)) {
    return res.status(400).json({ ok: false, error: 'invalid_payload' });
  }
  // Strict email regex + 200-char cap + case normalisation, all in one place.
  const clean = toEmail(req.body.email, 200);
  if (!clean) {
    return res.status(400).json({ ok: false, error: 'VALID EMAIL REQUIRED' });
  }
  const rows = read();
  if (rows.some((r) => r && r.email === clean)) {
    return res.json({ ok: true, count: rows.length, already: true });
  }
  if (rows.length >= MAX_ROWS) {
    return res.status(507).json({ ok: false, error: 'waitlist_full' });
  }
  rows.push({ email: clean, ts: new Date().toISOString() });
  write(rows);
  res.json({ ok: true, count: rows.length });
});

export default router;
