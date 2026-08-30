import { useGameStore } from '../store/gameStore.js';
import { navigate } from '../hooks/useSiteRoute.js';
import { consentState, setConsent } from '../utils/analytics.js';
import { CONTACT_EMAIL, FE_VERSION, SITE_NAME } from '../utils/siteConfig.js';

const SITE_LINKS = [
  ['/about', 'ABOUT'],
  ['/faq', 'FAQ'],
  ['/waitlist', 'WAITLIST'],
  ['/contact', 'CONTACT']
];

const APP_LINKS = [
  ['train', 'TRAIN'],
  ['race', 'RACE'],
  ['analytics', 'ANALYTICS'],
  ['profile', 'PROFILE']
];

export default function SiteFooter() {
  const setView = useGameStore((s) => s.setView);
  const consent = consentState();

  const openHelp = () => document.dispatchEvent(new CustomEvent('ct-help', { detail: { open: true } }));

  return (
    <footer className="site-footer border-t border-edge bg-panel/60">
      <div className="mx-auto grid max-w-[1100px] grid-cols-2 gap-8 px-6 py-8 text-[10px] tracking-[0.14em] sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold tracking-[0.18em] text-ink">
            <span className="inline-block h-3.5 w-2 bg-accent" />
            {SITE_NAME}
          </div>
          <p className="max-w-[220px] leading-relaxed text-faint">
            TACTICAL TYPING TELEMETRY FOR SOFTWARE DEVELOPERS. TRAIN THE SYMBOLS OF REAL PRODUCTION CODE.
          </p>
        </div>

        <nav aria-label="site pages">
          <div className="hud-label mb-2.5">SITE</div>
          {SITE_LINKS.map(([path, label]) => (
            <div key={path} className="mb-1.5">
              <button type="button" className="site-link" onClick={() => navigate(path)}>
                {label}
              </button>
            </div>
          ))}
        </nav>

        <nav aria-label="app views">
          <div className="hud-label mb-2.5">APP</div>
          {APP_LINKS.map(([id, label]) => (
            <div key={id} className="mb-1.5">
              <button type="button" className="site-link" onClick={() => setView(id)}>
                {label}
              </button>
            </div>
          ))}
        </nav>

        <nav aria-label="resources">
          <div className="hud-label mb-2.5">RESOURCES</div>
          <div className="mb-1.5">
            <button type="button" className="site-link" onClick={openHelp}>
              KEYBOARD SHORTCUTS <span className="text-dim">[F1]</span>
            </button>
          </div>
          <div className="mb-1.5">
            <a className="site-link" href={`mailto:${CONTACT_EMAIL}`}>
              EMAIL US
            </a>
          </div>
          <div className="mb-1.5">
            <a className="site-link" href="/llms.txt" target="_blank" rel="noopener">
              LLMs.TXT
            </a>
          </div>
        </nav>
      </div>

      <div className="border-t border-edge/60">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-6 py-3 text-[9px] tracking-[0.16em] text-faint">
          <span>© 2026 {SITE_NAME} · v{FE_VERSION}</span>
          <span className="flex items-center gap-3">
            <span>
              COOKIES: {consent === 'yes' ? 'ACCEPTED' : consent === 'no' ? 'DECLINED' : 'NOT SET'}
            </span>
            <button
              type="button"
              className="site-link"
              onClick={() => {
                setConsent(null);
                document.dispatchEvent(new CustomEvent('ct-consent-reset'));
              }}
            >
              CHANGE
            </button>
          </span>
        </div>
      </div>
    </footer>
  );
}
