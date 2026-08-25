import { useMemo } from 'react';

import HudCard from './HudCard.jsx';
import { useGameStore } from '../store/gameStore.js';
import { frictionKey, MATRIX_SYMBOLS } from '../utils/symbols.js';

export default function FrictionPreview() {
  const snippet = useGameStore((s) => s.snippet);

  const counts = useMemo(() => {
    if (!snippet) return [];
    const tally = {};
    const code = snippet.code;
    for (let i = 0; i < code.length; i++) {
      const key = frictionKey(code, i);
      if (key) tally[key] = (tally[key] || 0) + 1;
    }
    return MATRIX_SYMBOLS.map((sym) => ({ sym, n: tally[sym] || 0 })).filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);
  }, [snippet]);

  const max = counts.length ? counts[0].n : 1;

  return (
    <HudCard label="FRICTION SCAN" right={snippet ? <span className="hud-label">{snippet.language.toUpperCase()}</span> : null}>
      {snippet ? (
        <>
          <div className="space-y-1.5">
            {counts.map(({ sym, n }) => (
              <div key={sym} className="flex items-center gap-2">
                <span className="w-7 shrink-0 text-right text-[11px] font-bold text-ink">{sym}</span>
                <div className="h-2 flex-1 bg-edge/50">
                  <div
                    className="h-full bg-pulse/70"
                    style={{ width: `${Math.max(6, (n / max) * 100)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-[10px] tabular-nums text-dim">×{n}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-edge/70 pt-2 text-[10px] leading-relaxed text-faint">
            High-friction symbols present in this target. These feed the post-run
            symbol error matrix.
          </p>
        </>
      ) : (
        <div className="py-8 text-center text-[10px] tracking-[0.2em] text-faint">NO TARGET LOADED</div>
      )}
    </HudCard>
  );
}
