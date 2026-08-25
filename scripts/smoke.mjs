import { useGameStore } from '../frontend/src/store/gameStore.js';
import { SNIPPETS } from '../shared/snippets.js';

let failures = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures += 1;
    console.log(` FAIL ${name} ${extra}`);
  }
};

let clock = 0;
let pressCount = 0;
const press = (key) => {
  pressCount += 1;
  if (pressCount > 5000) throw new Error(`press flood: >5000 keys (last key=${key})`);
  clock += 85;
  useGameStore.getState().handleKey(key, clock);
  useGameStore.getState().tick(clock);
  if (pressCount % 200 === 0) {
    const st = useGameStore.getState();
    console.log(`    [heartbeat] keys=${pressCount} ptr=${st.pointer}/${st.snippet.charCount} status=${st.status}`);
  }
};

const typeExact = (code, { useTabForIndent = true } = {}) => {
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '\n') {
      press('Enter');
      i += 1;
      continue;
    }
    if (c === ' ' && (i === 0 || code[i - 1] === '\n')) {
      if (useTabForIndent) {
        press('Tab');
        i = useGameStore.getState().pointer;
      } else {
        press(' ');
        i += 1;
      }
      continue;
    }
    press(c);
    i += 1;
  }
};

const startClock = () => {
  clock = 1_000_000;
};

const typeTo = (code, targetIdx) => {
  let i = 0;
  while (i < targetIdx) {
    const c = code[i];
    if (c === '\n') {
      press('Enter');
      i += 1;
      continue;
    }
    if (c === ' ' && (i === 0 || code[i - 1] === '\n')) {
      press('Tab');
      i = useGameStore.getState().pointer;
      continue;
    }
    press(c);
    i += 1;
  }
};

console.log('— natural mode, TAB-claimed indents (python binary search)');
{
  startClock();
  const raw = SNIPPETS.find((s) => s.id === 'py-alg-01');
  useGameStore.getState().loadSnippet(raw);
  typeExact(useGameStore.getState().snippet.code);
  const s = useGameStore.getState();
  check('finished', s.status === 'finished', `status=${s.status} pointer=${s.pointer}`);
  check('zero errors', s.errorCount === 0, `errors=${s.errorCount}`);
  check('accuracy 100', s.lastRun?.stats?.accuracy === 100, `acc=${s.lastRun?.stats?.accuracy}`);
  check('all chars counted', s.correctChars === s.snippet.charCount, `correct=${s.correctChars} total=${s.snippet.charCount}`);
  check('no assisted chars', Object.keys(s.auto).length === 0, `auto=${Object.keys(s.auto).length}`);
  check('wpm > 0', (s.lastRun?.stats?.wpm || 0) > 0, `wpm=${s.lastRun?.stats?.wpm}`);
  check('samples recorded', s.lastRun?.samples?.length >= 2, `n=${s.lastRun?.samples?.length}`);
  check('burst present in samples', s.lastRun?.samples?.some((x) => x.burst > 0), JSON.stringify(s.lastRun?.samples?.slice(-1)));
  check('symbol stats populated', Object.keys(s.symbolStats).length > 0);
  console.log(`      stats: wpm=${s.lastRun.stats.wpm} raw=${s.lastRun.stats.rawWpm} acc=${s.lastRun.stats.accuracy} cons=${s.lastRun.stats.consistency} t=${s.lastRun.stats.timeSec}s samples=${s.lastRun.samples.length}`);
}

console.log('— natural mode, space-typed indents (python BFS)');
{
  startClock();
  const raw = SNIPPETS.find((s) => s.id === 'py-alg-02');
  useGameStore.getState().loadSnippet(raw);
  typeExact(useGameStore.getState().snippet.code, { useTabForIndent: false });
  const s = useGameStore.getState();
  check('finished', s.status === 'finished', `status=${s.status} pointer=${s.pointer}`);
  check('zero errors', s.errorCount === 0, `errors=${s.errorCount}`);
  check('all chars counted', s.correctChars === s.snippet.charCount, `correct=${s.correctChars} total=${s.snippet.charCount}`);
}

