import AdSlot from '../components/AdSlot.jsx';
import { navigate } from '../hooks/useSiteRoute.js';
import SitePage from './SitePage.jsx';

export default function AboutPage() {
  return (
    <SitePage
      path="/about"
      title="About — CodeType"
      description="CodeType is a typing trainer built for software developers: real production code, blind modes, and per-key telemetry."
    >
      <div className="space-y-4 text-[11px] leading-relaxed tracking-[0.04em] text-dim">
        <p>
          <span className="text-ink">CodeType</span> is a typing trainer built exclusively for software developers.
          Instead of random dictionary words, you type real production code — Express routers, React components, SQL
          migrations, Rust match arms — and the app measures how your fingers actually handle the syntax you live in
          every day.
        </p>
        <p>
          General typing sites train you on <em>words</em>. CodeType trains you on <span className="text-accent">symbols</span>:
          the braces, quotes, arrows and semicolons that make up the bulk of the characters you type on the job.
        </p>
      </div>

      <div className="my-8 grid gap-3 sm:grid-cols-3">
        {[
          ['TRAIN', 'Real code snippets with live WPM, error and consistency telemetry.'],
          ['RACE', '1v1 ghost races — beat a friend, or your own personal best.'],
          ['ANALYTICS', 'Per-key heatmaps, symbol friction, velocity and streaks over time.']
        ].map(([t, d]) => (
          <div key={t} className="card-lift border border-edge bg-panel p-4">
            <div className="mb-1.5 text-[10px] font-bold tracking-[0.22em] text-accent">{t}</div>
            <p className="text-[10px] leading-relaxed text-faint">{d}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4 text-[11px] leading-relaxed tracking-[0.04em] text-dim">
        <p>
          <span className="text-ink">Why BLIND mode?</span> It hides the text ahead of your caret and shows only a few
          characters at a time. That forces the symbol patterns to become muscle memory instead of something you read
          — the same way you stop reading code when you are fluent.
        </p>
        <p>
          No paywall, no forced account. Guest data stays in your browser; sign in (email + password only) to keep
          your stats in the cloud.
        </p>
      </div>

      <AdSlot variant="leaderboard" className="my-8" />

      <div className="flex flex-wrap gap-2">
        <button type="button" className="chip chip-on-amber !px-4 !py-2 !text-[10px]" onClick={() => navigate('/faq')}>
          READ THE FAQ →
        </button>
        <button type="button" className="chip chip-off !px-4 !py-2 !text-[10px]" onClick={() => navigate('/contact')}>
          CONTACT US
        </button>
        <button type="button" className="chip chip-off !px-4 !py-2 !text-[10px]" onClick={() => navigate('/')}>
          ← START TYPING
        </button>
      </div>
    </SitePage>
  );
}
