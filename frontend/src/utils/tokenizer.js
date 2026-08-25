import Prism from 'prismjs';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-c.js';
import 'prismjs/components/prism-cpp.js';
import 'prismjs/components/prism-java.js';
import 'prismjs/components/prism-rust.js';
import 'prismjs/components/prism-sql.js';

const GRAMMAR_BY_LANG = {
  python: 'python',
  javascript: 'javascript',
  'c++': 'c++',
  java: 'java',
  rust: 'rust',
  sql: 'sql'
};

function tokenClass(token) {
  const names = [];
  if (typeof token.alias === 'string') names.push(token.alias);
  else if (Array.isArray(token.alias)) names.push(...token.alias);
  names.push(token.type);
  return `tk-${names[0]}`;
}

function flatten(tokens, base, out, posRef) {
  for (const token of tokens) {
    if (typeof token === 'string') {
      for (let i = 0; i < token.length; i++) {
        if (base && out[posRef.i + i] === null) out[posRef.i + i] = base;
        posRef.i += 1;
      }
    } else if (Array.isArray(token.content)) {
      flatten(token.content, tokenClass(token), out, posRef);
    } else {
      const cls = tokenClass(token);
      for (let i = 0; i < token.content.length; i++) {
        if (cls && out[posRef.i + i] === null) out[posRef.i + i] = cls;
        posRef.i += 1;
      }
    }
  }
}

function getGrammar(language) {
  const candidates = GRAMMAR_BY_LANG[language] ? [GRAMMAR_BY_LANG[language]] : [];
  if (language === 'c++') candidates.push('cpp');
  for (const key of candidates) {
    if (Prism.languages[key]) return Prism.languages[key];
  }
  return null;
}

export function buildCharCls(code, language) {
  const grammar = getGrammar(language);
  const out = new Array(code.length).fill(null);
  if (!grammar) return out;
  try {
    const tokens = Prism.tokenize(code, grammar);
    flatten(tokens, null, out, { i: 0 });
  } catch {
    /* fall back to untokenized */
  }
  return out;
}
