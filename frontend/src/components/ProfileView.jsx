import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../hooks/useAuth.js';
import { useGameStore } from '../store/gameStore.js';
import { api } from '../utils/api.js';
import { displayName, pushProfile } from '../utils/profileCloud.js';
import { fileToAvatar } from '../utils/avatar.js';

const LANG_LABELS = { python: 'PYTHON', javascript: 'JAVASCRIPT', java: 'JAVA', 'c++': 'C++', rust: 'RUST', sql: 'SQL' };

function Cell({ label, value, accent = false, sub = '' }) {
  return (
    <div className="border border-edge bg-obsidian/60 px-3 py-2.5">
      <div className="hud-label mb-1">{label}</div>
      <div className={`text-xl font-bold tracking-[0.04em] ${accent ? 'text-accent' : 'text-ink'}`}>{value}</div>
      {sub ? <div className="mt-0.5 truncate text-[8px] tracking-[0.08em] text-faint">{sub}</div> : null}
    </div>
  );
}

function fmtTime(sec) {
  sec = Math.round(sec || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}H ${m}M`;
  if (m) return `${m}M ${s}S`;
  return `${s}S`;
}

export default function ProfileView() {
  const authUser = useGameStore((s) => s.authUser);
  const { authAvailable } = useAuth();
  const profileName = useGameStore((s) => s.profileName);
  const profileAvatar = useGameStore((s) => s.profileAvatar);
  const setProfile = useGameStore((s) => s.setProfile);

  const [nameDraft, setNameDraft] = useState(profileName || '');
  const [note, setNote] = useState(null); // { kind: 'ok' | 'err', text }
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef(null);

  const [sessions, setSessions] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pbests, setPbests] = useState(null);
  const [streak, setStreak] = useState(0);

  // keep the draft in sync when the profile changes elsewhere (cloud sync, sign-in)
  useEffect(() => {
    setNameDraft(profileName || '');
  }, [profileName]);

  useEffect(() => {
    let live = true;
    api
      .sessions(500)
      .then((d) => live && setSessions(d.sessions || []))
      .catch(() => live && setSessions([]));
    api
      .summary()
      .then((d) => live && setSummary(d))
      .catch(() => live && setSummary(null));
    api
      .pbests()
      .then((d) => live && setPbests(d.pbests || []))
      .catch(() => live && setPbests([]));
    api
      .daily()
      .then((d) => live && setStreak(d.streak || 0))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const totalChars = useMemo(() => (sessions || []).reduce((n, s) => n + (Number(s.chars) || 0), 0), [sessions]);
  const totalSec = useMemo(() => (sessions || []).reduce((n, s) => n + (Number(s.timeSec) || 0), 0), [sessions]);
  const bestWpm = useMemo(() => (sessions || []).reduce((m, s) => Math.max(m, Number(s.wpm) || 0), 0), [sessions]);
  const avgAcc = useMemo(() => {
    if (!sessions || !sessions.length) return 0;
    return Math.round((sessions.reduce((n, s) => n + (Number(s.accuracy) || 0), 0) / sessions.length) * 10) / 10;
  }, [sessions]);
  const byLanguage = useMemo(() => {
    const m = new Map();
    for (const s of sessions || []) {
      const cur = m.get(s.language) || { runs: 0, wpm: 0, chars: 0 };
      cur.runs += 1;
      cur.wpm += Number(s.wpm) || 0;
      cur.chars += Number(s.chars) || 0;
      m.set(s.language, cur);
    }
    return [...m.entries()]
      .map(([lang, v]) => ({ lang, runs: v.runs, avgWpm: Math.round(v.wpm / v.runs), chars: v.chars }))
      .sort((a, b) => b.runs - a.runs);
  }, [sessions]);

  const flash = (kind, text, ms = 2200) => {
    setNote({ kind, text });
    setTimeout(() => setNote(null), ms);
  };

  const saveName = async (e) => {
    e.preventDefault();
    const n = nameDraft.trim();
    if (n.length < 2) {
      flash('err', 'NAME NEEDS AT LEAST 2 CHARACTERS');
      return;
    }
    setProfile({ name: n });
    if (authUser) pushProfile(n, profileAvatar);
    flash('ok', '✓ NAME SAVED' + (authUser ? ' — SYNCED TO CLOUD' : ' — ON THIS DEVICE'));
  };

  const pickAvatar = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      const dataUrl = await fileToAvatar(file);
      setProfile({ avatar: dataUrl });
      if (authUser) pushProfile(profileName, dataUrl);
      flash('ok', '✓ PHOTO SAVED — NOW ON YOUR TOP BAR AND FLASH CARDS', 3000);
    } catch {
      flash('err', 'COULD NOT READ THAT IMAGE — TRY A JPG OR PNG (MAX 8MB)');
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = () => {
    setProfile({ avatar: null });
    if (authUser) pushProfile(profileName, null);
    flash('ok', '✓ PHOTO REMOVED');
  };

  const name = displayName(profileName, authUser);

  return (
    <div className="mx-auto max-w-6xl px-5 py-4" aria-label="profile">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[340px_1fr]">
        {/* ------------------------------------------------ IDENTITY */}
        <section className="border border-edge bg-panel p-4" aria-label="identity">
          <div className="hud-label mb-3">IDENTITY</div>
          <div className="flex items-start gap-4">
            {profileAvatar ? (
              <img src={profileAvatar} alt="profile photo" className="h-24 w-24 shrink-0 rounded-full border-2 border-accent object-cover" />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-panel2 text-2xl font-bold text-accent">
                {(name.slice(0, 2) || 'CT').toUpperCase()}
              </div>
            )}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => fileRef.current && fileRef.current.click()}
                disabled={avatarBusy}
                className="chip chip-on-cyan !py-1.5 !text-[9px] disabled:opacity-40"
              >
                {avatarBusy ? '…' : '⤴ SET PROFILE PHOTO'}
              </button>
              {profileAvatar ? (
                <button type="button" onClick={removeAvatar} className="chip chip-off !py-1.5 !text-[9px]">
                  ✕ REMOVE PHOTO
                </button>
              ) : null}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} aria-label="profile photo file" />
              <p className="text-[8px] leading-relaxed tracking-[0.06em] text-faint">
                ANY JPG OR PNG YOU LIKE — CROPPED TO A SQUARE, SHOWN IN THE TOP BAR, THE DROPDOWN AND ON YOUR FLASH CARDS
              </p>
            </div>
          </div>

          <form onSubmit={saveName} className="mt-4 space-y-2">
            <div className="hud-label">NAME</div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="your name"
                autoComplete="off"
                maxLength={40}
                className="w-full border border-edge bg-panel2 px-3 py-2 text-[11px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              />
              <button type="submit" className="chip chip-on-amber !py-2 !text-[9px]">
                SAVE
              </button>
            </div>
          </form>

          {note ? (
            <p className={`mt-2 text-[9px] tracking-[0.08em] ${note.kind === 'ok' ? 'text-pulse' : 'text-blood'}`}>{note.text}</p>
          ) : null}

          <dl className="mt-4 space-y-2 border-t border-edge pt-3 text-[10px]">
            <div className="flex justify-between gap-3">
              <dt className="hud-label">EMAIL</dt>
              <dd className="truncate text-ink">{authUser || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="hud-label">ACCOUNT</dt>
              <dd>
                {authUser ? (
                  <span className="text-pulse">SIGNED IN — CLOUD SYNC ON</span>
                ) : (
                  <span className="text-dim">GUEST — DATA ON THIS DEVICE</span>
                )}
              </dd>
            </div>
            {!authUser && authAvailable ? (
              <p className="text-[8px] leading-relaxed tracking-[0.06em] text-faint">
                SIGN IN FROM THE TOP BAR TO KEEP THIS PROFILE + ALL TYPING DATA IN THE CLOUD.
              </p>
            ) : null}
          </dl>
        </section>

        {/* ------------------------------------------------ CAREER */}
        <div className="space-y-3">
          <section className="border border-edge bg-panel p-4" aria-label="career">
            <div className="hud-label mb-3">CAREER — EVERYTHING YOU'VE TYPED</div>
            {sessions === null || summary === null ? (
              <p className="py-4 text-center text-[10px] tracking-[0.2em] text-dim">
                SYNCING TYPING DATA<span className="animate-blink">…</span>
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Cell label="TOTAL RUNS" value={sessions.length} />
                <Cell label="AVG WPM" value={summary.avgWpm} accent />
                <Cell label="BEST WPM" value={bestWpm} accent />
                <Cell label="ACCURACY" value={`${avgAcc}%`} />
                <Cell label="CHARS TYPED" value={totalChars.toLocaleString()} />
                <Cell label="TIME TYPED" value={fmtTime(totalSec)} />
                <Cell label="DAILY STREAK" value={`${streak} ${streak === 1 ? 'DAY' : 'DAYS'}`} accent />
                <Cell label="TOTAL ERRORS" value={summary.totalErrors} />
              </div>
            )}
          </section>

          <section className="border border-edge bg-panel p-4" aria-label="by language">
            <div className="hud-label mb-3">BY LANGUAGE</div>
            {!byLanguage.length ? (
              <p className="text-[10px] tracking-[0.14em] text-faint">NO RUNS YET — GO TYPE SOMETHING IN TRAIN</p>
            ) : (
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="border-b border-edge text-left">
                    <th className="hud-label pb-1.5 pr-2">LANGUAGE</th>
                    <th className="hud-label pb-1.5 pr-2">RUNS</th>
                    <th className="hud-label pb-1.5 pr-2">AVG WPM</th>
                    <th className="hud-label pb-1.5">CHARS</th>
                  </tr>
                </thead>
                <tbody>
                  {byLanguage.map((l) => (
                    <tr key={l.lang} className="border-b border-edge/50 last:border-b-0">
                      <td className="py-1.5 pr-2 font-semibold tracking-[0.12em] text-ink">{LANG_LABELS[l.lang] || String(l.lang).toUpperCase()}</td>
                      <td className="py-1.5 pr-2 text-dim">{l.runs}</td>
                      <td className="py-1.5 pr-2 text-accent">{l.avgWpm}</td>
                      <td className="py-1.5 text-dim">{l.chars.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="border border-edge bg-panel p-4" aria-label="personal bests">
            <div className="hud-label mb-3">PERSONAL BESTS</div>
            {pbests === null ? (
              <p className="text-[10px] tracking-[0.2em] text-dim">
                SYNCING<span className="animate-blink">…</span>
              </p>
            ) : !pbests.length ? (
              <p className="text-[10px] tracking-[0.14em] text-faint">FINISH A RUN IN TRAIN TO SET YOUR FIRST PB</p>
            ) : (
              <ol className="space-y-1.5">
                {pbests.slice(0, 6).map((b, i) => (
                  <li key={`${b.mode}|${b.language}|${b.snippetTitle}`} className="flex items-center gap-2 border border-edge/60 bg-obsidian/50 px-2.5 py-1.5 text-[10px]">
                    <span className="w-5 shrink-0 font-bold text-accent">{i + 1}.</span>
                    <span className="shrink-0 tracking-[0.1em] text-dim">
                      {String(b.mode).toUpperCase()} · {String(b.language).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-ink" title={b.snippetTitle}>
                      {b.snippetTitle || 'UNTITLED'}
                    </span>
                    <span className="shrink-0 font-bold text-pulse">{b.wpm} WPM</span>
                    <span className="shrink-0 text-faint">{Number(b.accuracy || 0).toFixed(1)}%</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
