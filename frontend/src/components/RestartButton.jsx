import { useGameStore } from '../store/gameStore.js';

export default function RestartButton() {
  const status = useGameStore((s) => s.status);
  const restart = useGameStore((s) => s.restart);

  if (status !== 'running' && status !== 'paused') return null;

  return (
    <button
      type="button"
      onClick={restart}
      title="Reset timer and progress — re-type this block"
      className="chip chip-off flex items-center gap-1.5"
    >
      <span className="text-[13px] leading-none" aria-hidden>
        ↻
      </span>
      RESTART
    </button>
  );
}
