import { useMemo } from 'react';

import HudCard from './HudCard.jsx';

const ROWS = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/']
];

function rateOf(v) {
  if (!v) return { t: 0, e: 0, rate: 0 };
  const t = v.t || 0;
  const e = v.e || 0;
  return { t, e, rate: t + e ? e / (t + e) : 0 };
}

export default function KeyHeatmap({ chars }) {
  const data = useMemo(() => {
    const map = {};
    for (const [ch, v] of Object.entries(chars || {})) {
      map[ch.toLowerCase()] = v;
    }
    return map;
  }, [chars]);

  const topFriction = useMemo(() => {
    return Object.entries(chars || {})
      .map(([ch, v]) => ({ ch, ...rateOf(v) }))
      .filter((v) => v.e > 0)
      .sort((a, b) => b.e - a.e)
      .slice(0, 5);
  }, [chars]);

  const hasData = Object.keys(data).length > 0;

  return (
    <HudCard label="KEY HEATMAP" right={<span className="hud-label">ERROR RATE PER KEY</span>}>
      {!hasData ? (
        <div className="py-8 text-center text-[10px] tracking-[0.2em] text-faint">
          COMPLETE RUNS TO BUILD YOUR MAP
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-4 md:flex-row">
          <div className="min-w-0 flex-1 space-y-1.5">
            {ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-1.5">
                {row.map((ch) => {
                  const { e, rate } = rateOf(data[ch.toLowerCase()]);
                  return (
                    <span
                      key={ch}
                      title={`${ch} — ${e} errors`}
                      className="flex h-9 min-w-0 flex-1 items-center justify-center overflow-hidden border border-edge bg-panel2 text-[13px] font-bold text-ink"
                      style={{
                        background: `rgb(var(--c-blood) / ${Math.min(0.75, rate * 0.9)})`,
                        color: rate > 0.25 ? '#fff' : undefined
                      }}
                    >
                      {ch === '\\' ? '\\' : ch}
                    </span>
                  );
                })}
              </div>
            ))}
            <div className="flex gap-1.5">
              <span
                title="space"
                className="flex h-9 flex-1 items-center justify-center border border-edge bg-panel2 text-[10px] tracking-[0.3em] text-dim"
                style={{
                  background: `rgb(var(--c-blood) / ${Math.min(0.75, rateOf(data[' ']).rate * 0.9)})`
                }}
              >
                SPACE
              </span>
            </div>
          </div>
          <div className="w-full shrink-0 md:w-52">
            <div className="hud-label mb-2">TOP FRICTION KEYS</div>
            {topFriction.length ? (
              <div className="space-y-1.5">
                {topFriction.map((v) => (
                  <div key={v.ch} className="flex items-center gap-2 text-[11px]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-edge bg-panel2 font-bold text-ink">
                      {v.ch === ' ' ? '␣' : v.ch}
                    </span>
                    <div className="h-1.5 flex-1 bg-edge/60">
                      <div
                        className="h-full bg-blood"
                        style={{ width: `${Math.max(6, Math.min(100, v.rate * 100))}%` }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right tabular-nums text-dim">
                      {Math.round(v.rate * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] tracking-[0.14em] text-good">NO ERRORS RECORDED YET</p>
            )}
            <p className="mt-3 text-[9px] leading-relaxed tracking-[0.1em] text-faint">
              DARKER RED = MORE ERRORS ON THAT KEY. FIX YOUR PINKIES.
            </p>
          </div>
        </div>
      )}
    </HudCard>
  );
}
