// Optional Supabase persistence. When a request carries a valid Supabase JWT the
// session rows are read/written to the user's own Supabase table (RLS-scoped);
// otherwise the request falls back to the local JSON file store.
import { createClient } from '@supabase/supabase-js';

import { db } from './fileStore.js';
import { guestStoreFor, isGuestId } from './guestStore.js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
export const supaConfigured = Boolean(URL && KEY);

const localStore = {
  kind: 'local',
  async all() {
    return db.all();
  },
  // Single-pass filter + paginate over the in-memory list. Mirrors the
  // Supabase store's query() so route code is store-agnostic.
  async query(opts = {}) {
    let rows = db.all();
    if (opts.snippetId) rows = rows.filter((r) => r.snippetId === opts.snippetId);
    if (opts.mode) rows = rows.filter((r) => r.mode === opts.mode);
    if (opts.language) rows = rows.filter((r) => r.language === opts.language);
    if (opts.daily !== undefined) rows = rows.filter((r) => Boolean(r.daily) === Boolean(opts.daily));
    if (opts.since) rows = rows.filter((r) => r.createdAt < opts.since); // cursor: strictly older
    if (opts.before) rows = rows.filter((r) => r.createdAt > opts.before); // strictly newer
    if (opts.offset) rows = rows.slice(opts.offset);
    if (opts.limit) rows = rows.slice(0, opts.limit);
    return rows;
  },
  async insert(row) {
    await db.addSession(row);
    return row;
  }
};

function decodeJwtPayload(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// client per (sub:exp) — a token refresh changes exp, so we re-validate at most
// once per token lifetime; RLS in Postgres does the actual per-user isolation
const clients = new Map();

function supaClientFor(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.sub) return null;
  const keyStr = `${payload.sub}:${payload.exp || 0}`;
  let entry = clients.get(keyStr);
  if (!entry) {
    if (clients.size > 64) clients.clear();
    const client = createClient(URL, KEY, {
      auth: { autoRefreshToken: false, persistSession: false, fetch: globalThis.fetch }
    });
    client.auth.setSession({ access_token: token, refresh_token: token });
    entry = { client, sub: payload.sub, exp: payload.exp || 0 };
    clients.set(keyStr, entry);
  }
  if (entry.exp && Date.now() / 1000 > entry.exp) return null; // token expired → fall back
  return entry;
}

function toSupaRow(row, userId) {
  return {
    id: row.id,
    user_id: userId,
    created_at: new Date(row.createdAt).toISOString(),
    mode: row.mode,
    language: row.language,
    snippet_id: row.snippetId,
    snippet_title: row.snippetTitle,
    snippet_source: row.snippetSource,
    wpm: row.wpm,
    raw_wpm: row.rawWpm,
    accuracy: row.accuracy,
    consistency: row.consistency,
    time_sec: row.timeSec,
    errors: row.errors,
    backspaces: row.backspaces,
    chars: row.chars,
    symbol_stats: row.symbolStats || {},
    line_stats: row.lineStats || {},
    char_stats: row.charStats || {},
    char_times: row.charTimes || [],
    daily: row.daily
  };
}

function fromSupaRow(r) {
  return {
    id: r.id,
    createdAt: new Date(r.created_at).getTime(),
    mode: r.mode,
    language: r.language,
    snippetId: r.snippet_id,
    snippetTitle: r.snippet_title,
    snippetSource: r.snippet_source,
    wpm: Number(r.wpm) || 0,
    rawWpm: Number(r.raw_wpm) || 0,
    accuracy: Number(r.accuracy) || 0,
    consistency: Number(r.consistency) || 0,
    timeSec: Number(r.time_sec) || 0,
    errors: Number(r.errors) || 0,
    backspaces: Number(r.backspaces) || 0,
    chars: Number(r.chars) || 0,
    symbolStats: r.symbol_stats || {},
    lineStats: r.line_stats || {},
    charStats: r.char_stats || {},
    charTimes: Array.isArray(r.char_times) ? r.char_times : [],
    daily: Boolean(r.daily)
  };
}

