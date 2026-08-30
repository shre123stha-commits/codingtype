// Shared input sanitization. Every value that crosses the HTTP or WebSocket
// boundary goes through one of these helpers — nothing trusts the client.
//
// Rules applied everywhere:
//   • strings    → control chars stripped, length hard-capped
//   • numbers    → coerced with Number(), NaN/±Infinity rejected, clamped
//   • objects    → rebuilt key-by-key (prototype pollution impossible),
//                  key count + key length capped, values re-sanitized
//   • arrays     → element count capped, elements re-sanitized
//   • bodies     → must be a plain JSON object; arrays/strings/null rejected

// Control characters (C0 + C1 + DEL) never belong in a typing-telemetry field.
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/g;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function str(value, max = 255, fallback = '') {
  if (typeof value !== 'string') {
    if (value === null || value === undefined) return fallback;
    return String(value).slice(0, max).replace(CONTROL_RE, '');
  }
  return value.replace(CONTROL_RE, '').slice(0, max);
}

export function num(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function int(value, opts = {}) {
  return Math.round(num(value, opts));
}

export function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

// Rebuild a stats map ({ key: { t, e } } or { key: number }) safely.
// `maxKeys` bounds the payload; forbidden keys are dropped so a crafted body
// can never write to Object.prototype.
export function statsMap(value, { maxKeys = 256, maxKeyLen = 32 } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = Object.create(null);
  let count = 0;
  for (const rawKey of Object.keys(value)) {
    if (count >= maxKeys) break;
    // Checked on the RAW key, before truncation: otherwise "__proto__" would
    // be sliced to "__proto_" and slip past as an ordinary key.
    if (FORBIDDEN_KEYS.has(rawKey)) continue;
    const key = str(rawKey, maxKeyLen, '');
    if (!key || FORBIDDEN_KEYS.has(key)) continue;
    const v = value[rawKey];
    if (typeof v === 'number') {
      out[key] = num(v, { min: 0, max: 1e9 });
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[key] = {
        t: num(v.t, { min: 0, max: 1e9 }),
        e: num(v.e, { min: 0, max: 1e9 })
      };
    } else {
      continue;
    }
    count += 1;
  }
  return out;
}

// Keystroke timings: [{ t: seconds, n: charCount }]. Millisecond precision is
// kept — whole-second rounding made ghost-race replays teleport.
export function timings(value, { max = 2000, maxT = 86400 } = {}) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (let i = 0; i < value.length && out.length < max; i += 1) {
    const c = value[i];
    if (!c || typeof c !== 'object') continue;
    out.push({
      t: Math.round(num(c.t, { min: 0, max: maxT }) * 1000) / 1000,
      n: int(c.n, { min: 1, max: 1000, fallback: 1 })
    });
  }
  return out;
}

// Query-string helpers — bounded, typed, and never NaN.
export function queryInt(value, { min = 0, max = 100, fallback = 0 } = {}) {
  if (value === undefined || value === '' || value === null) return fallback;
  return int(value, { min, max, fallback });
}

export function queryStr(value, max = 120) {
  return value === undefined || value === null ? '' : str(value, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function email(value, max = 200) {
  const e = str(value, max).trim().toLowerCase();
  return EMAIL_RE.test(e) && e.length <= max ? e : null;
}

// Reject anything that isn't a plain JSON object before a route touches it.
export function isPlainBody(body) {
  return Boolean(body) && typeof body === 'object' && !Array.isArray(body);
}
