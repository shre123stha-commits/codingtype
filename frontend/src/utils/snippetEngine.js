import { buildCharCls } from './tokenizer.js';
import { frictionCount } from './symbols.js';

const BRACKET_CLOSE = { ')': '(', ']': '[', '}': '{' };
const QUOTES = new Set(['"', "'", '`']);

function computeLines(code, charCls) {
  const lines = [];
  let start = 0;
  for (let i = 0; i <= code.length; i++) {
    if (i === code.length || code[i] === '\n') {
      lines.push({ start, end: i, text: code.slice(start, i), cls: charCls });
      start = i + 1;
    }
  }
  return lines;
}

function computeCharLine(code, lines) {
  const charLine = new Array(code.length);
  lines.forEach((line, index) => {
    for (let i = line.start; i < line.end; i++) charLine[i] = index;
  });
  return charLine;
}

function computeIndentRuns(code) {
  const runEnd = new Array(code.length).fill(-1);
  for (let i = 0; i < code.length; i++) {
    if (code[i] === ' ' && (i === 0 || code[i - 1] === '\n')) {
      let j = i;
      while (j < code.length && code[j] === ' ') j++;
      runEnd[i] = j;
    }
  }
  return runEnd;
}

function computeMatchClose(code) {
  const map = {};
  const stack = [];
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '(' || c === '[' || c === '{') {
      stack.push(i);
    } else if (BRACKET_CLOSE[c]) {
      const open = stack.pop();
      if (open !== undefined) map[open] = i;
    }
  }

  let lineStart = 0;
  while (lineStart <= code.length) {
    let lineEnd = code.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = code.length;
    const quotes = [];
    for (let i = lineStart; i < lineEnd; i++) {
      if (QUOTES.has(code[i])) quotes.push({ i, c: code[i] });
    }
    for (let k = 0; k + 1 < quotes.length; k += 2) {
      const a = quotes[k];
      const b = quotes[k + 1];
      if (a.c === b.c && !map[a.i]) map[a.i] = b.i;
    }
    lineStart = lineEnd + 1;
  }

  return map;
}

export function prepareSnippet(raw) {
  const code = raw.code;
  const charCls = buildCharCls(code, raw.language);
  const lines = computeLines(code, charCls);
  const charLine = computeCharLine(code, lines);
  const indentRuns = computeIndentRuns(code);
  const matchClose = computeMatchClose(code);
  return {
    ...raw,
    code,
    charCls,
    lines,
    charLine,
    indentRuns,
    matchClose,
    charCount: code.length,
    lineCount: lines.length,
    friction: frictionCount(code)
  };
}
