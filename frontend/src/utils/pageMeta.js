// Per-page <title>, meta description, canonical and OG tags.
// The SPA updates these as the visitor moves between pages; index.html
// already ships static defaults so crawlers see correct tags on first paint.
import { useEffect } from 'react';

import { SITE_URL } from './siteConfig.js';

function upsertMeta(attrName, key, content) {
  let el = document.head.querySelector(`meta[${attrName}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function usePageMeta({ title, description, path = '/' }) {
  useEffect(() => {
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', SITE_URL + path);
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', SITE_URL + path);
  }, [title, description, path]);
}
