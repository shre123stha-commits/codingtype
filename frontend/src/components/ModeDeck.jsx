import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';

import AdaptivePanel from './AdaptivePanel.jsx';
import HudCard from './HudCard.jsx';
import ImportPanel from './ImportPanel.jsx';
import { useDaily } from '../hooks/useApi.js';
import { MODES } from '../data/snippets.js';
import { useGameStore } from '../store/gameStore.js';
import { apiUrl } from '../utils/env.js';

// Flash cards pull in the `qrcode` library (canvas share cards). That is only
// needed if the operator opens the FLASH CARDS tab, so it is code-split out of
// the initial bundle — the home page must not pay for it.
const FlashCardsView = lazy(() => import('./FlashCardsView.jsx'));

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

// LANG moved to the center of the home page; MODES & FLAGS moved into the
// live HUD (where WPM/RAW are shown) with per-option tooltips.
const TABS = [
  { id: 'daily', num: '01', label: 'DAILY', title: 'DAILY CHALLENGE' },
  { id: 'drill', num: '02', label: 'DRILL', title: 'DRILL CATEGORY' },
  { id: 'target', num: '03', label: 'TARGET', title: 'TARGETS' },
  { id: 'import', num: '04', label: 'IMPORT', title: 'IMPORT CODE' },
  { id: 'aidrill', num: '05', label: 'AI', title: 'AI MICRO-DRILL' },
  { id: 'flash', num: '06', label: 'CARDS', title: 'FLASH CARDS' }
];

