// Light URL layer: real paths for the marketing pages (/about, /faq,
// /contact, /waitlist) so they are deep-linkable and indexable. The app
// views (train/race/analytics/profile) intentionally stay on "/".
import { useEffect } from 'react';

import { useGameStore } from '../store/gameStore.js';

export const SITE_ROUTES = {
  '/': 'train',
  '/about': 'about',
  '/faq': 'faq',
  '/contact': 'contact',
  '/waitlist': 'waitlist'
};

export function viewForPath(p) {
  const clean = String(p || '/').split('?')[0].replace(/\/+$/, '') || '/';
  return SITE_ROUTES[clean] || 'notfound';
}

export function navigate(path) {
  try {
    window.history.pushState({}, '', path);
  } catch {
    /* file:// or sandboxed contexts — view still switches */
  }
  useGameStore.getState().setView(viewForPath(path));
}

export function useSiteRoute() {
  const setView = useGameStore((s) => s.setView);
  useEffect(() => {
    const sync = () => setView(viewForPath(window.location.pathname));
    window.addEventListener('popstate', sync);
    sync(); // deep links: opening /about directly lands on the about page
    return () => window.removeEventListener('popstate', sync);
  }, [setView]);
}
