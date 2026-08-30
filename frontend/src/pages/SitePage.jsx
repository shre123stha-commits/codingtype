// Shared shell for the marketing pages. Guarantees exactly one <h1>,
// a consistent title/meta/canonical set, and a breadcrumb back home.
//
// Layout mirrors the training arena: content on the left, the advertisement
// in a 300px rail on the RIGHT (same 300x250 box format as the left-hand
// banner on the home page). On narrow screens the rail drops below the
// content instead of sitting above it, so it never pushes the copy down.
import { usePageMeta } from '../utils/pageMeta.js';
import { navigate } from '../hooks/useSiteRoute.js';
import AdSlot from '../components/AdSlot.jsx';

export default function SitePage({ path, title, description, children }) {
  usePageMeta({ title, description, path });
  const heading = title.split(' — ')[0];
  return (
    <main className="site-page mx-auto grid w-full max-w-[1180px] grid-cols-1 items-start gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <nav aria-label="breadcrumb" className="mb-6 flex items-center gap-2 text-[10px] tracking-[0.18em] text-faint">
          <button type="button" className="site-link" onClick={() => navigate('/')}>
            ← CODETYPE
          </button>
          <span aria-hidden="true">/</span>
          <span className="text-dim">{heading.toUpperCase()}</span>
        </nav>
        <h1 className="mb-3 text-2xl font-bold tracking-tight text-ink">{heading}</h1>
        <p className="mb-8 max-w-[560px] text-[11px] leading-relaxed tracking-[0.05em] text-faint">{description}</p>
        {children}
      </div>

      {/* RIGHT-HAND AD RAIL — same box format as the left rail on the home page */}
      <aside className="ad-rail min-w-0 lg:sticky lg:top-4" aria-label="Sponsored">
        <AdSlot variant="box" />
      </aside>
    </main>
  );
}