function SectionTitle({ num, title }) {
  return (
    <div className="hud-label mb-2.5">
      <span className="mr-1.5 text-accent/70">{num}</span>
      {title}
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

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    // 'click' (not 'pointerdown'): the target dropdown is in-flow, so closing
    // it on pointerdown would reflow the deck mid-gesture and steal the click.
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [ref, onOutside]);
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
  const pickDrillMode = useGameStore((s) => s.pickDrillMode);
  const setLanguage = useGameStore((s) => s.setLanguage);
  const setStrictMode = useGameStore((s) => s.setStrictMode);
  const setGhostMode = useGameStore((s) => s.setGhostMode);
  const setIndentAssist = useGameStore((s) => s.setIndentAssist);
  const cycleBlind = useGameStore((s) => s.cycleBlind);
  const loadSnippet = useGameStore((s) => s.loadSnippet);
  const status = useGameStore((s) => s.status);
  const snippet = useGameStore((s) => s.snippet);
  const daily = useDaily();
  const tab = useGameStore((s) => s.deckTab);
  const setTab = useGameStore((s) => s.setDeckTab);
  const [targetOpen, setTargetOpen] = useState(false);
  const targetRef = useRef(null);
  useClickOutside(targetRef, () => setTargetOpen(false));

  const langTargets = useMemo(
    () => catalog.filter((s) => s.language === language),
    [catalog, language]
  );
  const filtered = useMemo(
    () => langTargets.filter((s) => s.mode === mode),
    [langTargets, mode]
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

  // Drill "NEW": hand out a fresh target from the SAME domain (mode +
  // language), cycling through every target in the domain before any
  // repeats. Resets its own order when the domain changes.
  const newSeq = useRef({ key: '', order: [] });
  const nextNew = () => {
    const key = `${mode}|${language}`;
    if (newSeq.current.key !== key || !newSeq.current.order.length) {
      const ids = filtered.map((s) => s.id);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      newSeq.current = { key, order: ids };
    }
    const cur = snippet?.id;
    let pick = null;
    while (newSeq.current.order.length && !pick) {
      const id = newSeq.current.order.pop();
      if (id !== cur) pick = filtered.find((s) => s.id === id) || null;
    }
    if (!pick) {
      // domain exhausted — reshuffle (excluding the current one) and repeat
      const ids = filtered.filter((s) => s.id !== cur).map((s) => s.id);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      newSeq.current.order = ids;
      pick = filtered.find((s) => s.id === ids[ids.length - 1]) || null;
    }
    if (pick) loadSnippet(pick);
  };

  const pickTarget = (s) => {
    setTargetOpen(false);
    if (s.mode !== mode) setMode(s.mode);
    loadSnippet(s);
  };

  const dailySnippetObj = daily ? catalog.find((s) => s.id === daily.snippetId) || null : null;
  const dailyLoaded = snippet && snippet.id === dailySnippetObj?.id;
  const [dailyFull, setDailyFull] = useState(null);

  useEffect(() => {
    if (!daily || !dailySnippetObj) {
      setDailyFull(null);
      return undefined;
    }
    if (dailySnippetObj.code) {
      setDailyFull(dailySnippetObj);
      return undefined;
    }
    let live = true;
    fetch(apiUrl(`/api/snippets/${encodeURIComponent(daily.snippetId)}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (live && j) setDailyFull(j);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [daily, dailySnippetObj]);

  const dailyPreview = useMemo(() => {
    if (!dailyFull || !dailyFull.code) return '';
    return dailyFull.code
      .split('\n')
      .slice(0, 5)
      .map((l) => l.slice(0, 46))
      .join('\n');
  }, [dailyFull]);
  const runDaily = () => {
    if (!dailySnippetObj) return;
    loadSnippet({ ...dailyFull, ...dailySnippetObj, isDaily: true });
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

  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];

  return (
    <HudCard label="CONTROL DECK" right={<span className="hud-label">{langTargets.length} TARGETS</span>}>
      <div className="flex items-stretch">
        <nav className="flex w-14 shrink-0 flex-col self-start border-r border-edge/70" aria-label="control deck sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTargetOpen(false);
                setTab(t.id);
              }}
              className={`flex h-11 shrink-0 flex-col items-center justify-center gap-0.5 border-b border-edge/40 last:border-b-0 ${
                tab === t.id ? 'bg-accent/10 text-accent' : 'text-faint hover:bg-edge/30 hover:text-dim'
              }`}
              title={t.title}
            >
              <span className="text-[8px] tabular-nums">{t.num}</span>
              <span className="text-[8px] font-semibold tracking-[0.1em]">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 px-4 py-3">
          {tab === 'daily' ? (
            <>
              <SectionTitle num="01" title={activeTab.title} />
              {daily && dailySnippetObj ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-semibold text-ink" title={dailySnippetObj.title}>
                      {dailySnippetObj.title}
                    </span>
                    <span className="shrink-0 border border-edge px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-dim">
                      {daily.date}
                    </span>
                  </div>
                  <div className="truncate text-[9px] tracking-wide text-dim" title={dailySnippetObj.source}>
                    {dailySnippetObj.source}
                  </div>
                  {dailyPreview ? (
                    <pre className="overflow-hidden border border-edge bg-black/10 p-2 text-[9px] leading-relaxed text-dim">
                      {dailyPreview}
                    </pre>
                  ) : (
                    <div className="border border-edge p-2 text-[9px] tracking-[0.14em] text-faint">
                      SHOWING FULL CODE ON "RUN DAILY"
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={runDaily}
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
                      🔥 {daily.streak}
                    </span>
                  </div>
                  <p className="text-[9px] leading-relaxed tracking-[0.06em] text-faint">
                    SAME TARGET FOR EVERYONE TODAY
                    {daily.top.length ? ` · ${daily.top.length} FINISHED SO FAR` : ''}
                  </p>
                </div>
              ) : (
                <p className="text-[9px] tracking-[0.14em] text-faint">SYNCING DAILY TARGET…</p>
              )}
            </>
          ) : null}

          {tab === 'drill' ? (
            <>
              <SectionTitle num="02" title={activeTab.title} />
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pickDrillMode(m)}
                    className={`chip ${mode === m ? 'chip-on-amber' : 'chip-off'}`}
                  >
                    {MODE_META[m].label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-faint">{MODE_META[mode].blurb}</p>
              <button
                type="button"
                onClick={nextNew}
                disabled={!filtered.length}
                className="chip chip-on-amber mt-2.5 w-full py-2 text-[10px] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ⚡ NEW — SAME DOMAIN
              </button>
              <p className="mt-1.5 text-[9px] leading-relaxed tracking-[0.06em] text-faint">
                EACH CLICK LOADS A FRESH {MODE_META[mode].label} TARGET — ALL {filtered.length} CYCLE BEFORE ANY REPEAT.
              </p>
            </>
          ) : null}


          {tab === 'target' ? (
            <div ref={targetRef}>
              <SectionTitle num="03" title={activeTab.title} />
              <button
                type="button"
                onClick={() => setTargetOpen((v) => !v)}
                className={`chip w-full ${targetOpen ? 'chip-on-amber' : 'chip-off'}`}
                aria-expanded={targetOpen}
              >
                <span className="min-w-0 flex-1 truncate text-left">
                  {snippet ? snippet.title : 'SELECT TARGET…'}
                </span>
                <span className="ml-2 shrink-0 text-[9px]">{targetOpen ? '▲' : '▼'}</span>
              </button>
              {targetOpen ? (
                <div className="mt-2 max-h-60 overflow-y-auto border border-edge">
                  {langTargets.map((s) => {
                    const active = snippet && snippet.id === s.id && status !== 'finished';
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => pickTarget(s)}
                        className={`flex w-full items-center gap-2 border-b border-edge/50 px-2.5 py-2 text-left last:border-b-0 ${
                          active ? 'bg-accent/10' : 'hover:bg-edge/30'
                        }`}
                      >
                        <span
                          className={`w-14 shrink-0 text-center text-[8px] font-bold tracking-[0.08em] ${
                            s.mode === 'sprint'
                              ? 'border border-pulse/40 text-pulse'
                              : s.mode === 'interview'
                              ? 'border border-good/40 text-good'
                              : 'border border-edge text-dim'
                          }`}
                        >
                          {MODE_META[s.mode].label}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[10px] text-ink" title={s.source}>
                          {s.title}
                        </span>
                        <span className="shrink-0 text-[9px] tabular-nums text-faint">
                          {s.mode === 'sprint' ? '~15s' : `${s.chars} CH`}
                        </span>
                        {active ? <span className="shrink-0 text-[9px] font-bold text-accent">●</span> : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
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
              <p className="mt-2 text-[9px] leading-relaxed tracking-[0.06em] text-faint">
                SHOWING ALL {langTargets.length} TARGETS IN {LANGS.find((l) => l.id === language)?.label || language.toUpperCase()} — CLICK TO LOAD.
              </p>
            </div>
          ) : null}

          {tab === 'import' ? (
            <>
              <SectionTitle num="04" title={activeTab.title} />
              <ImportPanel />
            </>
          ) : null}

          {tab === 'aidrill' ? (
            <>
              <SectionTitle num="05" title={activeTab.title} />
              <AdaptivePanel />
            </>
          ) : null}


          {tab === 'flash' ? (
            <>
              <SectionTitle num="06" title={activeTab.title} />
              <Suspense fallback={<div className="p-6 text-center text-[9px] tracking-[0.3em] text-faint">LOADING…</div>}>
                <FlashCardsView />
              </Suspense>
            </>
          ) : null}
        </div>
      </div>
    </HudCard>
  );
}
