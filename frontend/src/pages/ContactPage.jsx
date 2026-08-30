import { useState } from 'react';

import { navigate } from '../hooks/useSiteRoute.js';
import { track } from '../utils/analytics.js';
import { CONTACT_EMAIL } from '../utils/siteConfig.js';
import SitePage from './SitePage.jsx';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const send = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(`CodeType: message from ${name || 'a visitor'}`);
    const body = encodeURIComponent(`${message}\n\n— ${name || '(no name given)'}`);
    track('contact_email_composed', { name: Boolean(name) });
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <SitePage
      path="/contact"
      title="Contact — CodeType"
      description="Reach the operator: feature requests, bug reports (with your browser + the version badge), or anything else."
    >
      <p className="mb-6 text-[11px] leading-relaxed tracking-[0.04em] text-dim">
        The fastest way to reach me is email. If you report a bug, include your{' '}
        <span className="text-ink">browser</span> and the{' '}
        <span className="text-accent">version badge</span> in the top-right corner of the page — it saves a round trip.
      </p>

      <form onSubmit={send} className="mb-8 max-w-[520px] space-y-3">
        <div>
          <div className="hud-label mb-1.5">YOUR NAME</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="operator-42"
            autoComplete="name"
            className="w-full border border-edge bg-panel2 px-3 py-2 text-[11px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <div className="hud-label mb-1.5">MESSAGE</div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Bug report / feature idea / question…"
            required
            className="w-full resize-y border border-edge bg-panel2 px-3 py-2 text-[11px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
        <button type="submit" className="chip chip-on-amber !px-5 !py-2 !text-[10px]">
          ✉ COMPOSE EMAIL
        </button>
        <p className="text-[9px] tracking-[0.08em] text-faint">
          THIS OPENS YOUR EMAIL APP WITH EVERYTHING PRE-FILLED — NOTHING IS SENT FROM THIS SITE DIRECTLY.
        </p>
      </form>

      <div className="flex flex-wrap items-center gap-4 border-t border-edge pt-6 text-[10px] tracking-[0.14em]">
        <a className="site-link" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        <span className="text-faint">·</span>
        <button type="button" className="site-link" onClick={() => navigate('/faq')}>
          READ THE FAQ FIRST
        </button>
      </div>
    </SitePage>
  );
}
