import { useGameStore } from '../frontend/src/store/gameStore.js';
import { SNIPPETS } from '../shared/snippets.js';

let clock = 1_000_000;
const press = (key) => {
  clock += 85;
  useGameStore.getState().handleKey(key, clock);
};

const raw = SNIPPETS.find((s) => s.id === 'py-alg-01');
useGameStore.getState().loadSnippet(raw);
const code = useGameStore.getState().snippet.code;

let indentSkipped = 0;
for (let i = 0; i < code.length; i++) {
  const c = code[i];
  if (c === '\n') press('Enter');
  else if (c === ' ' && (i === 0 || code[i - 1] === '\n')) {
    indentSkipped += 1;
    continue;
  } else press(c);
}
const s = useGameStore.getState();
console.log('code length', code.length);
console.log('indentSkipped(test)', indentSkipped);
console.log('pointer', s.pointer);
console.log('attempts', s.attempts);
console.log('rawChars', s.rawChars);
console.log('correctChars', s.correctChars);
console.log('history length', s.history.length);
console.log('auto size', Object.keys(s.auto).length);
console.log('status', s.status);

const byI = {};
for (const h of s.history) byI[h.i] = (byI[h.i] || 0) + 1;
const dups = Object.entries(byI).filter(([, n]) => n > 1);
console.log('duplicate consumed indices:', dups.length, dups.slice(0, 10));

const indentIndices = [];
for (let i = 0; i < code.length; i++) {
  if (code[i] === ' ' && (i === 0 || code[i - 1] === '\n')) indentIndices.push(i);
}
console.log('actual indent count', indentIndices.length);
const autoKeys = Object.keys(s.auto).map(Number);
const autoNonIndent = autoKeys.filter((i) => !indentIndices.includes(i));
console.log('auto on non-indent indices:', autoNonIndent.length, autoNonIndent.slice(0, 10));