console.log('— auto-assist path: skip indents, let engine fill (javascript quick sort)');
{
  startClock();
  const raw = SNIPPETS.find((s) => s.id === 'js-alg-01');
  useGameStore.getState().loadSnippet(raw);
  const code = useGameStore.getState().snippet.code;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '\n') press('Enter');
    else if (c === ' ' && (i === 0 || code[i - 1] === '\n')) continue;
    else press(c);
  }
  const s = useGameStore.getState();
  check('finished', s.status === 'finished', `status=${s.status} pointer=${s.pointer}`);
  check('zero errors', s.errorCount === 0, `errors=${s.errorCount}`);
  const assisted = Object.keys(s.auto).length;
  check('user + assisted = total', s.correctChars + assisted === s.snippet.charCount, `user=${s.correctChars} assisted=${assisted} total=${s.snippet.charCount}`);
  check('pointer consistent with history', s.pointer === s.history.length, `pointer=${s.pointer} history=${s.history.length}`);
}

console.log('— strict mode (javascript quick sort)');
{
  startClock();
  const raw = SNIPPETS.find((s) => s.id === 'js-alg-01');
  useGameStore.getState().loadSnippet(raw);
  useGameStore.getState().setStrictMode(true);
  const code = useGameStore.getState().snippet.code;
  const target = code.indexOf('pivot');
  typeTo(code, target);
  press('X');
  let s = useGameStore.getState();
  check('strict blocks advance', s.pointer === target, `pointer=${s.pointer} target=${target}`);
  check('strict error recorded', s.errorCount === 1, `errors=${s.errorCount}`);
  press(code[target]);
  s = useGameStore.getState();
  check('strict recovers on correct key', s.pointer === target + 1 && s.errorCount === 1 && s.errors[target] === undefined, `errors=${s.errorCount} ptr=${s.pointer}`);
  typeTo(code, code.length);
  s = useGameStore.getState();
  check('strict run finishes', s.status === 'finished', `status=${s.status}`);
  check('strict accuracy < 100', s.lastRun?.stats?.accuracy < 100, `acc=${s.lastRun?.stats?.accuracy}`);
}

console.log('— natural mode: inline error + backspace revise');
{
  startClock();
  const raw = SNIPPETS.find((s) => s.id === 'py-alg-02');
  useGameStore.getState().loadSnippet(raw);
  useGameStore.getState().setStrictMode(false);
  const code = useGameStore.getState().snippet.code;
  const target = code.indexOf('queue');
  typeTo(code, target);
  press('X');
  let s = useGameStore.getState();
  check('natural advances past error', s.pointer === target + 1, `pointer=${s.pointer} target=${target}`);
  check('error marked', s.errors[target] === 'X', `err=${JSON.stringify(s.errors[target])}`);
  press('Backspace');
  s = useGameStore.getState();
  check('backspace revises', s.pointer === target && s.errors[target] === undefined, `ptr=${s.pointer} err=${JSON.stringify(s.errors[target])}`);
  press(code[target]);
  s = useGameStore.getState();
  check('retype clears error slot', s.errors[target] === undefined && s.pointer === target + 1, `err=${JSON.stringify(s.errors[target])}`);
}

