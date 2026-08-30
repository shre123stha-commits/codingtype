import { navigate } from '../hooks/useSiteRoute.js';
import { usePageMeta } from '../utils/pageMeta.js';

export default function NotFoundPage() {
  usePageMeta({
    title: 'Page not found — CodeType',
    description: 'This page does not exist in the repo. 404 — check the path, or head back to the training arena.',
    path: window.location.pathname
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-center px-5 py-24 text-center">
      <div className="mb-4 font-mono text-[64px] font-bold leading-none text-blood/80">404</div>
      <h1 className="mb-3 text-xl font-bold tracking-[0.14em] text-ink">
        THIS FILE DOES NOT EXIST IN THE REPO
      </h1>
      <p className="mb-10 max-w-[420px] font-mono text-[11px] leading-relaxed tracking-[0.06em] text-faint">
        <span className="text-blood">Error:</span> GET {window.location.pathname} → 404 NOT FOUND. The path you
        requested is not part of CodeType.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="chip chip-on-amber !px-5 !py-2 !text-[10px]" onClick={() => navigate('/')}>
          ← BACK TO THE ARENA
        </button>
        <button type="button" className="chip chip-off !px-5 !py-2 !text-[10px]" onClick={() => navigate('/faq')}>
          READ THE FAQ
        </button>
        <button type="button" className="chip chip-off !px-5 !py-2 !text-[10px]" onClick={() => navigate('/contact')}>
          REPORT A BROKEN LINK
        </button>
      </div>
    </main>
  );
}
