import { useEffect } from 'react';

import { useGameStore } from '../store/gameStore.js';

export function useTicker(intervalMs = 200) {
  useEffect(() => {
    const id = setInterval(() => {
      useGameStore.getState().tick(Date.now());
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
