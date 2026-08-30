// CHANGE — sits next to the STANDBY badge and loads a different target.
//
//   • you picked a category in the DRILL tab → another snippet in that same
//     mode + language, so you keep drilling the thing you chose
//   • you just opened the site and chose nothing → any other snippet
//
// Clickable only at STANDBY and COMPLETE. Mid-run it is visible but disabled,
// so you can never throw away a run in progress by accident.
import { useState } from 'react';

import { useGameStore } from '../store/gameStore.js';

export default function ChangeButton() {
  const status = useGameStore((s) => s.status);
  const drillPicked = useGameStore((s) => s.drillPicked);
  const catalogSource = useGameStore((s) => s.catalogSource);
  const snippet = useGameStore((s) => s.snippet);
  const changeSnippet = useGameStore((s) => s.changeSnippet);
  const [busy, setBusy] = useState(false);

  const enabled = (status === 'idle' || status === 'finished') && catalogSource !== 'loading' && !busy;

  const onClick = async () => {
    if (!enabled) return;
    setBusy(true);
    try {
      await changeSnippet();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      title={
        drillPicked
          ? 'Load a different target in the drill category you picked'
          : 'Load a different target'
      }
      aria-label={
        drillPicked
          ? `Change target — another ${snippet?.mode || 'drill'} snippet`
          : 'Change target — load a different snippet'
      }
      className="chip chip-off flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-35"
    >
      <span className="text-[13px] leading-none" aria-hidden>
        ⇄
      </span>
      {busy ? 'LOADING' : 'CHANGE'}
    </button>
  );
}
