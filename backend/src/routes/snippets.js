import { Router } from 'express';

import { MODES, LANGUAGES, SNIPPETS } from '../../../shared/snippets.js';

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

router.get('/', (req, res) => {
  const { mode, language, q } = req.query;
  let list = SNIPPETS;
  if (mode) list = list.filter((s) => s.mode === mode);
  if (language) list = list.filter((s) => s.language === language);
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter(
      (s) => s.title.toLowerCase().includes(needle) || s.source.toLowerCase().includes(needle)
    );
  }
  res.json({ count: list.length, snippets: list.map(summarize) });
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
  const snippet = SNIPPETS.find((s) => s.id === req.params.id);
  if (!snippet) return res.status(404).json({ error: 'snippet_not_found' });
  res.json({ ...summarize(snippet), code: snippet.code });
});

export default router;
