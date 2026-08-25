import { useMemo } from 'react';

import HudCard from './HudCard.jsx';
import { FINGERS } from '../../../shared/fingers.js';

export default function FingerPanel({ fingers }) {
  const rows = useMemo(() => {
    return FINGERS.map((f) => {
      const v = (fingers || {})[f.id] || { t: 0, e: 0 };
      const total = v.t + v.e;
      return {
        ...f,
        t: v.t,
        e: v.e,
        total,
        rate: total ? v.e / total : 0
      };
    });
  }, [fingers]);

  const weakest = rows.filter((r) => r.total >= 8).sort((a, b) => b.rate - a.rate)[0];
  const strongest = rows.filter((r) => r.total >= 8).sort((a, b) => a.rate - b.rate)[0];
  const hasData = rows.some((r) => r.total > 0);

  return (
    <HudCard label="FINGER STRENGTH" right={<span className="hud-label">PER-FINGER ACCURACY</span>}>
      {!hasData ? (
        <div className="py-8 text-center text-[10px] tracking-[0.2em] text-faint">
          COMPLETE RUNS TO MAP YOUR FINGERS
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-right text-[10px] font-semibold tracking-[0.14em] text-dim">
                {r.label}
              </span>
              <div className="h-2.5 flex-1 bg-edge/50">
                <div
                  className="h-full transition-[width] duration-300"
                  style={{
                    width: `${r.total ? Math.max(3, (1 - r.rate) * 100) : 0}%`,
                    background:
                      r.rate > 0.3 ? 'rgb(var(--c-blood))' : r.rate > 0.12 ? 'rgb(var(--c-accent) / 0.8)' : 'rgb(var(--c-good))'
                  }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-dim">
                {r.total ? `${Math.round((1 - r.rate) * 100)}%` : '—'}
              </span>
              <span className="w-16 shrink-0 text-right text-[9px] tabular-nums text-faint">
                {r.total} CH
              </span>
            </div>
          ))}
          {weakest && strongest && weakest.id !== strongest.id ? (
            <div className="mt-3 border-t border-edge pt-3 text-[10px] tracking-[0.1em]">
              <p>
                <span className="text-blood">WEAKEST: {weakest.label}</span>{' '}
                <span className="text-faint">
                  — {Math.round((1 - weakest.rate) * 100)}% ACC ON {weakest.total} CH
                </span>
              </p>
              <p className="mt-1">
                <span className="text-good">STRONGEST: {strongest.label}</span>{' '}
                <span className="text-faint">
                  — {Math.round((1 - strongest.rate) * 100)}% ACC ON {strongest.total} CH
                </span>
              </p>
            </div>
          ) : null}
        </div>
      )}
    </HudCard>
  );
}
