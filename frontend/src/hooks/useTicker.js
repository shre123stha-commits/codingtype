import { useEffect } from 'react';

import { useGameStore } from '../store/gameStore.js';

export function useTicker(intervalMs = 200) {
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const st = useGameStore.getState();
      st.tick(now);
      st.autoPauseCheck(now);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
