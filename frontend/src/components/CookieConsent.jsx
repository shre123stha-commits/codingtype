// Lightweight cookie consent banner (no third-party library).
// Gates analytics + ad cookies: nothing external loads until ACCEPT.
import { useEffect, useState } from 'react';

import { setConsent, track } from '../utils/analytics.js';

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem('codetype-consent');
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const show = () => setVisible(true);
    window.addEventListener('ct-consent-reset', show);
    return () => window.removeEventListener('ct-consent-reset', show);
  }, []);

  if (!visible) return null;

  const choose = (choice) => {
    setConsent(choice);
    track('consent_choice', { choice });
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="cookie consent"
      className="fixed bottom-4 left-4 z-50 max-w-[340px] border border-edge2 bg-panel2 p-4 shadow-[0_8px_30px_rgb(0_0_0/0.5)]"
    >
      <div className="hud-label mb-1.5">COOKIES</div>
      <p className="mb-3 text-[10px] leading-relaxed tracking-[0.05em] text-dim">
        CodeType uses a single cookie to remember this choice, plus optional analytics and ad cookies. Declining only
        stops the optional ones — the app works the same either way.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => choose('yes')} className="chip chip-on-amber flex-1 !py-1.5 !text-[10px]">
          ACCEPT
        </button>
        <button type="button" onClick={() => choose('no')} className="chip chip-off flex-1 !py-1.5 !text-[10px]">
          DECLINE
        </button>
      </div>
    </div>
  );
}
