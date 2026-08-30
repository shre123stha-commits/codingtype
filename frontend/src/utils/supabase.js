// Optional Supabase client — loaded ON DEMAND.
//
// @supabase/supabase-js is ~208 kB minified (54 kB gzip): the largest single
// thing in the bundle after React itself. Almost every visitor is a guest who
// never signs in, so the SDK is no longer part of the initial download. It is
// imported only when
//   (a) localStorage already holds a persisted Supabase session — i.e. a
//       returning signed-in user, or
//   (b) the visitor actually opens the account menu and signs in.
//
// A guest never downloads it. `hasStoredSession()` is the cheap synchronous
// probe that makes that possible: supabase-js persists the session under
// `sb-<project-ref>-auth-token`, so checking for the key costs nothing while
// importing the SDK costs 208 kB.
//
// Leave VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY empty and the whole app
// still works — accounts are simply unavailable and data stays local.
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

export const authAvailable = Boolean(url && key);

let clientPromise = null;

export function getSupabase() {
  if (!authAvailable) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(url, key, {
          auth: {
            persistSession: true, // keep logged in across reloads (localStorage)
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        })
      )
      .catch((err) => {
        clientPromise = null; // let a later call retry (flaky network / CDN)
        console.error('[codetype] supabase sdk failed to load', err);
        return null;
      });
  }
  return clientPromise;
}

export function hasStoredSession() {
  if (!authAvailable) return false;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && /^sb-.+-auth-token$/.test(k) && localStorage.getItem(k)) return true;
    }
  } catch {
    /* private mode / storage blocked — treat as a guest */
  }
  return false;
}
