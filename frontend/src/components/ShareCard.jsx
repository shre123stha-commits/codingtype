import { useState } from 'react';

import { renderShareCard } from '../utils/shareCard.js';

export default function ShareCard({ run, theme }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      return await renderShareCard(run, theme);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    const url = await generate();
    const a = document.createElement('a');
    a.href = url;
    a.download = `codetype-${run.stats.wpm}wpm-${(run.mode || 'run').replace(/\W+/g, '-')}.png`;
    a.click();
  };

  const copy = async () => {
    const url = await generate();
    try {
      const blob = await (await fetch(url)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      await download();
    }
  };

  return (
    <div className="flex gap-2">
      <button type="button" onClick={download} disabled={busy} className="chip chip-off py-2 disabled:opacity-50">
        ⤓ SHARE PNG
      </button>
      <button type="button" onClick={copy} disabled={busy} className="chip chip-off py-2 disabled:opacity-50">
        {copied ? '✓ COPIED' : '⧉ COPY IMG'}
      </button>
    </div>
  );
}
