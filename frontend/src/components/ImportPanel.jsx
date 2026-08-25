import { useState } from 'react';

import { LANGUAGES } from '../data/snippets.js';
import { useGameStore } from '../store/gameStore.js';

function toRawUrl(url) {
  const m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+?)\/(.+)$/);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`;
  if (/^https:\/\/raw\.githubusercontent\.com\//.test(url)) return url;
  return null;
}

export default function ImportPanel() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const loadSnippet = useGameStore((s) => s.loadSnippet);

  const load = async () => {
    setError('');
    let text = code.trim();
    if (!text) {
      setError('PASTE CODE OR A GITHUB FILE URL');
      return;
    }
    if (/^https?:\/\//.test(text)) {
      const raw = toRawUrl(text);
      if (!raw) {
        setError('UNSUPPORTED URL — USE A GITHUB FILE LINK');
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(raw);
        if (!res.ok) throw new Error('fetch failed');
        text = await res.text();
      } catch {
        setError('FETCH FAILED — PASTE THE CODE DIRECTLY');
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    if (text.length > 2500) {
      setError('KEEP IT UNDER 2500 CHARS');
      return;
    }
    if (text.split('\n').length > 80) {
      setError('KEEP IT UNDER 80 LINES');
      return;
    }
    loadSnippet({
      id: `import-${Date.now()}`,
      language,
      mode: 'repo',
      title: 'IMPORTED CODE',
      source: 'import/' + (text.split('\n')[0] || 'paste').slice(0, 32),
      code: text
    });
    setCode('');
  };

  return (
    <div className="space-y-2">
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={3}
        spellCheck={false}
        placeholder={'paste code…\nor a github.com/user/repo/blob/main/file.js link'}
        className="w-full resize-none border border-edge bg-panel2/70 px-2.5 py-2 font-mono text-[11px] text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="border border-edge bg-panel2 px-2 py-1.5 text-[10px] tracking-[0.1em] text-ink focus:border-accent/60 focus:outline-none"
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="chip chip-on-amber flex-1 py-1.5 disabled:opacity-50"
        >
          {busy ? 'FETCHING…' : 'LOAD AS TARGET'}
        </button>
      </div>
      {error ? <p className="text-[9px] tracking-[0.14em] text-blood">{error}</p> : null}
    </div>
  );
}
