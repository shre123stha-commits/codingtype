import { lazy, Suspense, useEffect } from 'react';

import CookieConsent from './components/CookieConsent.jsx';
import KeyLegend from './components/KeyLegend.jsx';
import KeyboardHelp from './components/KeyboardHelp.jsx';
import ProfileNamePrompt from './components/ProfileNamePrompt.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import TopBar from './components/TopBar.jsx';
import TrainView from './components/TrainView.jsx';
import { useCatalog, useGhost, useSessionPost } from './hooks/useApi.js';
import { useSiteRoute } from './hooks/useSiteRoute.js';
import { useTicker } from './hooks/useTicker.js';
import { useGameStore } from './store/gameStore.js';
import { init, track } from './utils/analytics.js';
import { usePageMeta } from './utils/pageMeta.js';

// Code splitting: each non-initial view is loaded on demand so the initial
// bundle stays lean. The heaviest dependencies — recharts (AnalyticsView),
// and the marketing pages — only download when their screen is first opened.
const AnalyticsView = lazy(() => import('./components/AnalyticsView.jsx'));
const ProfileView = lazy(() => import('./components/ProfileView.jsx'));
const RaceView = lazy(() => import('./components/RaceView.jsx'));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'));
const ContactPage = lazy(() => import('./pages/ContactPage.jsx'));
const FaqPage = lazy(() => import('./pages/FaqPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));
const WaitlistPage = lazy(() => import('./pages/WaitlistPage.jsx'));

// Marketing pages manage their own <title>/meta via SitePage; these cover
// the app views so every screen has a consistent, unique title.
const APP_META = {
  train: {
    title: 'CodeType — Dev-Tuned Typing Telemetry',
    description:
      'Tactical typing telemetry for software developers. Train the symbols, braces, and arrows of real production code. Free, in the browser, no account required.',
    path: '/'
  },
  race: {
    title: '1v1 Race — CodeType',
    description:
      'Race a friend or your own personal best on the same real code snippet. 1v1 lobbies, live progress and ghost racing.',
    path: '/'
  },
  analytics: {
    title: 'Analytics — CodeType',
    description: 'Per-key heatmaps, symbol friction, velocity and consistency trends from your CodeType sessions.',
    path: '/'
  },
  profile: {
    title: 'Profile — CodeType',
    description: 'Your CodeType operator profile: identity, career stats, per-language breakdowns and personal bests.',
    path: '/'
  }
};

function AppMeta({ view }) {
  const meta = APP_META[view] || APP_META.train;
  usePageMeta(meta);
  return null;
}

export default function App() {
  useCatalog();
  useGhost();
  useSessionPost();
  useTicker(200);
  useSiteRoute();
  const view = useGameStore((s) => s.view);

  useEffect(() => {
    init(); // analytics: only loads if configured AND cookies accepted
  }, []);
  useEffect(() => {
    track('page_view', { page: view });
  }, [view]);

  const isAppView = view === 'train' || view === 'race' || view === 'analytics' || view === 'profile';

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <div className="flex-1 pb-14">
        <Suspense fallback={<div className="p-10 text-center text-[10px] tracking-[0.3em] text-faint">LOADING…</div>}>
          {view === 'train' ? (
            <TrainView />
          ) : view === 'race' ? (
            <RaceView />
          ) : view === 'profile' ? (
            <ProfileView />
          ) : view === 'analytics' ? (
            <AnalyticsView />
          ) : view === 'about' ? (
            <AboutPage />
          ) : view === 'faq' ? (
            <FaqPage />
          ) : view === 'contact' ? (
            <ContactPage />
          ) : view === 'waitlist' ? (
            <WaitlistPage />
          ) : (
            <NotFoundPage />
          )}
        </Suspense>
      </div>
      {isAppView ? <AppMeta view={view} /> : null}
      <ProfileNamePrompt />
      <KeyLegend />
      <SiteFooter />
      <CookieConsent />
      <KeyboardHelp />
    </div>
  );
}
