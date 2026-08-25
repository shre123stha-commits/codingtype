import { useEffect, useState } from 'react';

import HudCard from './HudCard.jsx';
import TypingArena from './TypingArena.jsx';
import { useRace } from '../hooks/useRace.js';
import { useTypingEngine } from '../hooks/useTypingEngine.js';
import { useGameStore } from '../store/gameStore.js';

function Countdown({ at }) {
  const [left, setLeft] = useState(() => Math.max(0, at - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, at - Date.now())), 100);
    return () => clearInterval(id);
  }, [at]);
  const n = Math.ceil(left / 1000);
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-obsidian/85 backdrop-blur-[2px]">
      <div className="text-[10px] tracking-[0.3em] text-dim">SYNC START</div>
      <div
        className="mt-2 text-7xl font-bold tabular-nums text-pulse"
        style={{ textShadow: '0 0 30px rgb(var(--c-pulse) / 0.6)' }}
      >
        {n > 0 ? n : 'GO'}
      </div>
      <div className="mt-3 text-[10px] tracking-[0.24em] text-faint">SAME TARGET FOR BOTH PLAYERS</div>
    </div>
  );
}

function PlayerBar({ label, chars, total, done, color }) {
  const pct = total ? Math.min(100, Math.round((chars / total) * 100)) : 0;
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-center justify-between text-[9px] tracking-[0.18em]">
        <span className="font-semibold" style={{ color }}>
          {label}
        </span>
        <span className="tabular-nums text-dim">{done ? 'FINISHED' : `${pct}%`}</span>
      </div>
      <div className="h-2 w-full bg-edge/60">
        <div
          className="h-full transition-[width] duration-200"
          style={{ width: `${done ? 100 : pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

const STATE_TEXT = {
  idle: 'LOBBY IDLE — JOIN TO START MATCHING',
  connecting: 'CONNECTING TO RACE SERVER…',
  waiting: 'WAITING FOR OPPONENT… (MAX 90s)',
  full: 'LOBBY FULL — TRY AGAIN IN A MOMENT',
  timeout: 'NOBODY CAME — RETRY',
  countdown: 'OPPONENT FOUND — SYNCING START',
  racing: 'RACE LIVE — FIRST TO FINISH WINS',
  done: 'RACE COMPLETE',
  error: 'CONNECTION LOST'
};

export default function RaceView() {
  const race = useRace();
  const captureRef = useTypingEngine();
  const status = useGameStore((s) => s.status);
  const pointer = useGameStore((s) => s.pointer);
  const snippet = useGameStore((s) => s.snippet);
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!race.result) return;
    setLog((prev) =>
      [
        {
          win: race.result.winner === 'you',
          you: race.result.you?.stats?.wpm ?? null,
          opp: race.result.opp?.stats?.wpm ?? null,
          reason: race.result.reason,
          at: new Date().toLocaleTimeString()
        },
        ...prev
      ].slice(0, 5)
    );
  }, [race.result]);

  const inRace = race.state === 'countdown' || race.state === 'racing';
  const total = inRace || race.state === 'done' ? snippet?.charCount || 0 : 0;

  return (
    <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-4 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
      <div className="order-2 xl:order-1">
        <HudCard label="RACE LOBBY" right={<span className="hud-label">1V1</span>}>
          <div className="space-y-3">
            <p className="text-[10px] leading-relaxed tracking-[0.12em] text-dim">{STATE_TEXT[race.state]}</p>
            {(race.state === 'idle' || race.state === 'full' || race.state === 'timeout' || race.state === 'error') ? (
              <button type="button" onClick={race.join} className="chip chip-on-amber w-full py-2.5 text-[11px]">
                ⚔ {race.state === 'idle' ? 'JOIN QUICK RACE' : 'RETRY'}
              </button>
            ) : null}
            {race.state === 'waiting' || inRace ? (
              <button type="button" onClick={race.leave} className="chip chip-off w-full py-2.5 text-[11px]">
                {inRace ? '✕ FORFEIT' : '✕ LEAVE LOBBY'}
              </button>
            ) : null}
            {race.state === 'done' ? (
              <button type="button" onClick={race.join} className="chip chip-on-amber w-full py-2.5 text-[11px]">
                ⚔ RACE AGAIN
              </button>
            ) : null}
            {race.result ? (
              <div
                className={`border px-3 py-2.5 text-center text-[12px] font-bold tracking-[0.2em] ${
                  race.result.winner === 'you'
                    ? 'border-good/50 bg-good/10 text-good'
                    : 'border-blood/50 bg-blood/10 text-blood'
                }`}
              >
                {race.result.winner === 'you' ? '✓ YOU WIN' : '✕ RIVAL WINS'}
                {race.result.reason === 'quit' ? ' (RIVAL QUIT)' : ''}
              </div>
            ) : null}
            <div className="border-t border-edge pt-3">
              <div className="hud-label mb-2">RULES</div>
              <ul className="space-y-1 text-[10px] leading-relaxed tracking-[0.08em] text-faint">
                <li>• BOTH PLAYERS GET TODAY'S DAILY SNIPPET</li>
                <li>• 4-SECOND SYNCED START — KEYS LOCKED UNTIL GO</li>
                <li>• FIRST TO FINISH WINS</li>
                <li>• QUITTING MID-RACE = FORFEIT</li>
              </ul>
            </div>
          </div>
        </HudCard>
      </div>

      <div className="order-1 space-y-4 xl:order-2">
        {inRace || race.state === 'done' ? (
          <HudCard label="RACE TRACK" corners={race.state === 'racing' ? 'amber' : 'slate'}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <PlayerBar label="YOU" chars={pointer} total={total} done={status === 'finished'} color="rgb(var(--c-accent))" />
              <span className="shrink-0 text-center text-[10px] font-bold tracking-[0.3em] text-faint">VS</span>
              <PlayerBar
                label="RIVAL"
                chars={race.oppChars}
                total={total}
                done={race.oppDone}
                color="rgb(var(--c-pulse))"
              />
            </div>
          </HudCard>
        ) : null}
        <div className="relative">
          {race.state === 'countdown' && race.countdownAt ? <Countdown at={race.countdownAt} /> : null}
          {status !== 'finished' ? (
            <TypingArena captureRef={captureRef} />
          ) : (
            <HudCard label="RACE TRACK" corners={race.result?.winner === 'you' ? 'amber' : 'slate'}>
              <div className="py-10 text-center">
                <div
                  className={`text-2xl font-bold tracking-[0.3em] ${
                    race.result?.winner === 'you' ? 'text-good' : 'text-blood'
                  }`}
                >
                  {race.result?.winner === 'you' ? 'VICTORY' : 'DEFEAT'}
                </div>
                <div className="mt-3 text-[10px] tracking-[0.2em] text-dim">
                  {race.state === 'done'
                    ? 'PRESS ENTER TO RELOAD · OR "RACE AGAIN" LEFT'
                    : 'WAITING FOR RIVAL… YOU FINISHED FIRST'}
                </div>
              </div>
            </HudCard>
          )}
        </div>
      </div>

      <div className="order-3">
        <HudCard label="RACE LOG" right={<span className="hud-label">LAST {log.length}</span>}>
          {log.length ? (
            <div className="space-y-2">
              {log.map((r, i) => (
                <div key={i} className="flex items-center justify-between border border-edge px-3 py-2">
                  <span className={`text-[10px] font-bold tracking-[0.16em] ${r.win ? 'text-good' : 'text-blood'}`}>
                    {r.win ? 'WIN' : 'LOSS'}
                  </span>
                  <span className="text-[10px] tabular-nums text-dim">
                    YOU {r.you ?? '—'}W · RIVAL {r.opp ?? '—'}W
                  </span>
                  <span className="text-[9px] tabular-nums text-faint">{r.at}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-[10px] tracking-[0.2em] text-faint">NO RACES YET</div>
          )}
        </HudCard>
      </div>
    </main>
  );
}
