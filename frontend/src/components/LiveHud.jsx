import { useEffect, useState } from 'react';

import { ghostCharsAt } from '../utils/ghostRace.js';
import { useGameStore } from '../store/gameStore.js';

function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (ts) => {
      if (ts - last > 100) {
        last = ts;
        setNow(Date.now());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return now;
}

function Cell({ label, value, tone = 'text-ink' }) {
  return (
    <div className="flex min-w-[72px] flex-col">
      <span className="hud-label">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

export default function LiveHud() {
  const now = useClock();
  const status = useGameStore((s) => s.status);
  const snippet = useGameStore((s) => s.snippet);
  const pointer = useGameStore((s) => s.pointer);
  const correctChars = useGameStore((s) => s.correctChars);
  const rawChars = useGameStore((s) => s.rawChars);
  const errorCount = useGameStore((s) => s.errorCount);
  const attempts = useGameStore((s) => s.attempts);
  const elapsed = useGameStore((s) => (s.startTime ? s.elapsedAt(now) : 0));
  const strictMode = useGameStore((s) => s.strictMode);
  const ghostMode = useGameStore((s) => s.ghostMode);
  const indentAssist = useGameStore((s) => s.indentAssist);
  const raceGhost = useGameStore((s) => s.raceGhost);

  let ghostDelta = null;
  if (raceGhost && status === 'running') {
    ghostDelta = pointer - Math.min(ghostCharsAt(raceGhost.points, elapsed), raceGhost.total);
  }

  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);
  const ds = Math.floor((elapsed * 10) % 10);
  const time = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${ds}`;

  const total = snippet ? snippet.charCount : 0;
  const progress = total ? Math.min(100, Math.round((pointer / total) * 100)) : 0;

  const wpm = status === 'idle' ? 0 : Math.round((correctChars / 5) / (Math.max(elapsed, 0.1) / 60));
  const raw = status === 'idle' ? 0 : Math.round((rawChars / 5) / (Math.max(elapsed, 0.1) / 60));
  const cpm = status === 'idle' ? 0 : Math.round((rawChars * 60) / Math.max(elapsed, 0.1));
  const acc = attempts ? Math.round(((attempts - errorCount) / attempts) * 100) : 100;

  return (
    <div className="hud-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Cell label="TIME" value={time} tone="text-ink" />
        <Cell label="CPM" value={cpm} tone="text-ink" />
        <Cell label="WPM" value={wpm} tone="text-accent" />
        <Cell label="RAW" value={raw} tone="text-pulse" />
        <Cell label="ACC" value={`${acc}%`} tone={acc >= 95 ? 'text-good' : 'text-blood'} />
        <Cell label="ERR" value={errorCount} tone={errorCount > 0 ? 'text-blood' : 'text-dim'} />
        <Cell label="PROG" value={`${progress}%`} tone="text-dim" />

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Flag on={strictMode} label="STRICT" />
          <Flag on={ghostMode} label="GHOST" />
          <Flag on={indentAssist} label="ASSIST" />
          {ghostDelta !== null ? (
            <span
              className={`border px-2 py-0.5 text-[9px] font-semibold tabular-nums tracking-[0.14em] ${
                ghostDelta >= 0
                  ? 'border-pulse/50 bg-pulse/10 text-pulse'
                  : 'border-blood/50 bg-blood/10 text-blood'
              }`}
            >
              RACE Δ {ghostDelta >= 0 ? '+' : ''}
              {ghostDelta} CH
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-3 h-1 w-full bg-edge/60">
        <div
          className="h-full bg-accent shadow-glow-amber transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function Flag({ on, label }) {
  return (
    <span
      className={`border px-2 py-0.5 text-[9px] font-semibold tracking-[0.18em] ${
        on ? 'border-accent/50 bg-accent/10 text-accent' : 'border-edge text-faint'
      }`}
    >
      {label}
    </span>
  );
}
