// Shared shell for the marketing pages. Guarantees exactly one <h1>,
// a consistent title/meta/canonical set, and a breadcrumb back home.
import { usePageMeta } from '../utils/pageMeta.js';
import { navigate } from '../hooks/useSiteRoute.js';

export default function SitePage({ path, title, description, children }) {
  usePageMeta({ title, description, path });
  const heading = title.split(' — ')[0];
  return (
    <main className="site-page mx-auto w-full max-w-3xl px-5 py-10">
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
    </main>
  );
}
