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
  rivalPos,
  errorsStr,
  autoStr,
  ghostStr,
  pendingStr
}) {
  const errors = parseErrors(errorsStr);
  const autoSet = new Set(parseList(autoStr).map(Number));
  const ghostSet = new Set(parseList(ghostStr).map(Number));
  const pending = pendingStr ? pendingStr.split('-').map(Number) : null;

  // Fractional local position of the ghost / rival cursors on THIS line
  // (null = not on this line). Rendered as persistent overlays and moved by
  // transform, so a CSS transition makes them glide continuously.
  const localOf = (pos) => {
    if (pos === null || pos === undefined) return null;
    const raw = pos - start;
    if (raw < 0 || raw > text.length + 1e-6) return null;
    return Math.min(raw, text.length);
  };
  const gLocal = localOf(ghostPos);
  const rLocal = localOf(rivalPos);

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

  return (
    <div className={`group flex items-stretch leading-[26px] ${isCurrent ? 'bg-accent/[0.04]' : ''}`}>
      <span
        className={`w-10 shrink-0 select-none pr-3 text-right text-[10px] tabular-nums ${
          isCurrent ? 'text-accent' : 'text-faint/60'
        }`}
      >
        {lineIndex + 1}
      </span>
      <span className="relative whitespace-pre">
        {chars}
        {caretAtEnd ? <Caret key="caret-end" className="ml-[1px]" /> : null}
        {gLocal !== null ? (
          <span
            key="ghost-glide"
            aria-hidden
            className="pointer-events-none absolute left-0 top-[6px] z-10"
            style={{ transform: `translateX(${gLocal}ch)`, transition: 'transform 140ms linear' }}
          >
            <span
              className="block h-[15px] w-[2px] bg-pulse"
              style={{ boxShadow: '0 0 8px rgb(var(--c-pulse) / 0.8)' }}
            />
          </span>
        ) : null}
        {rLocal !== null ? (
          <span
            key="rival-glide"
            aria-hidden
            className="pointer-events-none absolute left-0 top-[6px] z-10"
            style={{ transform: `translateX(${rLocal}ch)`, transition: 'transform 140ms linear' }}
          >
            <span
              className="block h-[15px] w-[2px] bg-blood"
              style={{ boxShadow: '0 0 8px rgb(var(--c-blood) / 0.9)' }}
            />
          </span>
        ) : null}
      </span>
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

export default memo(LineRow);
