// Central site-wide settings. Change values here once — pages, SEO tags,
// footer and the top bar all read from this file.
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const SITE_NAME = 'CodeType';
// Production domain (used for canonical/OG/sitemap consistency).
export const SITE_URL = String(env.VITE_SITE_URL || 'https://codetype-eight.vercel.app').replace(/\/+$/, '');
// Shown on the CONTACT page and used by its mailto form. Change to yours.
export const CONTACT_EMAIL = String(env.VITE_CONTACT_EMAIL || 'hello@codetype.dev');
export const FE_VERSION = '1.8.0';
