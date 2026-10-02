import { useEffect, useRef, useState } from 'react';

import AuthMenu from './AuthMenu.jsx';
import CodeTypeMark from './CodeTypeMark.jsx';
import { CheckIcon, ChevronIcon } from './Icons.jsx';
import { useGameStore } from '../store/gameStore.js';
import { THEME_META } from '../utils/themes.js';
import { apiUrl } from '../utils/env.js';
import { FE_VERSION } from '../utils/siteConfig.js';

// Mini editor mock, painted with the theme's own tokens so the card previews
// the real app under any active theme.
function ThemePreview({ p, on }) {
  return (
    <span className="theme-card-preview" style={{ background: p.bg, borderColor: on ? p.accent : p.line }}>
      <span className="theme-card-dots">
        <i style={{ background: p.line }} />
        <i style={{ background: p.line }} />
        <i style={{ background: p.accent }} />
      </span>
      <span className="tp-line">
        <i className="tp-seg" style={{ width: '46%', background: p.accent }} />
        <i className="tp-seg" style={{ width: '30%', background: p.line }} />
      </span>
      <span className="tp-line" style={{ paddingLeft: '14%' }}>
        <i className="tp-seg" style={{ width: '38%', background: p.alt }} />
        <i className="tp-seg" style={{ width: '24%', background: p.line }} />
      </span>
      <span className="tp-line" style={{ paddingLeft: '5%' }}>
        <i className="tp-seg" style={{ width: '24%', background: p.ink }} />
        <i className="tp-seg" style={{ width: '20%', background: p.accent }} />
        <i className="tp-seg" style={{ width: '17%', background: p.line }} />
      </span>
      {on ? (
        <span className="theme-card-check" style={{ background: p.accent, color: p.bg }}>
          <CheckIcon className="h-2.5 w-2.5" />
        </span>
      ) : null}
    </span>
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
        <span className="theme-trigger-dots mr-1.5" aria-hidden>
          <i style={{ background: active.swatch[0] }} />
          <i style={{ background: active.swatch[1] }} />
        </span>
        THEMES
        <ChevronIcon className="ml-1.5 h-3 w-3 opacity-70" up={open} />
      </button>

      {open ? (
        <div role="menu" aria-label="select theme" className="theme-pop w-[316px] max-w-[92vw]">
          <div className="flex items-baseline justify-between px-2.5 pb-2.5 pt-1">
            <span className="text-[10px] font-bold tracking-[0.2em] text-ink">SELECT THEME</span>
            <span className="text-[9px] tracking-[0.12em] text-faint">
              {active.label.toUpperCase()} ACTIVE
            </span>
          </div>
          <div className="theme-grid">
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
                  className={`theme-card ${on ? 'theme-card-on' : ''}`}
                >
                  <ThemePreview p={t.preview} on={on} />
                  <span className="theme-card-label">
                    <span>{t.label.toUpperCase()}</span>
                    <span className="theme-card-mode">{t.mode}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="px-2.5 pt-2.5 text-[8px] tracking-[0.12em] text-faint">
            SAVED AUTOMATICALLY ON THIS DEVICE
          </p>
        </div>
      ) : null}
    </div>
  );
}

const VIEWS = [
  ['train', 'TRAIN'],
  ['race', 'RACE'],
  ['leaderboards', 'BOARDS'],
  ['analytics', 'ANALYTICS'],
  ['profile', 'PROFILE']
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

// Bump on every deploy so users can see at a glance which build is running
// (top-right corner, amber). v1.7.0 = profiles: name + photo, top bar shows
// the name (not the email), sign-in dropdown, PROFILE tab, photo on flash
// cards; v1.6.0 = form-field keystrokes no longer hijack the typing engine
// (auth fix); v1.5.0 = home language row, HUD settings with tooltips,
// auto-pause, drill NEW, ghost gate, 3-2-1 race start.


export default function TopBar() {
  const snippet = useGameStore((s) => s.snippet);
  const apiOnline = useGameStore((s) => s.apiOnline);
  const catalogSource = useGameStore((s) => s.catalogSource);
  const [apiVersion, setApiVersion] = useState('1.0.0');

  // CODETYPE logo = home: jump to the train view and reset any live run
  const goHome = () => {
    // leave a site page (/about, …) so the URL matches the view again
    if (window.location.pathname !== '/') {
      try {
        window.history.replaceState({}, '', '/');
      } catch {
        /* non-browser context */
      }
    }
    const st = useGameStore.getState();
    st.setView('train');
    st.setDeckTab('daily');
    if (st.status === 'running' || st.status === 'paused' || st.status === 'finished') st.restart();
  };
  // Flash cards get a permanent, high-visibility home in the top bar
  const openCards = () => {
    const st = useGameStore.getState();
    st.setView('train');
    st.setDeckTab('flash');
  };

  useEffect(() => {
    if (!apiOnline) return;
    let cancelled = false;
    fetch(apiUrl('/api/health'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.version) setApiVersion(String(j.version));
      })
      .catch(() => {});
    return () => {
      cancelled = false;
    };
  }, [apiOnline]);

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-3 border-b border-edge bg-panel/85 px-5 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={goHome}
          title="Back to home"
          className="shrink-0 cursor-pointer text-lg font-bold text-accent transition-opacity hover:opacity-75"
        >
          <CodeTypeMark compact />
        </button>
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
        <button
          type="button"
          onClick={openCards}
          title="Generate a shareable flash card — profile or run, PNG in one click"
          className="chip chip-on-cyan !px-3 !py-1 !text-[10px]"
        >
          ⚡ CARDS
        </button>
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
        <span className="text-[11px] font-bold tracking-[0.18em] text-accent" title="frontend build">v{FE_VERSION}</span>
      </div>
    </header>
  );
}
