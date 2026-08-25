import { useEffect, useMemo, useRef, useState } from 'react';

import AdaptivePanel from './AdaptivePanel.jsx';
import HudCard from './HudCard.jsx';
import ImportPanel from './ImportPanel.jsx';
import { useDaily } from '../hooks/useApi.js';
import { MODES } from '../data/snippets.js';
import { useGameStore } from '../store/gameStore.js';

const MODE_META = {
  algorithm: { label: 'ALGO', blurb: 'Clean logic templates — sorting, search, trees, graphs.' },
  repo: { label: 'REAL-REPO', blurb: 'Production-shaped blocks from real file structures.' },
  sprint: { label: 'SPRINT', blurb: '15-second symbol drills — braces, brackets, arrows, operators.' },
  interview: { label: 'INTERVIEW', blurb: 'Timed DSA blocks. Beat the median on the benchmark bar.' }
};

const LANGS = [
  { id: 'python', label: 'PY' },
  { id: 'c++', label: 'CPP' },
  { id: 'java', label: 'JAVA' },
  { id: 'javascript', label: 'JS' },
  { id: 'rust', label: 'RUST' },
  { id: 'sql', label: 'SQL' }
];

const BLIND_LABEL = { 3: 'BLIND: 3 CH', 0: 'BLIND: FULL' };

function Section({ index, title, children }) {
  return (
    <div className="border-b border-edge/70 px-4 py-3 last:border-b-0">
      <div className="hud-label mb-2.5">
        <span className="mr-1.5 text-accent/70">{index}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, active, onToggle, accent = 'amber' }) {
  const on = accent === 'amber' ? 'chip-on-amber' : 'chip-on-cyan';
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`chip w-full text-left ${active ? on : 'chip-off'}`}
    >
      <span className="mr-2">{active ? 'ON' : 'OFF'}</span>
      {label}
    </button>
  );
}

