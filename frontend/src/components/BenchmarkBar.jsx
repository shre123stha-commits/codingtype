import { useEffect, useState } from 'react';

import { api } from '../utils/api.js';

export default function BenchmarkBar({ snippetId, you }) {
  const [bm, setBm] = useState(null);

  useEffect(() => {
    if (!snippetId) return;
    api
      .benchmark(snippetId)
      .then(setBm)
      .catch(() => setBm(null));
  }, [snippetId]);

  if (!bm || !you) return null;

  const max = Math.max(you, bm.median * 1.4, bm.best) * 1.2;
  const pct = (v) => Math.max(2, Math.min(100, (v / max) * 100));

  return (
    <div className="mx-5 my-3">
      <div className="hud-label mb-2">
        INTERVIEW BENCHMARK — BEAT THE MEDIAN <span className="text-faint">(N={bm.count} RUNS)</span>
      </div>
      <div className="relative h-3 w-full bg-edge/60">
        <div
          className="absolute top-0 h-full bg-pulse/70"
          style={{ width: `${pct(bm.median)}%` }}
          title={`median ${bm.median}s`}
        />
        <div
          className="absolute -top-1 h-5 w-[2px] bg-pulse"
          style={{ left: `${pct(bm.median)}%` }}
        />
        <div
          className="absolute -top-1 h-5 w-[2px] bg-good"
          style={{ left: `${pct(bm.best)}%` }}
          title={`best ${bm.best}s`}
        />
        <div
          className="absolute -top-1.5 h-6 w-[3px] bg-accent shadow-glow-amber"
          style={{ left: `${pct(you)}%` }}
          title={`you ${you}s`}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] tabular-nums tracking-[0.12em]">
        <span className="text-accent">
          YOU {you.toFixed(1)}s {you <= bm.median ? '· BEATS MEDIAN' : '· SLOWER THAN MEDIAN'}
        </span>
        <span className="text-pulse">MEDIAN {bm.median.toFixed(1)}s</span>
        <span className="text-good">BEST {bm.best.toFixed(1)}s</span>
      </div>
    </div>
  );
}
