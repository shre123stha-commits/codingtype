import { memo } from 'react';

const GLYPH = { '\t': '⇥', '\n': '⏎' };

function parseList(str) {
  if (!str) return [];
  return str.split('|');
}

function parseErrors(str) {
  if (!str) return {};
  const out = {};
  for (const item of str.split('|')) {
    const at = item.indexOf(':');
    out[Number(item.slice(0, at))] = decodeURIComponent(item.slice(at + 1));
  }
  return out;
}

const STATE_CLS = {
  err: 'c-err',
  pindent: 'c-pindent',
  blind: 'c-blind'
};

function LineRow({
  lineIndex,
  text,
  charCls,
  start,
  pointer,
  isCurrent,
  showCaret,
  blind,
  ghostPos,
  errorsStr,
  autoStr,
  ghostStr,
  pendingStr
}) {
  const errors = parseErrors(errorsStr);
  const autoSet = new Set(parseList(autoStr).map(Number));
  const ghostSet = new Set(parseList(ghostStr).map(Number));
  const pending = pendingStr ? pendingStr.split('-').map(Number) : null;

  const chars = [];
  for (let k = 0; k < text.length; k++) {
    const i = start + k;
    const c = text[k];
    const errChar = errors[i];

    let state;
    if (i < pointer) {
      state = errChar ? 'err' : autoSet.has(i) ? 'auto' : 'done';
    } else if (blind !== null && !(i > pointer && i <= pointer + blind)) {
      state = 'blind';
    } else if (pending && i >= pending[0] && i < pending[1]) {
      state = 'pindent';
    } else if (i === pointer) {
      state = errChar ? 'curr-err' : 'curr';
    } else if (ghostSet.has(i)) {
      state = 'ghost';
    } else {
      state = 'pend';
    }

    if (showCaret && i === pointer) {
      chars.push(<Caret key={`caret-${i}`} />);
    }
    if (ghostPos !== null && ghostPos !== undefined && ghostPos === i) {
      chars.push(<GhostCaret key={`ghost-${i}`} />);
    }

    const token = charCls[i] || '';
    const cls =
      state === 'curr'
        ? token
        : STATE_CLS[state]
          ? STATE_CLS[state]
          : `c-${state} ${token}`;

    chars.push(
      <span key={`${i}:${state}`} className={cls}>
        {c === ' ' ? '\u00a0' : GLYPH[c] || c}
      </span>
    );
  }

  const caretAtEnd = showCaret && pointer === start + text.length && text.length > 0;
  const ghostAtEnd = ghostPos !== null && ghostPos !== undefined && ghostPos === start + text.length;

  return (
    <div className={`group flex items-stretch leading-[26px] ${isCurrent ? 'bg-accent/[0.04]' : ''}`}>
      <span
        className={`w-10 shrink-0 select-none pr-3 text-right text-[10px] tabular-nums ${
          isCurrent ? 'text-accent' : 'text-faint/60'
        }`}
      >
        {lineIndex + 1}
      </span>
      <span className="relative whitespace-pre">{chars}</span>
      {caretAtEnd ? <Caret key="caret-end" className="ml-[1px]" /> : null}
      {ghostAtEnd ? <GhostCaret key="ghost-end" className="ml-[1px]" /> : null}
    </div>
  );
}

function Caret({ className = '' }) {
  return (
    <span
      className={`inline-block h-[15px] w-[2px] translate-y-[3px] animate-blink bg-accent ${className}`}
      style={{ boxShadow: '0 0 6px rgb(var(--c-accent) / 0.6)' }}
    />
  );
}

function GhostCaret({ className = '' }) {
  return (
    <span
      className={`inline-block h-[15px] w-[2px] translate-y-[3px] bg-pulse ${className}`}
      style={{ boxShadow: '0 0 8px rgb(var(--c-pulse) / 0.8)' }}
    />
  );
}

export default memo(LineRow);
