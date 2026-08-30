import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAuth } from '../hooks/useAuth.js';
import { useGameStore } from '../store/gameStore.js';
import { displayName } from '../utils/profileCloud.js';

function useClickOutside(ref, active, onOutside) {
  useEffect(() => {
    if (!active) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [ref, active, onOutside]);
}

function AuthModal({ initialTab = 'in', onClose }) {
  const { signIn, signUp } = useAuth();
  const setUiOpen = useGameStore((s) => s.setUiOpen);
  const setProfile = useGameStore((s) => s.setProfile);
  const savedName = useGameStore((s) => s.profileName);
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState(savedName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  // While the form is up, the global typing engine must stay off —
  // otherwise the email field "types the code test" instead of the email.
  useEffect(() => {
    setUiOpen(true);
    return () => setUiOpen(false);
  }, [setUiOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const switchTab = (t) => {
    setTab(t);
    setError('');
    setNote('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setNote('');
    const n = name.trim();
    if (tab === 'up' && n.length < 2) {
      setError('ENTER YOUR NAME (MIN 2 CHARACTERS)');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('ENTER A VALID EMAIL');
      return;
    }
    if (password.length < 6) {
      setError('PASSWORD MUST BE AT LEAST 6 CHARACTERS');
      return;
    }
    setBusy(true);
    try {
      const res = tab === 'in' ? await signIn(email, password, n) : await signUp(email, password, n);
      if (res.error) {
        setError(res.error.toUpperCase());
        return;
      }
      if (res.needsConfirm) {
        if (n) setProfile({ name: n });
        setNote('ACCOUNT CREATED — CHECK YOUR INBOX TO CONFIRM, THEN SIGN IN.');
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm border border-edge bg-panel shadow-lg shadow-black/50"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="account"
      >
        <header className="flex items-center justify-between border-b border-edge px-4 py-3">
          <span className="hud-label">OPERATOR ACCOUNT</span>
          <button type="button" onClick={onClose} className="text-[10px] tracking-[0.2em] text-dim hover:text-ink" aria-label="close">
            ✕
          </button>
        </header>
        <div className="p-4">
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => switchTab('in')}
              className={`chip !py-1.5 !text-[9px] ${tab === 'in' ? 'chip-on-cyan' : 'chip-off'}`}
            >
              SIGN IN
            </button>
            <button
              type="button"
              onClick={() => switchTab('up')}
              className={`chip !py-1.5 !text-[9px] ${tab === 'up' ? 'chip-on-cyan' : 'chip-off'}`}
            >
              CREATE ACCOUNT
            </button>
          </div>
          <form onSubmit={submit} className="space-y-2.5">
            <div>
              <div className="hud-label mb-1.5">{tab === 'up' ? 'NAME' : 'NAME (OPTIONAL)'}</div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tab === 'up' ? 'your name' : 'leave blank to keep your current name'}
                autoComplete="name"
                maxLength={40}
                className="w-full border border-edge bg-panel2 px-3 py-2 text-[11px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <div className="hud-label mb-1.5">EMAIL</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full border border-edge bg-panel2 px-3 py-2 text-[11px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <div className="hud-label mb-1.5">PASSWORD</div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="min 6 characters"
                  autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
                  className="w-full border border-edge bg-panel2 px-3 py-2 pr-9 text-[11px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'hide password' : 'show password'}
                  title={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[13px] leading-none text-faint transition-colors hover:text-accent"
                >
                  {showPw ? '◉' : '◎'}
                </button>
              </div>
            </div>
            {error ? (
              <p className="border border-blood/50 bg-blood/10 px-3 py-2 text-center text-[10px] font-bold tracking-[0.14em] text-blood">{error}</p>
            ) : null}
            {note ? <p className="px-1 text-[9px] leading-relaxed tracking-[0.1em] text-accent">{note}</p> : null}
            <button type="submit" disabled={busy} className="chip chip-on-amber w-full py-2 text-[10px] disabled:opacity-40">
              {busy ? '…' : tab === 'in' ? '⊕ SIGN IN' : '⊕ CREATE ACCOUNT'}
            </button>
          </form>
          <p className="mt-3 border-t border-edge pt-3 text-[9px] leading-relaxed tracking-[0.06em] text-faint">
            NO ACCOUNT NEEDED — GUEST DATA STAYS ON THIS DEVICE. SIGN IN TO KEEP YOUR SESSIONS, PBs, HEATMAP AND DAILY
            STREAK IN THE CLOUD AND RACE THE GLOBAL DAILY LEADERBOARD.
          </p>
          <p className="mt-2 text-[9px] tracking-[0.08em] text-faint">EMAIL + PASSWORD ONLY — NO GOOGLE / GITHUB / FACEBOOK OPTIONS.</p>
        </div>
      </div>
    </div>
  );
}

export default function AuthMenu() {
  const { authAvailable, authUser, signOut } = useAuth();
  const profileName = useGameStore((s) => s.profileName);
  const profileAvatar = useGameStore((s) => s.profileAvatar);
  const setView = useGameStore((s) => s.setView);
  const [modal, setModal] = useState(false); // 'in' | 'up'
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!authAvailable) return null; // Supabase not configured → no account UI at all

  // ---- signed OUT: chip opens a dropdown with SIGN IN / CREATE ACCOUNT ----
  if (!authUser) {
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="chip chip-off !px-2.5 !py-1 !text-[10px]"
        >
          ⊕ SIGN IN
          <span className="ml-1.5 text-[8px]">{open ? '▲' : '▼'}</span>
        </button>
        {open ? (
          <div
            role="menu"
            aria-label="account"
            className="absolute right-0 top-[calc(100%+6px)] z-30 w-52 border border-edge bg-panel p-1.5 shadow-lg shadow-black/40"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setModal('in');
              }}
              className="flex w-full items-center px-2.5 py-2 text-left text-[10px] font-semibold tracking-[0.14em] text-ink hover:bg-accent/10 hover:text-accent"
            >
              → SIGN IN
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setModal('up');
              }}
              className="flex w-full items-center px-2.5 py-2 text-left text-[10px] font-semibold tracking-[0.14em] text-ink hover:bg-accent/10 hover:text-accent"
            >
              → CREATE ACCOUNT
            </button>
            <p className="border-t border-edge px-2.5 pb-1 pt-1.5 text-[8px] leading-relaxed tracking-[0.06em] text-faint">
              GUEST MODE WORKS WITHOUT AN ACCOUNT — YOUR DATA STAYS ON THIS DEVICE.
            </p>
          </div>
        ) : null}
        {/* portal: a fixed overlay inside the top bar's filtered subtree would
            anchor wrong and render off-screen */}
        {modal ? createPortal(<AuthModal initialTab={modal} onClose={() => setModal(false)} />, document.body) : null}
      </div>
    );
  }

  // ---- signed IN: pill shows the NAME (not the email) + avatar;
  //      dropdown = profile header + PROFILE + SIGN OUT ----
  const name = displayName(profileName, authUser);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="chip chip-on-cyan flex max-w-[190px] items-center !px-2.5 !py-1 !text-[10px]"
        title={authUser}
      >
        {profileAvatar ? (
          <img src={profileAvatar} alt="" decoding="async" className="mr-1.5 h-4 w-4 shrink-0 rounded-full border border-edge object-cover" />
        ) : (
          <span className="mr-1.5">◉</span>
        )}
        <span className="truncate">{name}</span>
        <span className="ml-1.5 text-[8px]">{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="account menu"
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-64 border border-edge bg-panel p-3 shadow-lg shadow-black/40"
        >
          <div className="flex items-center gap-2.5">
            {profileAvatar ? (
              <img src={profileAvatar} alt="" decoding="async" className="h-10 w-10 shrink-0 rounded-full border border-accent object-cover" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent bg-panel2 text-[13px] font-bold text-accent">
                {(name.slice(0, 2) || 'CT').toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="hud-label mb-0.5">SIGNED IN</div>
              <div className="truncate text-[11px] font-bold tracking-[0.08em] text-ink">{name}</div>
              <div className="truncate text-[9px] tracking-[0.04em] text-faint">{authUser}</div>
            </div>
          </div>
          <p className="mt-2 text-[9px] leading-relaxed tracking-[0.06em] text-faint">
            CLOUD SYNC ON — SESSIONS, PBs, HEATMAP AND STREAK ARE SAVED TO THIS ACCOUNT.
          </p>
          <div className="mt-3 space-y-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setView('profile');
              }}
              className="chip chip-on-cyan w-full !py-1.5 !text-[9px]"
            >
              ▤ PROFILE
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="chip chip-off w-full !py-1.5 !text-[9px]"
            >
              SIGN OUT
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
