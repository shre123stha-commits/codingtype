import { useEffect, useState } from 'react';

// The advertisement lives in the right-hand rail provided by SitePage.
import { navigate } from '../hooks/useSiteRoute.js';
import { apiUrl } from '../utils/env.js';
import { track } from '../utils/analytics.js';
import SitePage from './SitePage.jsx';

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [already, setAlready] = useState(false);
  const [error, setError] = useState('');
  const [count, setCount] = useState(null);

  useEffect(() => {
    fetch(apiUrl('/api/waitlist'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setCount(j.count))
      .catch(() => {});
  }, [done]);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('VALID EMAIL REQUIRED');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/waitlist'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const j = res.ok ? await res.json() : null;
      if (!j || !j.ok) throw new Error('no');
      setDone(true);
      setAlready(Boolean(j.already));
      setCount(j.count);
      track('waitlist_joined', { already: j.already });
    } catch {
      setError('COULD NOT REACH THE SERVER — TRY AGAIN');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SitePage
      path="/waitlist"
      title="Waitlist — CodeType"
      description="New features ship quietly. Join the waitlist and get one email when something new lands — no newsletters, no spam."
    >
      <p className="mb-6 text-[11px] leading-relaxed tracking-[0.04em] text-dim">
        Every release adds something you can feel — new blind modes, new languages, better telemetry. Join the list and
        you get <span className="text-ink">one short email per feature</span>, nothing else. Leave whenever you like.
      </p>

      {done ? (
        <div className="mb-8 max-w-[520px] border border-good/40 bg-good/10 p-4">
          <div className="mb-1 text-[11px] font-bold tracking-[0.18em] text-good">
            {already ? 'YOU ARE ALREADY ON THE LIST' : "YOU'RE ON THE LIST"}
          </div>
          <p className="text-[10px] leading-relaxed tracking-[0.06em] text-dim">
            One email per feature, and that's it.
            {typeof count === 'number' ? ` ${count} OPERATORS IN TOTAL.` : ''}
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mb-8 max-w-[520px]">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="flex-1 border border-edge bg-panel2 px-3 py-2.5 text-[11px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
            />
            <button type="submit" disabled={busy} className="chip chip-on-amber !px-6 !py-2.5 !text-[10px] disabled:opacity-40">
              {busy ? '…' : 'JOIN WAITLIST'}
            </button>
          </div>
          {error ? (
            <p className="mt-2 text-[10px] font-bold tracking-[0.14em] text-blood">{error}</p>
          ) : null}
          {typeof count === 'number' ? (
            <p className="mt-2 text-[9px] tracking-[0.12em] text-faint">{count} OPERATORS ALREADY ON THE LIST</p>
          ) : null}
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="chip chip-off !px-4 !py-2 !text-[10px]" onClick={() => navigate('/about')}>
          WHAT IS CODETYPE?
        </button>
        <button type="button" className="chip chip-off !px-4 !py-2 !text-[10px]" onClick={() => navigate('/faq')}>
          FAQ
        </button>
        <button type="button" className="chip chip-on-cyan !px-4 !py-2 !text-[10px]" onClick={() => navigate('/')}>
          ← START TYPING NOW
        </button>
      </div>
    </SitePage>
  );
}
