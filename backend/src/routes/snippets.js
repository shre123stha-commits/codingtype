import { Router } from 'express';

import { MODES, LANGUAGES, SNIPPETS } from '../../../shared/snippets.js';
import { queryInt, queryStr } from '../middleware/sanitize.js';

const router = Router();

function summarize(snippet) {
  const friction = (snippet.code.match(/[{}[\];.,:=<>!&|+\-*\/]/g) || []).length;
  return {
    id: snippet.id,
    language: snippet.language,
    mode: snippet.mode,
    title: snippet.title,
    source: snippet.source,
    chars: snippet.code.length,
    lines: snippet.code.split('\n').length,
    friction
  };
}

// ── Offset-based pagination, default 20 per page ───────────────────────────
// The catalog is a fixed curated list, so OFFSET is the right strategy: the
// client can jump to any page and the set never grows while it is paging.
// The frontend catalog loader walks pages of 100 until hasMore is false, so
// today's 82 snippets still cost exactly ONE request — but no list endpoint is
// left unbounded any more.
//   GET /api/snippets?mode=&language=&q=&limit=20&offset=0
//   → { count, total, limit, offset, hasMore, snippets }
router.get('/', (req, res) => {
  const mode = queryStr(req.query.mode, 24);
  const language = queryStr(req.query.language, 24);
  const q = queryStr(req.query.q, 120);
  const limit = queryInt(req.query.limit, { min: 1, max: 100, fallback: 20 });
  const offset = queryInt(req.query.offset, { min: 0, max: 100000, fallback: 0 });

  let list = SNIPPETS;
  if (mode) list = list.filter((s) => s.mode === mode);
  if (language) list = list.filter((s) => s.language === language);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter(
      (s) => s.title.toLowerCase().includes(needle) || s.source.toLowerCase().includes(needle)
    );
  }

  const page = list.slice(offset, offset + limit);
  res.json({
    count: page.length,
    total: list.length,
    limit,
    offset,
    hasMore: offset + page.length < list.length,
    snippets: page.map(summarize)
  });
});

router.get('/meta', (req, res) => {
  const counts = {};
  for (const s of SNIPPETS) {
    const key = `${s.mode}/${s.language}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  res.json({ languages: LANGUAGES, modes: MODES, total: SNIPPETS.length, counts });
});

router.get('/:id', (req, res) => {
  const id = queryStr(req.params.id, 80);
  if (!id) return res.status(400).json({ error: 'invalid_snippet_id' });
  const snippet = SNIPPETS.find((s) => s.id === id);
  if (!snippet) return res.status(404).json({ error: 'snippet_not_found' });
  res.json({ ...summarize(snippet), code: snippet.code });
});

export default router;
