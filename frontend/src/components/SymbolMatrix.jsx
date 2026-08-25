import HudCard from './HudCard.jsx';
import { MATRIX_SYMBOLS } from '../utils/symbols.js';

function cellBg(rate) {
  if (rate <= 0) return 'transparent';
  const alpha = Math.min(0.55, 0.1 + rate * 0.5);
  return `rgb(var(--c-blood) / ${alpha})`;
}

export default function SymbolMatrix({ symbolStats }) {
  const cells = MATRIX_SYMBOLS.map((sym) => {
    const s = symbolStats[sym] || { t: 0, e: 0 };
    const total = s.t + s.e;
    const rate = total ? s.e / total : 0;
    return { sym, t: s.t, e: s.e, total, rate };
  });

  const touched = cells.filter((c) => c.total > 0).length;

  return (
    <HudCard
      label="SYMBOL FRICTION MATRIX"
      right={<span className="hud-label">{touched}/{cells.length} TOUCHED</span>}
    >
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {cells.map((c) => (
          <div
            key={c.sym}
            className="border border-edge/80 px-2 py-1.5"
            style={{ background: cellBg(c.rate) }}
          >
            <div className="flex items-baseline justify-between">
              <span
                className={`text-[12px] font-bold ${
                  c.total === 0 ? 'text-faint/50' : c.rate > 0.2 ? 'text-blood' : 'text-ink'
                }`}
              >
                {c.sym}
              </span>
              <span
                className={`text-[9px] tabular-nums ${
                  c.e > 0 ? 'text-blood' : 'text-faint'
                }`}
              >
                {c.total === 0 ? '—' : `${Math.round(c.rate * 100)}%`}
              </span>
            </div>
            <div className="mt-0.5 text-[9px] tabular-nums text-faint">
              T{c.t} · E{c.e}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-edge/70 pt-2 text-[10px] leading-relaxed text-faint">
        Error share per high-friction operator. Rate = errors ÷ (typed + errors).
      </p>
    </HudCard>
  );
}