function supaStore(entry) {
  const degrade = (err, localFn) => {
    console.error('[codetype-api] supabase error — falling back to local store:', err?.message || err);
    return localFn();
  };
  return {
    kind: 'supabase',
    async all() {
      try {
        const { data, error } = await entry.client.from('sessions').select('*').order('created_at', { ascending: false }).limit(500);
        if (error) throw new Error(`${error.code || ''} ${error.message}`.trim());
        return (data || []).map(fromSupaRow);
      } catch (err) {
        if (String(err.message).includes('42P01')) console.error('[codetype-api] "sessions" table missing — run supabase/schema.sql in the Supabase SQL editor');
        return degrade(err, () => localStore.all());
      }
    },
    // Push filtering/pagination down to Postgres (eq + order + limit/range)
    // so we never pull 500 rows and filter in JS. Cursor uses created_at.
    async query(opts = {}) {
      try {
        let q = entry.client.from('sessions').select('*');
        if (opts.snippetId) q = q.eq('snippet_id', opts.snippetId);
        if (opts.mode) q = q.eq('mode', opts.mode);
        if (opts.language) q = q.eq('language', opts.language);
        if (opts.daily !== undefined) q = q.eq('daily', Boolean(opts.daily));
        q = q.order('created_at', { ascending: false });
        if (opts.since) q = q.lt('created_at', new Date(opts.since).toISOString());
        if (opts.before) q = q.gt('created_at', new Date(opts.before).toISOString());
        if (opts.offset) {
          const from = opts.offset;
          const to = from + (opts.limit || 100) - 1;
          q = q.range(from, to);
        } else if (opts.limit) {
          q = q.limit(opts.limit);
        }
        const { data, error } = await q;
        if (error) throw new Error(`${error.code || ''} ${error.message}`.trim());
        return (data || []).map(fromSupaRow);
      } catch (err) {
        if (String(err.message).includes('42P01')) console.error('[codetype-api] "sessions" table missing — run supabase/schema.sql in the Supabase SQL editor');
        return degrade(err, () => localStore.query(opts));
      }
    },
    async insert(row) {
      try {
        const { error } = await entry.client.from('sessions').upsert(toSupaRow(row, entry.sub));
        if (error) throw new Error(`${error.code || ''} ${error.message}`.trim());
        return row;
      } catch (err) {
        if (String(err.message).includes('42P01')) console.error('[codetype-api] "sessions" table missing — run supabase/schema.sql in the Supabase SQL editor');
        await degrade(err, () => localStore.insert(row)); // never lose the run
        return row;
      }
    }
  };
}

// The store a guest request writes to: that device's own file. Falls back to
// the shared legacy store only when no (valid) guest id is supplied — e.g. a
// direct curl with no headers — so nothing that worked before breaks.
function guestOrShared(req) {
  const id = String(req.headers?.['x-guest-id'] || '').trim();
  return isGuestId(id) ? guestStoreFor(id) : localStore;
}

// Returns the persistence store for this request (never throws on bad tokens —
// degrades to local so the site keeps working).
export async function storeFor(req) {
  if (!supaConfigured) return guestOrShared(req);
  const header = req.headers?.authorization || '';
  if (!header.startsWith('Bearer ')) return guestOrShared(req);
  const token = header.slice(7).trim();
  if (token.length < 30) return guestOrShared(req);
  try {
    const entry = supaClientFor(token);
    if (!entry) return guestOrShared(req);
    // validate the token against Supabase auth (cheap: once per token lifetime)
    const { data, error } = await entry.client.auth.getUser();
    if (error || !data?.user || data.user.id !== entry.sub) return guestOrShared(req);
    return supaStore(entry);
  } catch {
    return guestOrShared(req);
  }
}
