// "Congratulations!! you have made it to the leaderboards!!!"
//
// Shown for exactly 5 seconds when a finished run lands in a top 10, then
// closes itself. Has a close button too, and re-arms cleanly if you place
// again while one is already on screen (the timer restarts).
import { useEffect, useRef } from 'react';

import { BOARD_LABELS, CATEGORY_LABELS } from '../utils/leaderboardMeta.js';

const DURATION_MS = 5000;

export default function LeaderboardToast({ placement, onClose }) {
  const timer = useRef(null);

  useEffect(() => {
    if (!placement) return undefined;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      onClose();
    }, DURATION_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [placement, onClose]);

  if (!placement) return null;

  const category = CATEGORY_LABELS[placement.category] || String(placement.category).toUpperCase();
  const board = BOARD_LABELS[placement.board] || placement.board;
  const rank = placement.rank;
  const suffix = rank === 1 ? 'ST' : rank === 2 ? 'ND' : rank === 3 ? 'RD' : 'TH';

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed bottom-6 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 border border-good/50 bg-panel px-4 py-3 shadow-glow-green"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-[18px] leading-none text-good" aria-hidden>
          🏆
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold tracking-[0.14em] text-good">
            CONGRATULATIONS!! YOU HAVE MADE IT TO THE LEADERBOARDS!!!
          </div>
          <div className="mt-1 text-[10px] leading-relaxed tracking-[0.1em] text-dim">
            {category} · {board} — RANK #{rank}
            {suffix}
          </div>
          <div className="mt-1.5 h-0.5 w-full bg-edge/60">
            {/* visual countdown so the auto-close is never a surprise */}
            <div className="toast-countdown h-full bg-good/70" />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss leaderboard notification"
          className="shrink-0 border border-edge px-2 py-1 text-[10px] tracking-[0.14em] text-faint hover:border-good/50 hover:text-good"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
