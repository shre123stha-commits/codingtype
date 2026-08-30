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

function Cell({ label, value, tone = 'text-ink', size = 'text-lg' }) {
  return (
    <div className="flex min-w-[64px] flex-col">
      <span className="hud-label">{label}</span>
      <span className={`${size} font-bold tabular-nums leading-tight ${tone}`}>{value}</span>
    </div>
  );
}

// One live setting, one chip, one precise hover explanation.
function HudToggle({ label, on, onToggle, tip }) {
  return (
    <span className="group/tip relative inline-flex">
      <button
        type="button"
        onClick={onToggle}
        title={tip}
        aria-pressed={on}
        className={`chip !px-2 !py-0.5 !text-[9px] ${on ? 'chip-on-amber' : 'chip-off'}`}
      >
        <span className="mr-1" aria-hidden="true">{on ? '●' : '○'}</span>
        {label}
      </button>
      <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-40 hidden w-60 -translate-x-1/2 border border-edge bg-panel2 px-2.5 py-2 text-left text-[9px] font-normal leading-relaxed tracking-[0.03em] text-dim shadow-xl shadow-black/40 group-hover/tip:block">
        {tip}
      </span>
    </span>
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
  const blind = useGameStore((s) => s.blind);
  const setStrictMode = useGameStore((s) => s.setStrictMode);
  const setGhostMode = useGameStore((s) => s.setGhostMode);
  const setIndentAssist = useGameStore((s) => s.setIndentAssist);
  const cycleBlind = useGameStore((s) => s.cycleBlind);
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
    <div className="hud-card px-5 py-4">
      <div className="grid grid-cols-4 gap-3 sm:gap-6">
        <Cell label="WPM" value={wpm} tone="text-accent" size="text-3xl sm:text-4xl" />
        <Cell label="RAW" value={raw} tone="text-pulse" size="text-3xl sm:text-4xl" />
        <Cell
          label="ACCURACY"
          value={`${acc}%`}
          tone={acc >= 95 ? 'text-good' : 'text-blood'}
          size="text-3xl sm:text-4xl"
        />
        <Cell label="TIME" value={time} tone="text-ink" size="text-3xl sm:text-4xl" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-edge/70 pt-3">
        <Cell label="CPM" value={cpm} tone="text-ink" size="text-sm" />
        <Cell label="ERR" value={errorCount} tone={errorCount > 0 ? 'text-blood' : 'text-dim'} size="text-sm" />
        <Cell label="PROG" value={`${progress}%`} tone="text-dim" size="text-sm" />

        {/* Live settings — click to change mid-run, hover for what each does */}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <HudToggle
            label="STRICT"
            on={strictMode}
            onToggle={() => setStrictMode(!strictMode)}
            tip="STRICT — a wrong key locks the pointer; only the exact right key advances. Off = NATURAL: errors mark inline in soft red and the run keeps flowing."
          />
          <HudToggle
            label="GHOST"
            on={ghostMode}
            onToggle={() => setGhostMode(!ghostMode)}
            tip="GHOST PAIRS — closing brackets ] } ) render faint, so you type them from memory and they snap in. Off = brackets are typed like every other character."
          />
          <HudToggle
            label="ASSIST"
            on={indentAssist}
            onToggle={() => setIndentAssist(!indentAssist)}
            tip="INDENT ASSIST — after Enter, the next line's indent auto-fills and waits; press space or Tab to accept it. Off = you type every indent space yourself."
          />
          <HudToggle
            label={blind === null ? 'BLIND' : blind === 3 ? 'BLIND 3CH' : 'BLIND FULL'}
            on={blind !== null}
            onToggle={cycleBlind}
            tip="BLIND — hides the code ahead of your caret to train from memory. Click to cycle: off → 3-character window → fully hidden."
          />
          {ghostDelta !== null ? (
            <span
              className={`rounded border px-2 py-0.5 text-[9px] font-semibold tabular-nums tracking-[0.14em] ${
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
    </div>
  );
}
