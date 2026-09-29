import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAuth } from '../hooks/useAuth.js';
import { useGameStore } from '../store/gameStore.js';
import { displayName } from '../utils/profileCloud.js';
import CodeTypeMark, { ProviderIcon } from './CodeTypeMark.jsx';
import {
  ArrowRightIcon,
  ChevronIcon,
  EyeIcon,
  EyeOffIcon,
  LogOutIcon,
  UserIcon,
  XIcon
} from './Icons.jsx';

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

function AvatarInitials({ name, className = '' }) {
  const initials = (name.trim().slice(0, 2) || 'CT').toUpperCase();
  return <span className={`auth-avatar-initials ${className}`}>{initials}</span>;
}

function AuthModal({ initialTab = 'in', onClose }) {
  const { signIn, signUp, signInWithProvider } = useAuth();
  const setUiOpen = useGameStore((s) => s.setUiOpen);
  const setProfile = useGameStore((s) => s.setProfile);
  const savedName = useGameStore((s) => s.profileName);
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState(savedName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [providerBusy, setProviderBusy] = useState('');
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

  const oauth = async (provider) => {
    if (busy || providerBusy) return;
    setError('');
    setNote('');
    setProviderBusy(provider);
    const res = await signInWithProvider(provider);
    if (res?.error) {
      setError(res.error.toUpperCase());
      setProviderBusy('');
    }
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
    <div className="auth-overlay" onClick={onClose}>
      <div
        className="auth-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="account"
      >
        <div className="auth-card-hero">
          <div className="mb-3 flex items-center justify-between">
            <CodeTypeMark compact className="auth-card-brand" />
            <button type="button" onClick={onClose} className="auth-close" aria-label="close">
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <h2 className="auth-card-title">{tab === 'in' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="auth-card-sub">
            {tab === 'in'
              ? 'Sign in to sync sessions, PBs, heatmap and your daily streak.'
              : 'One account for cloud sync, streaks and the global daily leaderboard.'}
          </p>
        </div>

        <div className="px-5 pb-5 pt-4">
          <div className="auth-tabs" role="tablist" aria-label="sign in or create account">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'in'}
              onClick={() => switchTab('in')}
              className={`auth-tab ${tab === 'in' ? 'auth-tab-active' : ''}`}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'up'}
              onClick={() => switchTab('up')}
              className={`auth-tab ${tab === 'up' ? 'auth-tab-active' : ''}`}
            >
              Create account
            </button>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2">
            {[
              ['google', 'Google'],
              ['facebook', 'Meta'],
              ['x', 'X']
            ].map(([provider, label]) => (
              <button
                key={provider}
                type="button"
                onClick={() => oauth(provider)}
                disabled={busy || Boolean(providerBusy)}
                className="provider-button"
              >
                <ProviderIcon provider={provider} />
                <span>{providerBusy === provider ? '…' : label}</span>
              </button>
            ))}
          </div>

          <div className="auth-divider">
            <span>OR CONTINUE WITH EMAIL</span>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="auth-label" htmlFor="auth-name">
                {tab === 'up' ? 'Name' : 'Name · optional'}
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tab === 'up' ? 'Your name' : 'Keep your current name'}
                autoComplete="name"
                maxLength={40}
                className="auth-input"
              />
            </div>
            <div>
              <label className="auth-label" htmlFor="auth-email">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="auth-input"
              />
            </div>
            <div>
              <label className="auth-label" htmlFor="auth-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  autoComplete={tab === 'in' ? 'current-password' : 'new-password'}
                  className="auth-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'hide password' : 'show password'}
                  title={showPw ? 'Hide password' : 'Show password'}
                  className="auth-eye"
                >
                  {showPw ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error ? <p className="auth-error">{error}</p> : null}
            {note ? <p className="auth-note">{note}</p> : null}
            <button type="submit" disabled={busy} className="auth-submit">
              <span>{busy ? 'WORKING…' : tab === 'in' ? 'SIGN IN' : 'CREATE ACCOUNT'}</span>
              {busy ? null : <ArrowRightIcon className="h-3.5 w-3.5" />}
            </button>
          </form>

          <p className="mt-4 border-t border-edge/70 pt-3.5 text-[9px] leading-relaxed tracking-[0.06em] text-faint">
            NO ACCOUNT NEEDED — GUEST DATA STAYS ON THIS DEVICE. SIGN IN TO KEEP YOUR SESSIONS, PBs, HEATMAP AND
            DAILY STREAK IN THE CLOUD AND RACE THE GLOBAL DAILY LEADERBOARD. SOCIAL SIGN-IN REQUIRES THE PROVIDER
            TO BE ENABLED IN SUPABASE AUTH SETTINGS.
          </p>
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

  // ---- signed OUT: gradient pill opens a dropdown with SIGN IN / CREATE ACCOUNT ----
  if (!authUser) {
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="signin-trigger"
        >
          <UserIcon className="h-3.5 w-3.5" />
          <span>SIGN IN</span>
          <ChevronIcon className="h-3 w-3 opacity-70" up={open} />
        </button>
        {open ? (
          <div role="menu" aria-label="account" className="auth-menu w-56">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setModal('in');
              }}
              className="auth-menu-item"
            >
              <ArrowRightIcon className="h-3.5 w-3.5 text-accent" />
              <span>
                <span className="auth-menu-item-title">Sign in</span>
                <span className="auth-menu-item-sub">sync your stats across devices</span>
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setModal('up');
              }}
              className="auth-menu-item"
            >
              <UserIcon className="h-3.5 w-3.5 text-pulse" />
              <span>
                <span className="auth-menu-item-title">Create account</span>
                <span className="auth-menu-item-sub">join the global daily leaderboard</span>
              </span>
            </button>
            <p className="border-t border-edge/70 px-3 pb-1.5 pt-2.5 text-[8px] leading-relaxed tracking-[0.06em] text-faint">
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
        className="signin-trigger signin-trigger-on flex max-w-[190px]"
        title={authUser}
      >
        {profileAvatar ? (
          <img src={profileAvatar} alt="" decoding="async" className="h-[18px] w-[18px] shrink-0 rounded-full border border-edge object-cover" />
        ) : (
          <AvatarInitials name={name} className="h-[18px] w-[18px] text-[8px]" />
        )}
        <span className="truncate">{name}</span>
        <ChevronIcon className="h-3 w-3 opacity-70" up={open} />
      </button>
      {open ? (
        <div role="menu" aria-label="account menu" className="auth-menu w-64">
          <div className="flex items-center gap-2.5 px-1 py-1">
            {profileAvatar ? (
              <img src={profileAvatar} alt="" decoding="async" className="h-10 w-10 shrink-0 rounded-full border border-accent/60 object-cover" />
            ) : (
              <AvatarInitials name={name} className="h-10 w-10 text-[13px]" />
            )}
            <div className="min-w-0">
              <div className="mb-0.5 inline-flex items-center gap-1.5 text-[8px] font-bold tracking-[0.2em] text-good">
                <span className="h-1 w-1 rounded-full bg-good" />
                SIGNED IN
              </div>
              <div className="truncate text-[12px] font-bold tracking-[0.04em] text-ink">{name}</div>
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
              className="auth-menu-cta auth-menu-cta-primary"
            >
              <UserIcon className="h-3.5 w-3.5" />
              VIEW PROFILE
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="auth-menu-cta auth-menu-cta-danger"
            >
              <LogOutIcon className="h-3.5 w-3.5" />
              SIGN OUT
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