export default function ModeDeck() {
  const catalog = useGameStore((s) => s.catalog);
  const catalogSource = useGameStore((s) => s.catalogSource);
  const mode = useGameStore((s) => s.mode);
  const language = useGameStore((s) => s.language);
  const strictMode = useGameStore((s) => s.strictMode);
  const ghostMode = useGameStore((s) => s.ghostMode);
  const indentAssist = useGameStore((s) => s.indentAssist);
  const blind = useGameStore((s) => s.blind);
  const setMode = useGameStore((s) => s.setMode);
  const setLanguage = useGameStore((s) => s.setLanguage);
  const setStrictMode = useGameStore((s) => s.setStrictMode);
  const setGhostMode = useGameStore((s) => s.setGhostMode);
  const setIndentAssist = useGameStore((s) => s.setIndentAssist);
  const cycleBlind = useGameStore((s) => s.cycleBlind);
  const loadSnippet = useGameStore((s) => s.loadSnippet);
  const status = useGameStore((s) => s.status);
  const snippet = useGameStore((s) => s.snippet);
  const daily = useDaily();
  const [dailyBusy, setDailyBusy] = useState(false);

  const filtered = useMemo(
    () => catalog.filter((s) => s.mode === mode && s.language === language),
    [catalog, mode, language]
  );

  const prevFilter = useRef(null);

  useEffect(() => {
    if (catalogSource === 'loading' || !filtered.length) return;
    const filter = `${mode}|${language}`;
    if (prevFilter.current === filter) return;
    prevFilter.current = filter;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    if (pick) loadSnippet(pick);
  }, [catalogSource, mode, language, filtered, loadSnippet]);

  const shuffle = () => {
    if (!filtered.length) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    if (pick) loadSnippet(pick);
  };

  const dailySnippetObj = daily ? catalog.find((s) => s.id === daily.snippetId) || null : null;
  const dailyLoaded = snippet && snippet.id === dailySnippetObj?.id;
  const runDaily = () => {
    if (!dailySnippetObj) return;
    setDailyBusy(true);
    loadSnippet({ ...dailySnippetObj, isDaily: true });
    setDailyBusy(false);
  };

  if (catalogSource === 'loading') {
    return (
      <HudCard label="CONTROL DECK" corners="slate">
        <div className="py-10 text-center text-[11px] tracking-[0.2em] text-dim">
          SYNCING REPO<span className="animate-blink">…</span>
        </div>
      </HudCard>
    );
  }

  return (
    <HudCard label="CONTROL DECK" right={<span className="hud-label">{filtered.length} TARGETS</span>}>
      <Section index="01" title="DAILY CHALLENGE">
        {daily && dailySnippetObj ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-semibold text-ink">{dailySnippetObj.source}</span>
              <span className="shrink-0 border border-edge px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-dim">
                {daily.date}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runDaily}
                disabled={dailyBusy}
                className={`chip flex-1 py-1.5 ${dailyLoaded ? 'chip-on-cyan' : 'chip-on-amber'}`}
              >
                {dailyLoaded ? '● LOADED' : '▶ RUN DAILY'}
              </button>
              <span
                className={`shrink-0 border px-2 py-1 text-[9px] font-bold tracking-[0.14em] ${
                  daily.streak > 0 ? 'border-accent/50 bg-accent/10 text-accent' : 'border-edge text-faint'
                }`}
                title="consecutive days completed"
              >
                🔥 {daily.streak} STREAK
              </span>
            </div>
            <p className="text-[9px] leading-relaxed tracking-[0.06em] text-faint">
              SAME TARGET FOR EVERYONE TODAY {daily.top.length ? `· ${daily.top.length} FINISHED SO FAR` : ''}
            </p>
          </div>
        ) : (
          <p className="text-[9px] tracking-[0.14em] text-faint">SYNCING DAILY TARGET…</p>
        )}
      </Section>

      <Section index="02" title="DRILL CATEGORY">
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`chip ${mode === m ? 'chip-on-amber' : 'chip-off'}`}
            >
              {MODE_META[m].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-faint">{MODE_META[mode].blurb}</p>
      </Section>

      <Section index="03" title="LANGUAGE">
        <div className="grid grid-cols-3 gap-2">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLanguage(l.id)}
              className={`chip ${language === l.id ? 'chip-on-cyan' : 'chip-off'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-faint">
          Switching mode or language auto-deploys a fresh random target.
        </p>
      </Section>

      <Section index="04" title="TARGETS">
        <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((s) => {
            const active = snippet && snippet.id === s.id && status !== 'finished';
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => loadSnippet(s)}
                className={`w-full border px-3 py-2 text-left transition-colors ${
                  active
                    ? 'border-accent/60 bg-accent/5 shadow-glow-amber'
                    : 'border-edge bg-transparent hover:border-edge2'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-[11px] font-semibold ${active ? 'text-accent' : 'text-ink'}`}>
                    {s.title}
                  </span>
                  <span
                    className={`shrink-0 text-[9px] tracking-[0.14em] ${
                      active ? 'font-bold text-accent' : 'text-faint'
                    }`}
                  >
                    {active ? '● LOADED' : s.mode === 'sprint' ? `~15s · ${s.chars} CH` : `${s.chars} CH`}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[9px] tracking-wide text-dim">{s.source}</span>
                  <span className="shrink-0 text-[9px] tabular-nums text-faint">{s.lines} L</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            onClick={shuffle}
            disabled={!filtered.length}
            className="chip chip-on-amber w-full py-2 text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ⇄ SHUFFLE TARGET
          </button>
          {status !== 'idle' ? (
            <button
              type="button"
              onClick={() => useGameStore.getState().restart()}
              className="chip chip-off w-full py-2 text-[10px]"
            >
              ↻ RESET SESSION
            </button>
          ) : null}
        </div>
      </Section>

      <Section index="05" title="IMPORT CODE">
        <ImportPanel />
      </Section>

      <Section index="06" title="AI MICRO-DRILL">
        <AdaptivePanel />
      </Section>

      <Section index="07" title="MODES & FLAGS">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setStrictMode(true)}
            className={`chip ${strictMode ? 'chip-on-amber' : 'chip-off'}`}
          >
            STRICT
          </button>
          <button
            type="button"
            onClick={() => setStrictMode(false)}
            className={`chip ${!strictMode ? 'chip-on-amber' : 'chip-off'}`}
          >
            NATURAL
          </button>
        </div>
        <p className="mb-2 mt-2 text-[10px] leading-relaxed text-faint">
          {strictMode
            ? 'Blocked on errors — the correct key must land to advance.'
            : 'Flow preserved — errors render inline in soft red.'}
        </p>
        <div className="space-y-2">
          <ToggleRow
            label="GHOST PAIRS"
            active={ghostMode}
            onToggle={() => setGhostMode(!ghostMode)}
            accent="cyan"
          />
          <ToggleRow
            label="INDENT ASSIST"
            active={indentAssist}
            onToggle={() => setIndentAssist(!indentAssist)}
            accent="cyan"
          />
          <button
            type="button"
            onClick={cycleBlind}
            className={`chip w-full text-left ${blind !== null ? 'chip-on-cyan' : 'chip-off'}`}
            title="delayed reveal — train typing without reading the screen"
          >
            <span className="mr-2">{blind !== null ? 'ON' : 'OFF'}</span>
            {BLIND_LABEL[blind] || 'BLIND WINDOW'}
          </button>
        </div>
        <p className="mt-2 text-[9px] leading-relaxed tracking-[0.06em] text-faint">
          BLIND HIDES THE CODE AHEAD OF THE CARET (3 CH WINDOW, OR FULLY). GHOST PAIRS FAINT THE CLOSE BRACKET.
        </p>
      </Section>
    </HudCard>
  );
}
