const PATTERNS = {
  '=>': ['f = (x) => x + 1;', 'map = arr.map((v) => v * 2);', 'cb = (err, ok) => done(err);'],
  '}': ['if (ok) { run(); }', 'for (let i = 0; i < n; i++) { sum += i; }', 'return { id, name };'],
  ';': ['let a = 1; let b = 2;', 'const x = f(y); x += 1;', 'init(); start(); stop();'],
  '[': ['const arr = [1, 2, 3];', 'let out = [a, b, c];', 'rows = ids.map((id) => [id, n]);'],
  '(': ['fn(a, b, c)', 'if (x > 0 && y < 9) {', 'let r = f(g(h(x)));'],
  ')': ['return f(x);', 'sum = arr.reduce((a, b) => a + b, 0);'],
  '{': ['const obj = { a: 1, b: 2 };', 'if (ok) {', 'let m = {}; m[k] = v;'],
  ':': ['const cfg = { port: 8080 };', 'case "x":', 'key: value,'],
  ',': ['foo(a, b, c)', 'return [x, y, z];', 'let p = new Point(1, 2);'],
  '_': ['user_id, item_id', 'let max_count = 0;', 'a_b_c = d_e_f;'],
  '=': ['a = b = c;', 'let x = 0;', 'if (x == y) {'],
  '-': ['let diff = a - b;', 'arr.slice(0, n - 1);', 'x -= 1;'],
  '>': ['while (i < n) {', 'if (a > b) return a;', 'let max = -1;'],
  '<': ['if (i < len) {', 'return a < b ? a : b;'],
  '!': ['if (!ok) return;', 'x !== null;', 'ok = !done;'],
  '&': ['a && b', 'if (x && y) {', 'let mask = 0xff & v;'],
  '|': ['a || b', 'flags = x | y;', 'v = 1 | 2;'],
  '/': ['let q = a / b;', 'path = base + "/" + x;'],
  '+': ['let sum = a + b;', 's = s + "x";', 'i += 2;'],
  '"': ['let s = "code";', 'log("ok", id);'],
  "'": ["let q = 'ok';", "name = 'dev';"]
};

const MAX_CHARS = 55;

export function buildAdaptiveDrill(symbols) {
  const list = (symbols && symbols.length ? symbols : [{ key: ';' }, { key: '}' }, { key: '=>' }]).map(
    (s) => s.key || s
  );
  const lines = [];
  let total = 0;
  let i = 0;
  let guard = 0;
  while (total < MAX_CHARS && lines.length < 4 && guard < 60) {
    guard += 1;
    const sym = list[i % list.length];
    const pool = PATTERNS[sym] || [`${sym} ${sym} ${sym};`];
    let line = null;
    for (const cand of pool) {
      if (!lines.includes(cand)) {
        line = cand;
        break;
      }
    }
    if (!line) {
      i += 1;
      continue;
    }
    lines.push(line);
    total += line.length;
    i += 1;
  }
  const code = lines.join('\n');
  return {
    id: `adaptive-${Date.now()}`,
    language: 'javascript',
    mode: 'sprint',
    title: 'AI MICRO-DRILL',
    source: `ai://drill${list.map((s) => `/${s}`).join('')}`,
    code,
    targets: list
  };
}
