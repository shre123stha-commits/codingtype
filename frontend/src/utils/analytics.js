// Consent-gated site analytics. OFF by default: nothing is loaded or sent
// unless VITE_ANALYTICS_ID is set at build time AND the visitor accepts
// cookies. Providers supported (set in frontend/.env):
//
//   VITE_ANALYTICS_ID=G-XXXXXXXXXX          → Google Analytics 4
//   VITE_ANALYTICS_ID=plausible             → Plausible
//   VITE_ANALYTICS_DOMAIN=your-site.com     → (plausible only)
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const ID = String(env.VITE_ANALYTICS_ID || '').trim();
const DOMAIN = String(env.VITE_ANALYTICS_DOMAIN || '').trim();

let ready = false;
const queued = [];

export function consentState() {
  try {
    return localStorage.getItem('codetype-consent');
  } catch {
    return null;
  }
}

export function setConsent(choice) {
  try {
    if (choice) localStorage.setItem('codetype-consent', choice);
    else localStorage.removeItem('codetype-consent');
  } catch {
    /* private mode — consent just won't persist */
  }
  if (choice === 'yes') init();
}

function inject(src) {
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

export function init() {
  if (ready || !ID) return;
  if (consentState() !== 'yes') return;
  if (ID.startsWith('G-')) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', ID, { anonymize_ip: true });
    inject(`https://www.googletagmanager.com/gtag/js?id=${ID}`);
  } else if (ID === 'plausible' && DOMAIN) {
    inject('https://plausible.io/js/script.js');
  } else {
    return;
  }
  ready = true;
  while (queued.length) {
    const [name, props] = queued.shift();
    sendRaw(name, props);
  }
}

function sendRaw(name, props) {
  try {
    if (ID.startsWith('G-')) window.gtag?.('event', name, props || {});
    else if (ID === 'plausible') window.plausible?.(name, { props });
  } catch {
    /* analytics must never break the app */
  }
}

export function track(name, props) {
  if (ready) sendRaw(name, props);
  else if (ID) queued.push([name, props]);
}
