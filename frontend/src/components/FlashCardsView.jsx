import { useEffect, useMemo, useRef, useState } from 'react';

import { useDaily } from '../hooks/useApi.js';
import { useGameStore } from '../store/gameStore.js';
import { api } from '../utils/api.js';
import {
  buildProfile,
  copyCanvasPng,
  copyText,
  downloadCanvas,
  profileShareText,
  renderProfileCard,
  shareOnX
} from '../utils/flashCard.js';

// The 08 · FLASH CARDS deck tab — the standalone profile flash-card feature.
// Renders your career feats onto a 1080x1350 share card (PNG / copy / X).
export default function FlashCardsView() {
  const authUser = useGameStore((s) => s.authUser);
  const theme = useGameStore((s) => s.theme);
  const daily = useDaily();
  const [sessions, setSessions] = useState(null);
  const [profile, setProfile] = useState(null);
  const [card, setCard] = useState(null); // rendered HTMLCanvasElement
  const [copied, setCopied] = useState(null);
  const [busy, setBusy] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    let live = true;
    api
      .sessions(500)
      .then((d) => {
        if (live) setSessions(d.sessions || []);
      })
      .catch(() => {
        if (live) setSessions([]);
      });
    return () => {
      live = false;
    };
  }, []);

  const streak = daily?.streak || 0;

  useEffect(() => {
    if (!sessions) return undefined;
    let live = true;
    setBusy(true);
    const p = buildProfile({ sessions, authUser, streak });
    setProfile(p);
    renderProfileCard(p, theme)
      .then((c) => {
        if (!live) return;
        setCard(c);
        const view = previewRef.current;
        if (view) {
          const ctx = view.getContext('2d');
          ctx.clearRect(0, 0, view.width, view.height);
          ctx.drawImage(c, 0, 0);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [sessions, authUser, streak, theme]);

  const shareText = useMemo(() => (profile ? profileShareText(profile) : ''), [profile]);

  const stamp = () => new Date().toISOString().slice(0, 10);

  const act = async (kind) => {
    if (!card) return;
    setBusy(true);
    try {
      if (kind === 'img') {
        await copyCanvasPng(card);
        setCopied('img');
      } else if (kind === 'text') {
        await copyText(shareText);
        setCopied('text');
      }
      setTimeout(() => setCopied(null), 1600);
    } catch {
      if (kind === 'img') {
        try {
          await downloadCanvas(card, `codetype-profile-${stamp()}.png`);
        } catch {
          /* clipboard blocked */
        }
      }
    } finally {
      setBusy(false);
    }
  };

  if (!sessions) {
    return (
      <div className="py-6 text-center text-[10px] tracking-[0.2em] text-dim">
        SYNCING PROFILE<span className="animate-blink">…</span>
      </div>
    );
  }

  // The CONTROL DECK column is a fixed 300px rail — everything stacks full-width.
  return (
    <div className="space-y-3">
      <div className="border border-edge bg-obsidian/60 p-2">
        <canvas ref={previewRef} width={1080} height={1350} className="h-auto w-full" aria-label="profile flash card preview" />
        {busy ? <span className="sr-only">rendering</span> : null}
      </div>
      <p className="text-[10px] leading-relaxed tracking-[0.08em] text-dim">
        YOUR CAREER FEATS, RENDERED AS A <span className="text-accent">SHARE CARD</span> — ONE PNG FOR X, DISCORD OR LINKEDIN.
      </p>
      <div className="grid grid-cols-1 gap-1.5">
        <button type="button" disabled={!card || busy} onClick={() => card && downloadCanvas(card, `codetype-profile-${stamp()}.png`)} className="chip chip-on-amber whitespace-nowrap py-2 text-[10px] disabled:opacity-40">
          ⤓ DOWNLOAD PNG
        </button>
        <button type="button" disabled={!card || busy} onClick={() => act('img')} className="chip chip-off whitespace-nowrap py-2 text-[10px] disabled:opacity-40">
          {copied === 'img' ? '✓ COPIED' : '⧉ COPY IMAGE'}
        </button>
        <button type="button" onClick={() => shareOnX(shareText)} className="chip chip-on-cyan whitespace-nowrap py-2 text-[10px]">
          𝕏 POST ON X
        </button>
        <button type="button" disabled={!shareText || busy} onClick={() => act('text')} className="chip chip-off whitespace-nowrap py-2 text-[10px] disabled:opacity-40">
          {copied === 'text' ? '✓ COPIED' : '⧉ COPY TEXT'}
        </button>
      </div>
      <div className="space-y-1 border-t border-edge/70 pt-2 text-[9px] leading-relaxed tracking-[0.06em] text-faint">
        <p>• DATA = YOUR LOCAL (OR CLOUD, IF SIGNED IN) SESSIONS — {sessions.length} RUNS COUNTED</p>
        <p>• LEVEL = 1 + FEATS/20 · RANK FROM AVERAGE WPM (S≥90 A≥75 B≥60 C≥45)</p>
        <p>• QR ENCODES A TEXT SNAPSHOT OF YOUR PROFILE — SCAN IT ON ANY PHONE</p>
        <p>• RACE FLASH CARDS + DIRECT RESULT SHARES APPEAR IN THE RACE VIEW AFTER EVERY RACE</p>
      </div>
    </div>
  );
}
