import { useGameStore } from '../frontend/src/store/gameStore.js';
import { SNIPPETS } from '../shared/snippets.js';

let clock = 1_000_000;
const press = (key) => {
  clock += 85;
  useGameStore.getState().handleKey(key, clock);
  useGameStore.getState().tick(clock);
};

const raw = SNIPPETS.find((s) => s.id === 'py-alg-01');
useGameStore.getState().loadSnippet(raw);
const code = useGameStore.getState().snippet.code;

let i = 0;
let steps = 0;
while (i < code.length && steps < 1000) {
  steps += 1;
  const c = code[i];
  const before = useGameStore.getState().pointer;
  let action;
  if (c === '\n') action = 'Enter';
  else if (c === ' ' && (i === 0 || code[i - 1] === '\n')) action = 'Tab';
  else action = c;
  press(action);
  const after = useGameStore.getState();
  if (after.pointer === before && !['Tab'].includes(action)) {
    console.log(`STALL at i=${i} char=${JSON.stringify(c)} action=${action} pointer=${before} status=${after.status} pending=${JSON.stringify(after.pendingIndent)} errors=${JSON.stringify(Object.entries(after.errors).slice(-3))}`);
  }
  if (action === 'Tab' || c === '\n' || i < 40) {
    console.log(`i=${i} c=${JSON.stringify(c)} act=${action} ptr ${before}->${after.pointer} status=${after.status} pending=${JSON.stringify(after.pendingIndent)}`);
  }
  if (action === 'Tab') i = after.pointer;
  else i += 1;
  if (after.status === 'finished') {
    console.log('FINISHED at i', i);
    break;
  }
}
console.log('done. steps=', steps, 'i=', i, 'len=', code.length, 'status=', useGameStore.getState().status);
