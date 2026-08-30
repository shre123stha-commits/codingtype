import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { useGameStore } from '../store/gameStore.js';
import { pushProfile } from '../utils/profileCloud.js';

// One-time (per day) prompt for signed-in users who have no display name yet.
// Without this, an account created before names existed falls back to showing
// the email prefix at the top — which reads as "it's still showing my email".
// Asking once for the name makes item #2 ("name, not email, at the top") work
// for existing accounts without them having to find the PROFILE tab first.
const SKIP_KEY = 'codetype-name-skip';
const SKIP_MS = 24 * 60 * 60 * 1000; // re-offer after a day

function recentlySkipped() {
  try {
    const t = Number(localStorage.getItem(SKIP_KEY) || 0);
    return Boolean(t) && Date.now() - t < SKIP_MS;
  } catch {
    return false;
  }
}

export default function ProfileNamePrompt() {
  const authUser = useGameStore((s) => s.authUser);
  const profileName = useGameStore((s) => s.profileName);
  const profileAvatar = useGameStore((s) => s.profileAvatar);
  const setProfile = useGameStore((s) => s.setProfile);
  const setUiOpen = useGameStore((s) => s.setUiOpen);
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);

  const skip = useCallback(() => {
    try {
      localStorage.setItem(SKIP_KEY, String(Date.now()));
    } catch {
      /* private mode */
    }
    setOpen(false);
  }, []);

  const save = useCallback(
    (e) => {
      if (e) e.preventDefault();
      const n = name.trim();
      if (n.length < 2) return;
      try {
        localStorage.removeItem(SKIP_KEY);
      } catch {
        /* private mode */
      }
      setProfile({ name: n });
      if (authUser) pushProfile(n, profileAvatar); // cloud row picks up the name too
    },
    [name, authUser, profileAvatar, setProfile]
  );

  useEffect(() => {
    const shouldShow = Boolean(authUser) && !profileName && !recentlySkipped();
    setOpen(shouldShow);
    if (shouldShow) {
      setUiOpen(true); // keep the global typing engine off while the field is live
      return () => setUiOpen(false);
    }
    return undefined;
  }, [authUser, profileName, setUiOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') skip();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, skip]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={save}
        className="w-full max-w-sm border border-edge bg-panel shadow-lg shadow-black/50"
        role="dialog"
        aria-label="set your name"
      >
        <header className="flex items-center justify-between border-b border-edge px-4 py-3">
          <span className="hud-label">WHAT'S YOUR NAME?</span>
          <button type="button" onClick={skip} className="text-[10px] tracking-[0.2em] text-dim hover:text-ink" aria-label="skip">
            ✕
          </button>
        </header>
        <div className="p-4">
          <p className="mb-3 text-[10px] leading-relaxed tracking-[0.06em] text-dim">
            SO WE SHOW YOUR NAME — NOT YOUR EMAIL — AT THE TOP OF THE PAGE AND ON YOUR FLASH CARDS.
          </p>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="your name"
            autoComplete="name"
            maxLength={40}
            className="w-full border border-edge bg-panel2 px-3 py-2 text-[12px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <div className="mt-3 flex gap-1.5">
            <button type="button" onClick={skip} className="chip chip-off flex-1 py-2 text-[10px]">
              SKIP FOR NOW
            </button>
            <button type="submit" className="chip chip-on-amber flex-1 py-2 text-[10px]">
              SAVE NAME
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
}
