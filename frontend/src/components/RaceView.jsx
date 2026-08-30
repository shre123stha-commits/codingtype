import { useEffect, useMemo, useRef, useState } from 'react';

import FlashCardModal from './FlashCardModal.jsx';
import HudCard from './HudCard.jsx';
import TypingArena from './TypingArena.jsx';
import { useDaily, usePbestSnippets } from '../hooks/useApi.js';
import {
  buildProfile,
  profileShareText,
  raceShareText,
  renderProfileCard,
  renderRaceCard,
  renderResultCard
} from '../utils/flashCard.js';
import { useRace } from '../hooks/useRace.js';
import { useTypingEngine } from '../hooks/useTypingEngine.js';
import { api } from '../utils/api.js';
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
      <div className="text-[10px] tracking-[0.3em] text-dim">SYNC START — SAME TARGET FOR BOTH PLAYERS</div>
      <div
        className="mt-2 text-7xl font-bold tabular-nums text-pulse"
        style={{ textShadow: '0 0 30px rgb(var(--c-pulse) / 0.6)' }}
      >
        {n > 0 ? n : 'START!'}
      </div>
      <div className="mt-3 text-[10px] tracking-[0.24em] text-faint">KEYS UNLOCK AT START</div>
    </div>
  );
}

function PlayerBar({ label, chars, total, done, color, wpm }) {
  const pct = total ? Math.min(100, Math.round((chars / total) * 100)) : 0;
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center justify-between gap-2 text-[9px] tracking-[0.18em]">
        <span className="truncate font-semibold" style={{ color }}>
          {label}
        </span>
        <span className="shrink-0 tabular-nums text-dim">
          {wpm > 0 ? (
            <span className="font-bold" style={{ color }}>
              {wpm} WPM
            </span>
          ) : null}
          {wpm > 0 ? <span className="mx-1.5 text-edge">·</span> : null}
          {done ? 'FINISHED' : `${pct}%`}
        </span>
      </div>
      <div className="h-2 w-full bg-edge/60">
        <div className="h-full transition-[width] duration-200" style={{ width: `${done ? 100 : pct}%`, background: color }} />
      </div>
    </div>
  );
}

function fmtClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function GhostRaceCard({ raceState }) {
  const pbests = usePbestSnippets();
  const loadSnippet = useGameStore((s) => s.loadSnippet);
  const status = useGameStore((s) => s.status);
  const raceGhost = useGameStore((s) => s.raceGhost);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [noPbMsg, setNoPbMsg] = useState(false);
  const autoRef = useRef(false);
  const seqRef = useRef(0);

  const selected = pbests?.find((p) => p.snippetId === pick) || pbests?.[0] || null;
  const started = Boolean(raceGhost); // ghost loaded in the arena = race started

  const start = async (target) => {
    const t = target || selected;
    if (!t) return;
    const seq = ++seqRef.current;
    setBusy(true);
    try {
      const full = await api.snippet(t.snippetId);
      if (seq !== seqRef.current) return; // a newer selection won — drop the stale load
      loadSnippet(full);
    } catch {
      /* offline */
    }
    setBusy(false);
  };

  // Auto-start: walk into RACE while idle (or right after finishing) and your
  // default PB loads straight into the arena — no button needed. Picking a
  // different PB in the dropdown loads that one instead. Never fires while a
  // 1v1 race is live or has just landed (that board state belongs to the race,
  // not to the ghost), and never mid-run (status running/paused).
  useEffect(() => {
    if (autoRef.current || busy) return;
    if (raceState !== 'idle') return;
    if (!pbests || pbests.length === 0) return;
    if (!(status === 'idle' || status === 'finished')) return;
    autoRef.current = true;
    start(pbests[0]);
  }, [pbests, status, busy, raceState]);

  return (
    <HudCard label="GHOST RACE" right={<span className="hud-label">VS PAST SELF</span>}>
      <div className="space-y-2">
        {pbests && pbests.length > 0 ? (
          <>
            <select
              value={selected?.snippetId || ''}
              onChange={(e) => {
                setPick(e.target.value);
                const t = pbests.find((p) => p.snippetId === e.target.value);
                if (t) start(t);
              }}
              className="w-full border border-edge bg-panel2 px-2 py-1.5 text-[10px] tracking-[0.06em] text-ink focus:border-accent focus:outline-none"
              aria-label="ghost target"
            >
              {pbests.map((p) => (
                <option key={p.snippetId} value={p.snippetId}>
                  {p.title} — {p.wpm} WPM PB
                </option>
              ))}
            </select>
            {selected ? (
              <p className="text-[9px] tracking-[0.08em] text-faint">
                PB: {selected.wpm} WPM · {selected.timeSec}s · {Math.round(selected.accuracy)}% ACC
              </p>
            ) : null}
          </>
        ) : (
          <p className="py-1 text-[10px] leading-relaxed tracking-[0.08em] text-faint">
            NO PRACTICE DATA YET — YOUR FIRST FINISHED RUN BECOMES YOUR GHOST.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            if (!pbests || pbests.length === 0) {
              setNoPbMsg(true);
              return;
            }
            setNoPbMsg(false);
            start();
          }}
          disabled={busy}
          className={`chip w-full py-2 text-[10px] disabled:opacity-40 ${started ? 'chip-on-amber' : 'chip-on-cyan'}`}
        >
          {started ? '✓ GHOST RACE STARTED' : '▶ START GHOST RACE'}
        </button>
        {noPbMsg && (!pbests || pbests.length === 0) ? (
          <p className="border border-blood/50 bg-blood/10 px-2.5 py-2 text-[9px] font-semibold leading-relaxed tracking-[0.1em] text-blood">
            NO BEST TIME RECORDED YET — DO A PRACTICE SESSION IN TRAIN AND FINISH A RUN FIRST. YOUR BEST RUN BECOMES THE GHOST.
          </p>
        ) : null}
        <p className="text-[9px] leading-relaxed tracking-[0.06em] text-faint">
          {pbests && pbests.length > 0
            ? 'AUTO-LOADS ON ARRIVAL — PICK A PB OR PRESS START TO (RE)LOAD IT.'
            : 'THIS BUTTON UNLOCKS THE MOMENT YOU HAVE A FINISHED RUN.'}
        </p>
      </div>
    </HudCard>
  );
}

// Verdict shown when a run finished while on the RACE view with a ghost active
// (no 1v1 race in play) — the ghost-replay comparison, mirrored from TRAIN's
// diagnostic dashboard.
function GhostVerdictCard({ ghostBeaten, raceGhost, timeSec, wpm }) {
  const beat = ghostBeaten === true;
  return (
    <HudCard label="GHOST RACE" corners={beat ? 'amber' : 'slate'}>
      <div className="py-8 text-center">
        <div className={`text-3xl font-bold tracking-[0.3em] ${beat ? 'text-good' : 'text-blood'}`}>
          {beat ? 'GHOST BEATEN' : 'GHOST WINS'}
        </div>
        <div className="mt-2 text-[10px] tracking-[0.18em] text-dim">
          {beat
            ? `YOUR BEST WAS ${raceGhost.timeSec.toFixed(1)}s — YOU CAME BACK IN ${timeSec.toFixed(1)}s`
            : `YOUR BEST IS STILL ${raceGhost.timeSec.toFixed(1)}s — YOU WERE ${timeSec.toFixed(1)}s`}
        </div>
        <div className="mt-2 text-[10px] font-bold tabular-nums tracking-[0.18em]">
          <span className="text-accent">{wpm ?? '—'} WPM</span>
          <span className="mx-2 text-faint">VS</span>
          <span className="text-pulse">{raceGhost.wpm} WPM GHOST</span>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => useGameStore.getState().restart()}
            className="chip chip-on-amber py-2 text-[10px]"
          >
            ↻ RUN AGAIN
          </button>
          <button
            type="button"
            onClick={() => useGameStore.getState().setView('train')}
            className="chip chip-off py-2 text-[10px]"
          >
            ⇗ FULL DIAGNOSTICS
          </button>
        </div>
      </div>
    </HudCard>
  );
}

const DURATIONS = [
  [0, 'FIRST TO FINISH'],
  [30, '30s SPRINT'],
  [60, '60s SPRINT'],
  [90, '90s SPRINT']
];