console.log('— TAB claims indent run (c++ quick sort)');
{
  startClock();
  const raw = SNIPPETS.find((s) => s.id === 'cpp-alg-01');
  useGameStore.getState().loadSnippet(raw);
  useGameStore.getState().setStrictMode(false);
  const code = useGameStore.getState().snippet.code;
  const firstIndentedNl = code.indexOf('\n ');
  for (let i = 0; i <= firstIndentedNl; i++) press(code[i] === '\n' ? 'Enter' : code[i]);
  const s0 = useGameStore.getState();
  check('pending indent armed after Enter', Array.isArray(s0.pendingIndent) && s0.pendingIndent[1] - s0.pendingIndent[0] === 4, `pending=${JSON.stringify(s0.pendingIndent)}`);
  press('Tab');
  const s1 = useGameStore.getState();
  check('Tab consumed run as user', s1.pendingIndent === null && s1.pointer === s0.pointer + 4, `ptr=${s1.pointer} expected=${s0.pointer + 4}`);
  check('Tab counted in correctChars', s1.correctChars === s0.correctChars + 4, `delta=${s1.correctChars - s0.correctChars}`);
}

console.log('— ghost pairs (javascript channel client)');
{
  startClock();
  const raw = SNIPPETS.find((s) => s.id === 'js-repo-02');
  useGameStore.getState().loadSnippet(raw);
  useGameStore.getState().setStrictMode(false);
  useGameStore.getState().setGhostMode(true);
  const code = useGameStore.getState().snippet.code;
  const paren = code.indexOf('function createChannel(') + 'function createChannel'.length;
  for (let i = 0; i <= paren; i++) press(code[i] === '\n' ? 'Enter' : code[i]);
  const s = useGameStore.getState();
  check('ghost registered for opener', Object.keys(s.ghost).length > 0, `ghost=${JSON.stringify(s.ghost)}`);
  const closeIdx = Object.values(s.ghost)[0];
  check('ghost close is the matching paren', code[closeIdx] === ')', `close char=${code[closeIdx]}`);
  for (let i = paren + 1; i <= closeIdx; i++) press(code[i] === '\n' ? 'Enter' : code[i]);
  const s2 = useGameStore.getState();
  check('ghost cleared once close typed', s2.ghost[paren] === undefined, `ghost=${JSON.stringify(s2.ghost)}`);
}

console.log('— sprint drills (rust match sprint, symbol-dense)');
{
  startClock();
  const raw = SNIPPETS.find((s) => s.id === 'rs-drill-03');
  check('sprint registered', !!raw && raw.mode === 'sprint');
  useGameStore.getState().loadSnippet(raw);
  useGameStore.getState().setStrictMode(false);
  typeExact(useGameStore.getState().snippet.code);
  const s = useGameStore.getState();
  check('sprint finishes', s.status === 'finished', `status=${s.status}`);
  check('zero errors', s.errorCount === 0, `errors=${s.errorCount}`);
  check('underscore tracked', (s.symbolStats._?.t || 0) >= 1, JSON.stringify(s.symbolStats._));
  check('arrow op tracked', (s.symbolStats['=>']?.t || 0) >= 2, JSON.stringify(s.symbolStats['=>']));
  check('brace tracked', (s.symbolStats['{']?.t || 0) >= 1, JSON.stringify(s.symbolStats['{']));
  check('cpm in stats', s.lastRun?.stats?.cpm > 0, `cpm=${s.lastRun?.stats?.cpm}`);
  check('cpm in samples', s.lastRun?.samples?.some((x) => x.cpm > 0), JSON.stringify(s.lastRun?.samples?.slice(-1)));
}

console.log('— pause / resume (rust binary search)');
{
  startClock();
  const raw = SNIPPETS.find((s) => s.id === 'rs-alg-01');
  useGameStore.getState().loadSnippet(raw);
  const code = useGameStore.getState().snippet.code;
  for (let i = 0; i < 10; i++) press(code[i] === '\n' ? 'Enter' : code[i]);
  press('Escape');
  let s = useGameStore.getState();
  check('paused', s.status === 'paused');
  press('a');
  s = useGameStore.getState();
  check('keys ignored while paused', s.pointer === 10, `pointer=${s.pointer}`);
  press('Escape');
  s = useGameStore.getState();
  check('resumed', s.status === 'running');
}

console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
