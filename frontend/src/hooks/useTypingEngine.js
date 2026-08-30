import { useEffect, useRef } from 'react';

import { useGameStore } from '../store/gameStore.js';

const CONTROL_KEYS = new Set(['Tab', 'Enter', 'Backspace', 'Escape']);

// Keystrokes aimed at form fields (auth email/password, race code, import
// box) belong to the form — they must never reach the typing engine, or the
// test starts while the user is signing in.
const isFormField = (t) =>
  !!t &&
  (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

export function useTypingEngine() {
  const captureRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (isFormField(e.target) && e.target !== captureRef.current) return;
      const state = useGameStore.getState();
      if (!state.snippet || state.uiOpen) return;

      const key = e.key;
      const printable =
        key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      const controlled = CONTROL_KEYS.has(key);
      if (!printable && !controlled) return;

      e.preventDefault();

      if (state.status === 'finished') {
        if (key === 'Enter') state.restart();
        return;
      }

      state.handleKey(key, Date.now());
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  useEffect(() => {
    const focusCapture = () => {
      const el = captureRef.current;
      if (el && document.activeElement !== el) {
        el.focus({ preventScroll: true });
      }
    };
    window.addEventListener('pointerdown', focusCapture);
    return () => window.removeEventListener('pointerdown', focusCapture);
  }, []);

  return captureRef;
}
