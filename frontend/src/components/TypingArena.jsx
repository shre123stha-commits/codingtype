import { useEffect, useMemo, useState } from 'react';

import HudCard from './HudCard.jsx';
import LineRow from './LineRow.jsx';
import RestartButton from './RestartButton.jsx';
import StatusBadge from './StatusBadge.jsx';
import { ghostCharsAtF } from '../utils/ghostRace.js';
import { rivalCursorChars } from '../utils/rivalCursor.js';
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
  const autoPaused = useGameStore((s) => s.autoPaused);
  const togglePause = useGameStore((s) => s.togglePause);
  const raceGhost = useGameStore((s) => s.raceGhost);
  const rival = useGameStore((s) => s.rival);
  const [ghostPos, setGhostPos] = useState(0);
  const [rivalPos, setRivalPos] = useState(0);

  const hasRival = Boolean(rival);

  useEffect(() => {
    // race fully gone — clear. Otherwise keep positions (a pause must not
    // snap the cursors back to 0; the overlay covers them while paused).
    if ((!raceGhost && !hasRival) || status === 'finished') {
      setGhostPos(0);
      setRivalPos(0);
      return;
    }
    if (status !== 'running') return;
    const id = setInterval(() => {
      const st = useGameStore.getState();
      if (st.status !== 'running') return;
      const g = st.raceGhost;
      if (g) {
        // fractional: the ghost glides between PB characters, finishing at
        // the PB's real duration
        const pos = Math.min(ghostCharsAtF(g.points, st.elapsedAt(Date.now()), g.timeSec), g.total);
        setGhostPos((prev) => (prev === pos ? prev : pos));
      }
      const rv = st.rival;
      if (rv) {
        // fractional: the rival chases the latest live report
        const pos = rv.done ? rv.chars : rivalCursorChars(Date.now());
        setRivalPos((prev) => (prev === pos ? prev : pos));
      }
    }, 100);
    return () => clearInterval(id);
  }, [raceGhost, hasRival, status]);

  const currentLine = useMemo(() => {
    if (!snippet) return 0;
    const { charLine, lines, code } = snippet;
    if (pointer < code.length && charLine[pointer] !== undefined) return charLine[pointer];
    for (let li = 0; li < lines.length; li++) {
      if (lines[li].end === pointer) return li;
    }
    return lines.length - 1;
  }, [snippet, pointer]);

  const ghostPosOut = status === 'running' && raceGhost ? ghostPos : null;
  const rivalPosOut = status === 'running' && hasRival ? Math.min(rivalPos, snippet.charCount) : null;

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

      {status === 'idle' ? (
        <div className="flex items-center justify-center gap-2.5 border-b border-edge/60 bg-accent/[0.05] px-4 py-1.5">
          <span className="h-1.5 w-1.5 animate-hint-glow rounded-full bg-accent shadow-glow-amber" />
          <span className="animate-hint-glow text-[9px] font-semibold tracking-[0.3em] text-accent">
            FIRST KEY STARTS THE CLOCK
          </span>
        </div>
      ) : null}

      <div className="relative max-h-[540px] overflow-auto py-3 pl-2 pr-4 font-mono text-[13px]">
        {lineViews.map((view) => (
          <LineRow
            key={view.lineIndex}
            {...view}
            pointer={pointer}
            blind={blind}
            ghostPos={ghostPosOut}
            rivalPos={rivalPosOut}
            showCaret={status !== 'finished' && view.lineIndex === currentLine}
          />
        ))}

        {status === 'paused' ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-obsidian/80 backdrop-blur-[2px]">
            <div className="text-center">
              <div className={`text-xl font-bold tracking-[0.3em] ${autoPaused ? 'text-accent' : 'text-pulse'}`}>
                {autoPaused ? 'AUTO-PAUSED' : 'PAUSED'}
              </div>
              <div className="mt-2 text-[10px] tracking-[0.24em] text-dim">
                {autoPaused ? 'NO KEYS FOR 5 SECONDS — CLOCK IS STOPPED' : 'CLOCK IS STOPPED'}
              </div>
              <button
                type="button"
                onClick={() => togglePause(Date.now())}
                className="chip chip-on-amber mt-4 py-2 text-[10px]"
              >
                ▶ RESUME TEST
              </button>
              <div className="mt-2 text-[9px] tracking-[0.2em] text-faint">OR PRESS ESC</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="h-[3px] w-full bg-edge/50">
        <div
          className="h-full bg-accent transition-[width] duration-150"
          style={{
            width: `${snippet.charCount ? Math.min(100, Math.round((pointer / snippet.charCount) * 100)) : 0}%`
          }}
        />
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
