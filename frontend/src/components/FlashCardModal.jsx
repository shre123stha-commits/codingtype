import { useEffect, useState } from 'react';

import { createPortal } from 'react-dom';

import { copyCanvasPng, copyText, downloadCanvas, shareOnX } from '../utils/flashCard.js';

// Big-card viewer + share actions. Portaled to document.body because fixed
// elements inside the TopBar's backdrop-blur header render off-screen.
export default function FlashCardModal({ open, title, canvas, text, onClose }) {
  const [imgUrl, setImgUrl] = useState('');
  const [copied, setCopied] = useState(null); // 'img' | 'text'
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && canvas) {
      setImgUrl(canvas.toDataURL('image/png'));
      setCopied(null);
    }
  }, [open, canvas]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !canvas) return null;

  const stamp = () => new Date().toISOString().slice(0, 10);

  const act = async (kind) => {
    setBusy(true);
    try {
      if (kind === 'img') {
        await copyCanvasPng(canvas);
        setCopied('img');
      } else if (kind === 'text') {
        await copyText(text || '');
        setCopied('text');
      }
      setTimeout(() => setCopied(null), 1600);
    } catch {
      if (kind === 'img') {
        // clipboard blocked (non-secure context) — fall back to download
        try {
          await downloadCanvas(canvas, `codetype-${title || 'card'}-${stamp()}.png`);
        } catch {
          /* give up quietly */
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-label={`share card ${title || ''}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-[430px] flex-col border border-edge bg-panel shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <div>
            <div className="hud-label">SHARE CARD</div>
            <div className="mt-0.5 text-[12px] font-bold tracking-[0.16em] text-accent">{title || 'CARD'}</div>
          </div>
          <button type="button" onClick={onClose} className="chip chip-off !px-2 !py-1" aria-label="close card">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-obsidian/60 p-4">
          {imgUrl ? <img src={imgUrl} alt={title || 'flash card'} decoding="async" className="mx-auto w-full max-w-[340px]" /> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-edge p-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => downloadCanvas(canvas, `codetype-${(title || 'card').toLowerCase().replace(/\s+/g, '-')}-${stamp()}.png`)}
            className="chip chip-on-amber py-2 disabled:opacity-50"
          >
            ⤓ DOWNLOAD PNG
          </button>
          <button type="button" disabled={busy} onClick={() => act('img')} className="chip chip-off py-2 disabled:opacity-50">
            {copied === 'img' ? '✓ COPIED' : '⧉ COPY IMAGE'}
          </button>
          <button type="button" onClick={() => shareOnX(text || 'I just used CodeType — the touch-typing trainer for devs.')} className="chip chip-on-cyan py-2">
            𝕏 POST ON X
          </button>
          <button type="button" disabled={busy} onClick={() => act('text')} className="chip chip-off py-2 disabled:opacity-50">
            {copied === 'text' ? '✓ COPIED' : '⧉ COPY TEXT'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
