import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAuth } from '../hooks/useAuth.js';

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

function AuthModal({ onClose }) {
  const { signIn, signUp } = useAuth();
  const [tab, setTab] = useState('in'); // in | up
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setNote('');
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
      const res = tab === 'in' ? await signIn(email, password) : await signUp(email, password);
      if (res.error) {
        setError(res.error.toUpperCase());
        return;
      }
      if (res.needsConfirm) {
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
              onClick={() => {
                setTab('in');
                setError('');
                setNote('');
              }}
              className={`chip !py-1.5 !text-[9px] ${tab === 'in' ? 'chip-on-cyan' : 'chip-off'}`}
            >
              SIGN IN
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('up');
                setError('');
                setNote('');
              }}
              className={`chip !py-1.5 !text-[9px] ${tab === 'up' ? 'chip-on-cyan' : 'chip-off'}`}
            >
              CREATE ACCOUNT
            </button>
          </div>
          <form onSubmit={submit} className="space-y-2.5">
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
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min 6 characters"
                autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
                className="w-full border border-edge bg-panel2 px-3 py-2 text-[11px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              />
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
        </div>
      </div>
    </div>
  );
}

export default function AuthMenu() {
  const { authAvailable, authUser, signOut } = useAuth();
  const [modal, setModal] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, open, () => setOpen(false));

  if (!authAvailable) return null; // Supabase not configured → no account UI at all

  if (!authUser) {
    return (
      <>
        <button type="button" onClick={() => setModal(true)} className="chip chip-off !px-2.5 !py-1 !text-[10px]">
          ⊕ SIGN IN
        </button>
        {/* portal: a fixed overlay inside the top bar's filtered subtree would
            anchor wrong and render off-screen */}
        {modal ? createPortal(<AuthModal onClose={() => setModal(false)} />, document.body) : null}
      </>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="chip chip-on-cyan max-w-[180px] !px-2.5 !py-1 !text-[10px]"
        title={authUser}
      >
        <span className="mr-1.5">◉</span>
        <span className="truncate">{authUser}</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-64 border border-edge bg-panel p-3 shadow-lg shadow-black/40">
          <div className="hud-label mb-1">SIGNED IN</div>
          <div className="truncate text-[10px] text-ink">{authUser}</div>
          <p className="mt-2 text-[9px] leading-relaxed tracking-[0.06em] text-faint">
            CLOUD SYNC ON — SESSIONS, PBs, HEATMAP AND STREAK ARE SAVED TO THIS ACCOUNT.
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="chip chip-off mt-3 w-full !py-1.5 !text-[9px]"
          >
            SIGN OUT
          </button>
        </div>
      ) : null}
    </div>
  );
}
