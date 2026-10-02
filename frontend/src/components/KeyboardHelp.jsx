// Keyboard shortcuts help. F1 or ? opens it, Esc closes it.
// Command shortcuts are intentionally inactive while a run is in progress so
// ordinary code characters are never hijacked.
import { useEffect, useState } from 'react';

import { useGameStore } from '../store/gameStore.js';

const APP_VIEWS = ['train', 'race', 'leaderboards', 'analytics', 'profile'];

const SHORTCUTS = [
  ['F1 / ?', 'open or close this help'],
  ['ESC', 'pause or resume a run · close this dialog'],
  ['ALT + R', 'restart the current target when not typing'],
  ['ALT + N', 'load a new target when not typing'],
  ['ALT + B', 'cycle BLIND: OFF → 3CH → FULL'],
  ['ALT + 1–5', 'open Train · Race · Boards · Analytics · Profile'],
  ['TAB', 'claim the pending indent while typing'],
  ['ENTER', 'type a newline · rerun after a completed test']
];

export default function KeyboardHelp() {
  const [open, setOpen] = useState(false);
  const status = useGameStore((s) => s.status);
  const restart = useGameStore((s) => s.restart);
  const changeSnippet = useGameStore((s) => s.changeSnippet);
  const cycleBlind = useGameStore((s) => s.cycleBlind);
  const setView = useGameStore((s) => s.setView);
  const setUiOpen = useGameStore((s) => s.setUiOpen);
  const togglePause = useGameStore((s) => s.togglePause);

  // Keep the invisible typing capture from receiving code keys through the
  // modal. A help click during a run safely pauses it first.
  useEffect(() => {
    setUiOpen(open);
    return () => setUiOpen(false);
  }, [open, setUiOpen]);

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      const inField = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      const typing = status === 'running' || status === 'paused';

      // F1 belongs to the app even while a run is active; do not let the
      // browser's built-in help steal focus mid-test.
      if (e.key === 'F1' && !inField) e.preventDefault();
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (inField || typing) return;

      if (e.key === 'F1' || e.key === '?') {
        e.preventDefault();
        setOpen((wasOpen) => !wasOpen);
        return;
      }
      // Do not let commands operate through the open help dialog.
      if (open || !e.altKey || e.ctrlKey || e.metaKey) return;

      const key = e.key.toLowerCase();
      if (key === 'r') {
        e.preventDefault();
        restart();
      } else if (key === 'n') {
        e.preventDefault();
        changeSnippet();
      } else if (key === 'b') {
        e.preventDefault();
        cycleBlind();
      } else if (/^[1-5]$/.test(key)) {
        e.preventDefault();
        setView(APP_VIEWS[Number(key) - 1]);
      }
    };
    const openEvt = (e) => {
      if (!e.detail?.open) return;
      if (status === 'running') togglePause(Date.now());
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('ct-help', openEvt);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('ct-help', openEvt);
    };
  }, [changeSnippet, cycleBlind, open, restart, setView, status, togglePause]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="keyboard shortcuts"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-[520px] border border-edge2 bg-panel2 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[12px] font-bold tracking-[0.2em] text-accent">KEYBOARD SHORTCUTS</div>
          <button type="button" className="site-link" onClick={() => setOpen(false)} aria-label="close">
            ✕
          </button>
        </div>
        <p className="mb-4 text-[9px] leading-relaxed tracking-[0.08em] text-faint">
          COMMANDS STAY SILENT WHILE YOU TYPE — YOUR CODE KEYS ARE NEVER HIJACKED MID-SESSION.
        </p>
        <div className="space-y-2">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between gap-4 border-b border-edge/60 pb-2">
              <span className="shrink-0 border border-edge2 bg-panel px-2 py-1 text-[10px] font-bold tracking-[0.12em] text-ink">
                {key}
              </span>
              <span className="flex-1 text-right text-[10px] leading-relaxed tracking-[0.06em] text-dim">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
