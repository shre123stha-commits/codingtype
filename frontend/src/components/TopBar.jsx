import { useEffect, useRef, useState } from 'react';

import AuthMenu from './AuthMenu.jsx';
import { useGameStore } from '../store/gameStore.js';
import { THEME_META } from '../utils/themes.js';

function Swatch({ swatch, className = '' }) {
  return (
    <span
      className={`inline-block shrink-0 border border-edge2 ${className}`}
      style={{ background: `linear-gradient(90deg, ${swatch[0]} 55%, ${swatch[1]} 55%)` }}
    />
  );
}

function ThemeMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const theme = useGameStore((s) => s.theme);
  const setTheme = useGameStore((s) => s.setTheme);
  const setUiOpen = useGameStore((s) => s.setUiOpen);
  const active = THEME_META.find((t) => t.id === theme) || THEME_META[0];

  useEffect(() => {
    if (!open) return;
    setUiOpen(true);
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      setUiOpen(false);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, setUiOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`chip flex items-center ${open ? 'chip-on-amber' : 'chip-off'}`}
      >
        <Swatch swatch={active.swatch} className="mr-1.5 h-3 w-5 translate-y-[1px]" />
        THEMES
        <span className="ml-1.5 text-[8px]">{open ? '▲' : '▼'}</span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="select theme"
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-48 border border-edge bg-panel shadow-lg shadow-black/30"
        >
          <div className="hud-label border-b border-edge px-3 py-2">SELECT THEME</div>
          {THEME_META.map((t) => {
            const on = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[11px] transition-colors ${
                  on ? 'bg-accent/10 text-accent' : 'text-ink hover:bg-panel2 hover:text-accent2'
                }`}
              >
                <Swatch swatch={t.swatch} className="h-3.5 w-6" />
                <span className="flex-1 font-semibold tracking-[0.14em]">{t.label.toUpperCase()}</span>
                {on ? <span className="text-[10px] text-accent">●</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const VIEWS = [
  ['train', 'TRAIN'],
  ['race', 'RACE'],
  ['analytics', 'ANALYTICS']
];

function ViewTabs() {
  const view = useGameStore((s) => s.view);
  const setView = useGameStore((s) => s.setView);
  return (
    <nav className="flex items-center gap-1" aria-label="main">
      {VIEWS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setView(id)}
          className={`chip !px-2.5 !py-1 !text-[10px] ${view === id ? 'chip-on-amber' : 'chip-off'}`}
        >
          {label}
        </button>
      ))}
      <FeaturesMenu />
    </nav>
  );
}

const FEATURES = [
  {
    view: 'train',
    area: 'TRAIN',
    items: [
      ['DAILY CHALLENGE', 'daily', 'same target for everyone each day · streak + leaderboard'],
      ['DRILL CATEGORIES', 'drill', 'ALGO · REAL-REPO · SPRINT · INTERVIEW × 6 languages'],
      ['TARGET DROPS', 'target', 'every target for your language, one click to load'],
      ['IMPORT CODE', 'import', 'paste a file or GitHub URL, type the code you actually write'],
      ['AI MICRO-DRILL', 'aidrill', '15-sec drill auto-built from your 3 worst symbols'],
      ['BLIND MODE', 'flags', 'type with a 3-char reveal window, or fully blind'],
      ['GHOST PAIRS', 'flags', 'closing brackets pre-rendered as you type openers'],
      ['FLASH CARDS', 'flash', 'profile + race share cards — PNG, copy image, post to X']
    ]
  },
  {
    view: 'race',
    area: 'RACE',
    items: [
      ['1V1 QUICK RACE', null, 'sync start, live progress bars, winner screen — a bot fills in if no human'],
      ['GHOST RACE', null, 'race your personal best, replayed keystroke by keystroke']
    ]
  },
  {
    view: 'analytics',
    area: 'ANALYTICS',
    items: [
      ['KEY HEATMAP', null, 'your error rate per key, QWERTY map'],
      ['FINGER STRENGTH', null, 'per-finger accuracy + weakest/strongest callout'],
      ['VELOCITY TREND', null, 'WPM / CPM / accuracy across your last runs'],
      ['SESSION LOG + PBs', null, 'history and personal bests per mode/language'],
      ['SHARE CARD', null, 'one-click PNG of your run for X / Discord / LinkedIn']
    ]
  }
];

function FeaturesMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const setView = useGameStore((s) => s.setView);
  const setDeckTab = useGameStore((s) => s.setDeckTab);
  const setUiOpen = useGameStore((s) => s.setUiOpen);

  useEffect(() => {
    if (!open) return;
    setUiOpen(true);
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      setUiOpen(false);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, setUiOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`chip !px-2.5 !py-1 !text-[10px] ${open ? 'chip-on-cyan' : 'chip-off'}`}
      >
        ✦ FEATURES
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="features"
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-[560px] max-w-[92vw] border border-edge bg-panel shadow-lg shadow-black/40"
        >
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-3">
            {FEATURES.map((group) => (
              <div key={group.area} className="border-b border-edge/60 p-3 sm:border-b-0 sm:border-r sm:last:border-r-0">
                <button
                  type="button"
                  onClick={() => {
                    setView(group.view);
                    setOpen(false);
                  }}
                  className="mb-2 block w-full text-left text-[10px] font-bold tracking-[0.22em] text-accent hover:underline"
                >
                  → {group.area}
                </button>
                <ul className="space-y-1">
                  {group.items.map(([name, tab, desc]) => (
                    <li key={name}>
                      <button
                        type="button"
                        onClick={() => {
                          if (tab) setDeckTab(tab);
                          setView(group.view);
                          setOpen(false);
                        }}
                        className="block w-full rounded-sm px-1 py-0.5 text-left text-[9px] leading-snug hover:bg-accent/10"
                        title={`open ${group.view}`}
                      >
                        <span className="font-semibold tracking-[0.08em] text-ink">{name} →</span>
                        <span className="block text-faint">{desc}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TopBar() {
  const snippet = useGameStore((s) => s.snippet);
  const apiOnline = useGameStore((s) => s.apiOnline);
  const catalogSource = useGameStore((s) => s.catalogSource);
  const [apiVersion, setApiVersion] = useState('1.0.0');

  useEffect(() => {
    if (!apiOnline) return;
    let cancelled = false;
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.version) setApiVersion(String(j.version));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiOnline]);

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-3 border-b border-edge bg-panel/85 px-5 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 text-lg font-bold text-accent">
          <span className="mr-1 inline-block h-4 w-2.5 translate-y-[2px] animate-blink bg-accent align-baseline" />
          CODETYPE
        </span>
        <ViewTabs />
      </div>

      {snippet ? (
        <div className="hidden items-center gap-2 lg:flex">
          <span className="hud-label">TARGET</span>
          <span className="text-[11px] text-ink">{snippet.source}</span>
          <span className="border border-edge px-1.5 py-0.5 text-[9px] tracking-[0.18em] text-dim">
            {snippet.mode.toUpperCase()}
          </span>
        </div>
      ) : (
        <span className="hidden text-[10px] tracking-[0.24em] text-faint lg:inline">
          {catalogSource === 'loading' ? 'SYNCING SNIPPET REPO…' : 'SELECT A TARGET'}
        </span>
      )}

      <div className="flex items-center gap-3">
        <AuthMenu />
        <ThemeMenu />

        <span
          className={`inline-flex items-center gap-2 border px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] ${
            apiOnline
              ? 'border-pulse/50 bg-pulse/10 text-pulse'
              : 'border-accent/50 bg-accent/10 text-accent'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${apiOnline ? 'bg-pulse' : 'bg-accent'} animate-pulse-soft`} />
          {apiOnline ? 'API LINK: LIVE' : 'API LINK: LOCAL'}
        </span>
        <span className="hidden text-[10px] tracking-[0.18em] text-faint sm:inline">v{apiVersion}</span>
      </div>
    </header>
  );
}
