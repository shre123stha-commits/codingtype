import { useEffect, useMemo, useState } from 'react';

import HudCard from './HudCard.jsx';
import LineRow from './LineRow.jsx';
import RestartButton from './RestartButton.jsx';
import StatusBadge from './StatusBadge.jsx';
import { ghostCharsAt } from '../utils/ghostRace.js';
import { useGameStore } from '../store/gameStore.js';

function inRange(i, line) {
  return i >= line.start && i < line.end;
}

function encodeErrors(errors, line) {
  const parts = [];
  for (const [i, ch] of Object.entries(errors)) {
    if (inRange(Number(i), line)) parts.push(`${i}:${encodeURIComponent(ch)}`);
  }
  return parts.join('|');
}

function encodeList(obj, line) {
  const parts = [];
  for (const k of Object.keys(obj)) {
    if (inRange(Number(k), line)) parts.push(k);
  }
  return parts.join('|');
}

function encodeCloses(closes, line) {
  const parts = [];
  for (const c of Object.values(closes)) {
    if (inRange(Number(c), line)) parts.push(String(c));
  }
  return parts.join('|');
}

export default function TypingArena({ captureRef }) {
  const snippet = useGameStore((s) => s.snippet);
  const pointer = useGameStore((s) => s.pointer);
  const errors = useGameStore((s) => s.errors);
  const auto = useGameStore((s) => s.auto);
  const ghost = useGameStore((s) => s.ghost);
  const pendingIndent = useGameStore((s) => s.pendingIndent);
  const status = useGameStore((s) => s.status);
  const blind = useGameStore((s) => s.blind);
  const raceGhost = useGameStore((s) => s.raceGhost);
  const [ghostPos, setGhostPos] = useState(0);

  useEffect(() => {
    if (!raceGhost || status !== 'running') {
      setGhostPos(0);
      return;
    }
    const id = setInterval(() => {
      const st = useGameStore.getState();
      const g = st.raceGhost;
      if (!g || st.status !== 'running') return;
      const pos = Math.min(ghostCharsAt(g.points, st.elapsedAt(Date.now())), g.total);
      setGhostPos((prev) => (prev === pos ? prev : pos));
    }, 150);
    return () => clearInterval(id);
  }, [raceGhost, status]);

  const currentLine = useMemo(() => {
    if (!snippet) return 0;
    const { charLine, lines, code } = snippet;
    if (pointer < code.length && charLine[pointer] !== undefined) return charLine[pointer];
    for (let li = 0; li < lines.length; li++) {
      if (lines[li].end === pointer) return li;
    }
    return lines.length - 1;
  }, [snippet, pointer]);

  const ghostPosOut = status === 'running' ? ghostPos : null;

  const lineViews = useMemo(() => {
    if (!snippet) return [];
    const ghostCloses = Object.values(ghost);
    return snippet.lines.map((line, li) => ({
      lineIndex: li,
      text: line.text,
      charCls: line.cls,
      start: line.start,
      isCurrent: line.start <= pointer && (pointer < line.end || (pointer === line.end && li === snippet.lines.length - 1)),
      errorsStr: encodeErrors(errors, line),
      autoStr: encodeList(auto, line),
      ghostStr: encodeCloses(ghostCloses, line),
      pendingStr:
        pendingIndent && pendingIndent[1] > line.start && pendingIndent[0] < line.end
          ? `${Math.max(pendingIndent[0], line.start)}-${Math.min(pendingIndent[1], line.end)}`
          : ''
    }));
  }, [snippet, pointer, errors, auto, ghost, pendingIndent]);

  if (!snippet) {
    return (
      <HudCard label="TYPING ARENA" corners="slate">
        <div className="flex min-h-[380px] items-center justify-center">
          <div className="text-center">
            <div className="text-3xl font-bold tracking-[0.3em] text-faint">NO TARGET</div>
            <div className="mt-3 text-[11px] tracking-[0.2em] text-dim">
              SELECT A SNIPPET IN THE CONTROL DECK
            </div>
          </div>
        </div>
      </HudCard>
    );
  }

  return (
    <HudCard
      label="TYPING ARENA"
      corners={status === 'running' ? 'amber' : status === 'paused' ? 'cyan' : 'slate'}
      right={
        <>
          <RestartButton />
          <StatusBadge status={status} />
        </>
      }
      className={status === 'running' ? 'shadow-glow-amber' : ''}
      bodyClassName="p-0"
    >
      <div className="flex items-center justify-between border-b border-edge/70 px-4 py-2">
        <span className="truncate text-[11px] text-dim">
          <span className="text-accent/80">//</span> {snippet.source}
        </span>
        <span className="shrink-0 text-[9px] tabular-nums tracking-[0.18em] text-faint">
          {snippet.charCount} CH · {snippet.lineCount} L · FRICTION {snippet.friction}
        </span>
      </div>

      <div className="relative max-h-[540px] overflow-auto py-3 pl-2 pr-4 font-mono text-[13px]">
        {lineViews.map((view) => (
          <LineRow
            key={view.lineIndex}
            {...view}
            pointer={pointer}
            blind={blind}
            ghostPos={ghostPosOut}
            showCaret={status !== 'finished' && view.lineIndex === currentLine}
          />
        ))}

        {status === 'idle' ? (
          <div className="pointer-events-none absolute bottom-3 left-12">
            <span className="border border-edge bg-panel px-2.5 py-1 text-[9px] tracking-[0.24em] text-dim">
              FIRST KEY STARTS THE CLOCK
            </span>
          </div>
        ) : null}

        {status === 'paused' ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-obsidian/80 backdrop-blur-[2px]">
            <div className="text-center">
              <div className="text-xl font-bold tracking-[0.3em] text-pulse">PAUSED</div>
              <div className="mt-2 text-[10px] tracking-[0.24em] text-dim">PRESS ESC TO RESUME</div>
            </div>
          </div>
        ) : null}
      </div>

      <input
        ref={captureRef}
        aria-label="typing capture"
        className="sr-only"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
    </HudCard>
  );
}