function CreateForm({ onCreate }) {
  const catalog = useGameStore((s) => s.catalog);
  const lang = useGameStore((s) => s.language);
  const [language, setLanguage] = useState(lang);
  const [snippetId, setSnippetId] = useState('');
  const [durationSec, setDurationSec] = useState(0);
  const [strict, setStrict] = useState(false);
  const [botAllowed, setBotAllowed] = useState(true);

  const targets = useMemo(() => catalog.filter((s) => s.language === language), [catalog, language]);
  const effectiveId = targets.some((t) => t.id === snippetId) ? snippetId : targets[0]?.id || '';

  return (
    <div className="space-y-2.5">
      <div>
        <div className="hud-label mb-1.5">TARGET</div>
        <select
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setSnippetId('');
          }}
          className="w-full border border-edge bg-panel2 px-2 py-1.5 text-[10px] tracking-[0.06em] text-ink focus:border-accent focus:outline-none"
          aria-label="race language"
        >
          {['python', 'javascript', 'java', 'c++', 'rust', 'sql'].map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </select>
        <select
          value={effectiveId}
          onChange={(e) => setSnippetId(e.target.value)}
          className="mt-1.5 w-full border border-edge bg-panel2 px-2 py-1.5 text-[10px] tracking-[0.06em] text-ink focus:border-accent focus:outline-none"
          aria-label="race target"
        >
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.chars} CH)
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className="hud-label mb-1.5">DURATION</div>
        <div className="grid grid-cols-2 gap-1.5">
          {DURATIONS.map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setDurationSec(v)}
              className={`chip !py-1 !text-[9px] ${durationSec === v ? 'chip-on-amber' : 'chip-off'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="hud-label mb-1.5">MODE</div>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => setStrict(true)} className={`chip !py-1 !text-[9px] ${strict ? 'chip-on-amber' : 'chip-off'}`}>
            STRICT
          </button>
          <button
            type="button"
            onClick={() => setStrict(false)}
            className={`chip !py-1 !text-[9px] ${!strict ? 'chip-on-amber' : 'chip-off'}`}
          >
            NATURAL
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setBotAllowed((v) => !v)}
        className={`chip w-full text-left !py-1.5 !text-[9px] ${botAllowed ? 'chip-on-cyan' : 'chip-off'}`}
      >
        <span className="mr-2">{botAllowed ? 'ON' : 'OFF'}</span>AUTO-START WITH BOT IF SOLO (8s)
      </button>
      <button
        type="button"
        disabled={!effectiveId}
        onClick={() => onCreate({ snippetId: effectiveId, durationSec, strict, botAllowed })}
        className="chip chip-on-amber w-full py-2 text-[10px] disabled:opacity-40"
      >
        ⚔ CREATE RACE
      </button>
    </div>
  );
}

function JoinForm({ onJoin }) {
  const [code, setCode] = useState('');
  return (
    <div className="space-y-2">
      <div className="hud-label">ENTER 6-DIGIT RACE CODE</div>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        inputMode="numeric"
        className="w-full border border-edge bg-panel2 px-3 py-2.5 text-center text-xl font-bold tracking-[0.5em] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        aria-label="race code"
      />
      <button
        type="button"
        disabled={code.length !== 6}
        onClick={() => onJoin(code)}
        className="chip chip-on-amber w-full py-2 text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
      >
        ⊕ JOIN RACE
      </button>
      <p className="text-[9px] leading-relaxed tracking-[0.06em] text-faint">CODES ARE RANDOM AND EXPIRE 15 MINUTES AFTER CREATION.</p>
    </div>
  );
}

function WaitingBox({ race }) {
  const room = race.room;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!room) return null;
  return (
    <div className="space-y-2">
      {room.isCreator ? (
        <>
          <div className="hud-label">YOUR RACE CODE — SHARE IT</div>
          <div className="border border-accent/50 bg-accent/5 py-3 text-center text-3xl font-bold tracking-[0.35em] text-accent">
            {room.code}
          </div>
          <p className="text-center text-[9px] tracking-[0.14em] text-faint">OPPONENT ENTERS THIS CODE TO JOIN</p>
        </>
      ) : (
        <>
          <div className="hud-label">JOINED RACE</div>
          <div className="border border-edge bg-panel2 py-3 text-center text-3xl font-bold tracking-[0.35em] text-ink">{room.code}</div>
        </>
      )}
      <p className="text-center text-[10px] tracking-[0.12em] text-dim">
        {room.opp ? (
          <span className="text-pulse">OPPONENT CONNECTED — {room.opp.name}{room.opp.bot ? ' (BOT)' : ''}</span>
        ) : (
          'WAITING FOR OPPONENT…'
        )}
      </p>
      <p className="text-center text-[9px] tabular-nums tracking-[0.14em] text-faint">CODE EXPIRES IN {fmtClock(room.expiresAt - now)}</p>
      <p className="text-[9px] leading-relaxed tracking-[0.06em] text-faint">
        TARGET: {room.snippet?.title} · {room.durationSec ? `${room.durationSec}s SPRINT` : 'FIRST TO FINISH'} ·{' '}
        {room.strict ? 'STRICT' : 'NATURAL'}
      </p>
    </div>
  );
}

export default function RaceView() {
  const race = useRace();
  const captureRef = useTypingEngine();
  const status = useGameStore((s) => s.status);
  const pointer = useGameStore((s) => s.pointer);
  const snippet = useGameStore((s) => s.snippet);
  const apiOnline = useGameStore((s) => s.apiOnline);
  const [panel, setPanel] = useState('menu'); // menu | create | join
  const [log, setLog] = useState([]);
  const [card, setCard] = useState(null); // { title, canvas, text } — flash card modal
  const theme = useGameStore((s) => s.theme);
  const authUser = useGameStore((s) => s.authUser);
  const profileName = useGameStore((s) => s.profileName);
  const lastRun = useGameStore((s) => s.lastRun);
  const raceGhost = useGameStore((s) => s.raceGhost);
  const daily = useDaily();
  // race cards show the display name when the user has set one
  const handle = (profileName || (authUser ? String(authUser).split('@')[0] : 'GUEST')).toUpperCase();
  const ghostBeaten = raceGhost && lastRun?.stats ? lastRun.stats.timeSec < raceGhost.timeSec : null;

  const openCard = (c) => setCard(c);

  const openRaceCard = async () => {
    const r = race.result;
    if (!r) return;
    const you = r.you?.stats;
    const opp = r.opp?.stats;
    const won = r.winner === 'you';
    const accuracy = Math.round((you?.accuracy ?? 0) * 10) / 10;
    const title = race.room?.snippet?.title || 'TARGET';
    const canvas = await renderRaceCard(
      {
        won,
        wpm: you?.wpm ?? '—',
        accuracy,
        rank: won ? '1ST' : '2ND',
        title,
        modeLabel: race.room?.durationSec ? `${race.room.durationSec}S SPRINT` : 'FIRST TO FINISH',
        oppName: r.opp?.name || 'RIVAL',
        oppDone: Boolean(r.opp?.done),
        oppFinishT: opp?.timeSec ?? null,
        keystrokes: lastRun?.stats?.chars || snippet?.charCount || 0,
        errors: you?.errors ?? 0,
        victories: race.record?.w ?? 0,
        total: snippet?.charCount || 1,
        progress: race.progressRef?.current || [],
        yourFinishT: you?.timeSec ?? 0
      },
      theme
    );
    openCard({ title: 'RACE FLASH CARD', canvas, text: raceShareText({ won, wpm: you?.wpm ?? 0, accuracy, title, oppName: r.opp?.name || 'RIVAL', oppWpm: opp?.wpm ?? '—' }) });
  };

  const openProfileCard = async () => {
    try {
      const [d] = await Promise.all([api.sessions(500).then((res) => res.sessions).catch(() => [])]);
      const profile = buildProfile({ sessions: d, authUser, streak: daily?.streak || 0 });
      const canvas = await renderProfileCard(profile, theme);
      openCard({ title: 'PROFILE FLASH CARD', canvas, text: profileShareText(profile) });
    } catch {
      /* card render failed — stay quiet */
    }
  };

  const openResultCard = async () => {
    const r = race.result;
    if (!r) return;
    const you = r.you?.stats;
    const opp = r.opp?.stats;
    const won = r.winner === 'you';
    const accuracy = Math.round((you?.accuracy ?? 0) * 10) / 10;
    const title = race.room?.snippet?.title || 'TARGET';
    const canvas = await renderResultCard(
      {
        won,
        yourName: handle,
        oppName: r.opp?.name || 'RIVAL',
        oppBot: Boolean(r.opp?.bot),
        wpm: you?.wpm ?? '—',
        oppWpm: opp?.wpm ?? '—',
        accuracy,
        errors: you?.errors ?? 0,
        title,
        modeLabel: race.room?.durationSec ? `${race.room.durationSec}S SPRINT` : 'FIRST TO FINISH'
      },
      theme
    );
    openCard({ title: 'RACE RESULT', canvas, text: raceShareText({ won, wpm: you?.wpm ?? 0, accuracy, title, oppName: r.opp?.name || 'RIVAL', oppWpm: opp?.wpm ?? '—' }) });
  };

  useEffect(() => {
    if (!race.result) return;
    setLog((prev) =>
      [
        {
          win: race.result.winner === 'you',
          you: race.result.you?.stats?.wpm ?? null,
          opp: race.result.opp?.stats?.wpm ?? null,
          oppName: race.result.opp?.name || 'RIVAL',
          reason: race.result.reason,
          at: new Date().toLocaleTimeString()
        },
        ...prev
      ].slice(0, 5)
    );
  }, [race.result]);

  useEffect(() => {
    if (race.state === 'idle' && !race.joinError) setPanel('menu');
    if (race.state === 'waiting') setPanel((p) => (p === 'create' || p === 'join' ? p : 'menu'));
  }, [race.state, race.joinError]);

  // Hold the "START!" flash up for 700ms after GO so both players actually
  // see it (the countdown overlay would otherwise unmount at zero).
  const [startFlash, setStartFlash] = useState(false);
  useEffect(() => {
    if (race.state !== 'racing' || !race.raceStartAt) return;
    setStartFlash(true);
    const id = setTimeout(() => setStartFlash(false), 700);
    return () => clearTimeout(id);
  }, [race.state, race.raceStartAt]);

  const inRace = race.state === 'countdown' || race.state === 'racing';
  const total = inRace || race.state === 'done' ? snippet?.charCount || 0 : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!inRace) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [inRace]);
  const durLeft =
    race.state === 'racing' && race.room?.durationSec ? race.raceStartAt + race.room.durationSec * 1000 - now : 0;

  // Live WPM for both players — the race is read in WPM (5-char words), not raw chars.
  const correctChars = useGameStore((s) => s.correctChars);
  const raceElapsedSec = race.raceStartAt ? Math.max(0.1, (now - race.raceStartAt) / 1000) : 0;
  const youWpm = raceElapsedSec && status !== 'idle' ? Math.round((correctChars / 5) / (raceElapsedSec / 60)) : 0;
  const oppWpm = raceElapsedSec && race.oppChars ? Math.round((race.oppChars / 5) / (raceElapsedSec / 60)) : 0;

  const rivalName = race.result?.opp?.bot
    ? race.result.opp.name
    : race.room?.opp?.bot
    ? race.room.opp.name
    : race.room?.opp
    ? race.room.opp.name
    : 'RIVAL';

  const STATE_TEXT = {
    waiting: race.room?.isCreator ? 'RACE CREATED — AWAITING OPPONENT' : 'JOINED — AWAITING START',
    countdown: 'OPPONENT FOUND — SYNCING START',
    racing: race.room?.durationSec ? 'RACE LIVE — MOST CHARS WHEN TIME RUNS OUT WINS' : 'RACE LIVE — FIRST TO FINISH WINS',
    done: 'RACE COMPLETE'
  };

  return (
    <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-4 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
      <div className="order-2 space-y-4 xl:order-1">
        <GhostRaceCard raceState={race.state} />

        <HudCard label="1V1 QUICK RACE" right={<span className="hud-label">CODE LOBBY</span>}>
          {!apiOnline ? (
            <p className="py-2 text-[10px] leading-relaxed tracking-[0.08em] text-blood">
              RACES NEED THE API LINK.
              <br />
              <span className="text-faint">CHECK YOUR CONNECTION — RETRY SHORTLY.</span>
            </p>
          ) : race.state === 'waiting' ? (
            <div className="space-y-3">
              <WaitingBox race={race} />
              <button type="button" onClick={race.leave} className="chip chip-off w-full py-2 text-[10px]">
                ✕ CANCEL RACE
              </button>
            </div>
          ) : inRace ? (
            <div className="space-y-3">
              <p className="text-[10px] leading-relaxed tracking-[0.12em] text-dim">{STATE_TEXT[race.state]}</p>
              <button type="button" onClick={race.leave} className="chip chip-off w-full py-2 text-[10px]">
                ✕ FORFEIT
              </button>
            </div>
          ) : race.state === 'done' ? (
            <div className="space-y-3">
              {race.result ? (
                <div
                  className={`border px-3 py-2.5 text-center text-[12px] font-bold tracking-[0.18em] ${
                    race.result.winner === 'you' ? 'border-good/50 bg-good/10 text-good' : 'border-blood/50 bg-blood/10 text-blood'
                  }`}
                >
                  {race.result.winner === 'you' ? '✓ YOU WIN' : `✕ ${rivalName} WINS`}
                  {race.result.reason === 'quit' ? ' (FORFEIT)' : race.result.reason === 'timeout' ? ' (TIME)' : ''}
                </div>
              ) : null}
              <button type="button" onClick={race.leave} className="chip chip-on-amber w-full py-2 text-[10px]">
                ⚔ NEW RACE
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {panel === 'menu' ? (
                <div className="space-y-2">
                  <p className="text-[10px] leading-relaxed tracking-[0.1em] text-dim">PICK HOW YOU WANT TO RACE:</p>
                  <button type="button" onClick={() => setPanel('create')} className="chip chip-on-amber w-full py-2.5 text-[11px]">
                    ⚔ CREATE RACE
                  </button>
                  <button type="button" onClick={() => setPanel('join')} className="chip chip-off w-full py-2.5 text-[11px]">
                    ⊕ JOIN RACE (HAVE A CODE?)
                  </button>
                </div>
              ) : panel === 'create' ? (
                <>
                  <button type="button" onClick={() => setPanel('menu')} className="chip chip-off w-full py-1.5 text-[9px]">
                    ← BACK
                  </button>
                  <CreateForm
                    onCreate={(config) => {
                      setPanel('menu');
                      race.createRace(config);
                    }}
                  />
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { setPanel('menu'); race.leave(); }} className="chip chip-off w-full py-1.5 text-[9px]">
                    ← BACK
                  </button>
                  <JoinForm onJoin={(code) => race.joinRace(code)} />
                  {race.joinError === 'invalid' ? (
                    <p className="border border-blood/50 bg-blood/10 px-3 py-2 text-center text-[10px] font-bold tracking-[0.16em] text-blood">
                      INVALID CODE — CHECK AND RE-ENTER
                    </p>
                  ) : null}
                  {race.joinError === 'full' ? (
                    <p className="border border-blood/50 bg-blood/10 px-3 py-2 text-center text-[10px] font-bold tracking-[0.16em] text-blood">
                      LOBBY IS FULL (2/2)
                    </p>
                  ) : null}
                </>
              )}
              {race.errorMsg ? (
                <p className="border border-blood/50 bg-blood/10 px-3 py-2 text-center text-[10px] font-bold tracking-[0.16em] text-blood">
                  {race.errorMsg}
                </p>
              ) : null}
            </div>
          )}
          <div className="mt-3 border-t border-edge pt-3">
            <div className="hud-label mb-2">HOW IT WORKS</div>
            <ul className="space-y-1 text-[10px] leading-relaxed tracking-[0.06em] text-faint">
              <li>• CREATE → GET A 6-DIGIT CODE, SHARE IT</li>
              <li>• JOIN → ENTER A CODE TO ENTER THAT LOBBY</li>
              <li>• 2 SLOT LOBBY — FULL ONCE A RIVAL JOINS</li>
              <li>• CODES EXPIRE 15 MIN AFTER CREATION</li>
              <li>• 3-SECOND COUNTDOWN — 3 · 2 · 1 · START, SYNCED FOR BOTH</li>
            </ul>
          </div>
        </HudCard>
      </div>

      <div className="order-1 space-y-4 xl:order-2">
        {inRace || race.state === 'done' ? (
          <HudCard label="RACE TRACK" corners={race.state === 'racing' ? 'amber' : 'slate'}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <PlayerBar label="YOU" chars={pointer} total={total} done={status === 'finished'} color="rgb(var(--c-accent))" wpm={youWpm} />
              <div className="flex shrink-0 flex-col items-center text-faint">
                <span className="text-[10px] font-bold tracking-[0.3em]">VS</span>
                {durLeft > 0 ? (
                  <span className="text-[11px] font-bold tabular-nums text-blood">{fmtClock(durLeft)}</span>
                ) : null}
              </div>
              <PlayerBar label={rivalName} chars={race.oppChars} total={total} done={race.oppDone} color="rgb(var(--c-blood))" wpm={oppWpm} />
            </div>
          </HudCard>
        ) : null}
        <div className="relative">
          {(race.state === 'countdown' && race.countdownAt) || startFlash ? <Countdown at={race.countdownAt} /> : null}
          {status !== 'finished' ? (
            <TypingArena captureRef={captureRef} />
          ) : race.state === 'done' && race.result ? (
            <HudCard label="RACE TRACK" corners={race.result.winner === 'you' ? 'amber' : 'slate'}>
              <div className="py-8 text-center">
                <div className={`text-3xl font-bold tracking-[0.3em] ${race.result.winner === 'you' ? 'text-good' : 'text-blood'}`}>
                  {race.result.winner === 'you' ? 'VICTORY' : 'DEFEAT'}
                </div>
                <div className="mt-2 text-[10px] tracking-[0.18em] text-dim">
                  {race.result.reason === 'timeout'
                    ? 'TIME UP — MOST CHARS TYPED WINS'
                    : race.result.reason === 'quit'
                      ? 'BY FORFEIT'
                      : 'FIRST TO FINISH WINS'}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <button type="button" onClick={openRaceCard} className="chip chip-on-amber py-2 text-[10px]">
                    ⚡ RACE FLASH CARD
                  </button>
                  <button type="button" onClick={openProfileCard} className="chip chip-on-cyan py-2 text-[10px]">
                    ▣ PROFILE CARD
                  </button>
                  <button type="button" onClick={openResultCard} className="chip chip-off py-2 text-[10px]">
                    ⇗ SHARE RESULT
                  </button>
                </div>
                <div className="mt-5 text-[9px] tracking-[0.2em] text-faint">PRESS "NEW RACE" ON THE LEFT TO GO AGAIN</div>
              </div>
            </HudCard>
          ) : race.state === 'idle' ? (
            raceGhost ? (
              <GhostVerdictCard
                ghostBeaten={ghostBeaten}
                raceGhost={raceGhost}
                timeSec={lastRun?.stats?.timeSec ?? 0}
                wpm={lastRun?.stats?.wpm ?? 0}
              />
            ) : (
              <HudCard label="RUN COMPLETE" corners="slate">
                <div className="py-8 text-center">
                  <div className="text-2xl font-bold tracking-[0.3em] text-accent">RUN COMPLETE</div>
                  <div className="mt-2 text-[10px] tracking-[0.18em] text-dim">FULL DIAGNOSTICS LIVE IN THE TRAIN VIEW</div>
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={() => useGameStore.getState().setView('train')}
                      className="chip chip-on-amber py-2 text-[10px]"
                    >
                      ⇗ OPEN DIAGNOSTICS
                    </button>
                  </div>
                </div>
              </HudCard>
            )
          ) : (
            <HudCard label="RACE TRACK" corners="amber">
              <div className="py-10 text-center">
                <div className="text-xl font-bold tracking-[0.28em] text-accent">FINISHED — WAITING FOR RIVAL</div>
                <div className="mt-3 animate-pulse-soft text-[10px] tracking-[0.2em] text-dim">
                  YOU HOOKED IT FIRST · THE RESULT LANDS THE MOMENT THEY FINISH
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
                    YOU {r.you ?? '—'}W · {r.oppName} {r.opp ?? '—'}W
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

      <FlashCardModal open={Boolean(card)} title={card?.title} canvas={card?.canvas} text={card?.text} onClose={() => setCard(null)} />
    </main>
  );
}
