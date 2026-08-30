// Keyboard shortcuts help. F1 or ? opens it, Esc closes it.
// Deliberately inactive while a game is running — typing keys are never hijacked.
import { useEffect, useState } from 'react';

import { useGameStore } from '../store/gameStore.js';

const SHORTCUTS = [
  ['F1 / ?', 'open this help (when not typing)'],
  ['ESC', 'close help / dialogs'],
  ['1ST KEY', 'start the clock in the typing area'],
  ['CLICK BLIND CHIP', 'cycle BLIND: OFF → 3CH → FULL'],
  ['CLICK LANGUAGE CHIPS', 'swap target language instantly']
];

export default function KeyboardHelp() {
  const [open, setOpen] = useState(false);
  const status = useGameStore((s) => s.status);

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      const inField = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      const typing = status === 'running' || status === 'paused';
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (inField || typing) return;
      if (e.key === 'F1') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '?') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const openEvt = (e) => e.detail?.open && setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('ct-help', openEvt);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('ct-help', openEvt);
    };
  }, [status]);

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
        className="w-full max-w-[440px] border border-edge2 bg-panel2 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[12px] font-bold tracking-[0.2em] text-accent">KEYBOARD SHORTCUTS</div>
          <button type="button" className="site-link" onClick={() => setOpen(false)} aria-label="close">
            ✕
          </button>
        </div>
        <p className="mb-4 text-[9px] tracking-[0.08em] text-faint">
          SHORTCUTS STAY SILENT WHILE YOU TYPE — NOTHING GETS HIJACKED MID-SESSION.
        </p>
        <div className="space-y-2">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between gap-4 border-b border-edge/60 pb-2">
              <span className="border border-edge2 bg-panel px-2 py-1 text-[10px] font-bold tracking-[0.12em] text-ink">
                {key}
              </span>
              <span className="flex-1 text-right text-[10px] tracking-[0.06em] text-dim">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
