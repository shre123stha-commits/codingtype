// Optional Supabase client. Created only when VITE_SUPABASE_URL +
// VITE_SUPABASE_ANON_KEY are set (frontend/.env). Without them the whole app
// still works — accounts are simply unavailable and data stays local.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const authAvailable = Boolean(url && key);

export const supabase = authAvailable
  ? createClient(url, key, {
      auth: {
        persistSession: true, // keep logged in across reloads (localStorage)
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
