const FRICTION_SINGLE = new Set(
  ['{', '}', '[', ']', '(', ')', ';', '.', ',', ':', '#', '=', '+', '-', '*', '/', '<', '>', '!', '&', '|', '%', '^', '~', '?', '@', '_'].join(' ')
);

const FRICTION_DOUBLE = {
  '-': '>',
  ':': ':',
  '=': '>',
  '<': '<',
  '&': '&',
  '|': '|',
  '!': '='
};

export function frictionKey(code, i) {
  const c = code[i];
  if (!c) return null;
  if (FRICTION_DOUBLE[c] && code[i + 1] === FRICTION_DOUBLE[c]) return c + FRICTION_DOUBLE[c];
  if (FRICTION_SINGLE.has(c)) return c;
  return null;
}

export const MATRIX_SYMBOLS = ['{', '}', '[', ']', '(', ')', ';', '->', '::', '=>', '=', '+', '-', '*', '/', '<', '>', '!', '&', '|', '.', '_'];

export function frictionCount(code) {
  let count = 0;
  for (let i = 0; i < code.length; i++) {
    if (frictionKey(code, i)) count += 1;
  }
  return count;
}
