# CodeType — Security Audit (v1.9)

Audit date: 2026-08-30 · Scope: `backend/`, `frontend/`, `supabase/`, deploy scripts.

## 1. Hardcoded secrets / credentials — full scan

Scanned the entire codebase (excluding `node_modules`) for API keys, tokens,
passwords, private keys, and service-account material.

| Finding | Severity | Status |
|---|---|---|
| `backend/.env` and `frontend/.env` contained the real Supabase **project URL + anon (publishable) key** and were committed to Git. | Low–Medium | **Fixed** — untracked from Git (`git rm --cached`); already in `.gitignore`. |
| The committed value is `sb_publishable_…` — the **anon/public** key. This is *designed* to ship to the browser (Row-Level Security scopes all data to the owner). | Informational | No action required, but see note below. |
| No `service_role` key, no Postgres connection string, no `JWT_SECRET`, no private key, no third-party API key anywhere in the repo. | — | Clean. |

### Recommended follow-up (not blocking)

* The anon key still exists in **Git history** (it was committed previously).
  The anon key is publishable and RLS-scoped, so the risk is low — but if you
  want it gone, rotate it in Supabase: *Dashboard → Settings → API → Rotate
  anon key*, then update `frontend/.env` / `backend/.env` locally. No code change needed.
* **Never** put the `service_role` key or the DB password in any `.env` file
  that could be committed, and never reference them in `VITE_*` variables
  (anything `VITE_*` is inlined into the public bundle). The backend already
  loads secrets from `backend/.env` at runtime via a small loader where real
  environment variables win — keep using that pattern.

## 2. What was added this pass

| Control | Where |
|---|---|
| **Rate limiting** on every endpoint | `backend/src/middleware/rateLimit.js` + `server.js` |
| **Strict bucket: 5 attempts / 15 min** on account-like routes | `/api/waitlist` (email signup) — the closest thing to an auth route this API exposes |
| **General bucket: 300 / 15 min** (tunable via `RATE_LIMIT_MAX`) | all other routes |
| **Security headers** (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`) | `backend/src/middleware/security.js` |
| **Body-size guard** (413 before parse) + **1 MB** JSON limit | `server.js`, `security.js` |
| **Malformed JSON → 400** (was 500) | `middleware/error.js` |
| **Payload-too-large → 413** | `middleware/error.js` |
| **CORS origin allowlist** via `CORS_ORIGIN` (default: same-origin) | `server.js` |
| **Input sanitization** (length-capped strings, numeric coercion, email regex, bounded query params) | already present in `sessions.js`, `waitlist.js`; kept + tightened |

## 3. Input handling

* `POST /api/sessions` — every field is coerced and length-capped
  (`mode`/`language` ≤ 24 chars, `snippetId` ≤ 40, `title` ≤ 80, `source` ≤ 120),
  `charStats` capped at 160 keys, `charTimes` capped at 2000 entries.
* `POST /api/waitlist` — strict email regex + 200-char cap; case-normalized;
  duplicates rejected.
* `GET /api/sessions` — `limit` clamped to `[1, 100]`, `cursor` coerced to a
  finite number.
* WebSocket race lobby — join codes stripped to 6 digits, snippet id length-capped,
  durations whitelisted (`{0,30,60,90}`), progress chars clamped to `[0, 100000]`.

## 4. Remaining vulnerabilities / recommendations

These are **residual risks**, not regressions, and are listed honestly.

1. **In-memory rate limiter is per-process.** Behind a load balancer (multiple
   Node instances / serverless), each instance has its own counter, so an
   attacker can spread attempts across instances. For a scaled deploy, swap the
   `Map` in `rateLimit.js` for a shared store (Redis / Supabase table / Upstash).
   — *Severity: Low (mitigated for single-instance deploys).*

2. **CORS is open unless `CORS_ORIGIN` is set.** The default (`cors()` with no
   allowlist) is convenient but permissive. In production set
   `CORS_ORIGIN=https://your-frontend.vercel.app` (comma-separated for multiple).
   The API is same-origin with the frontend today and carries no cookies, so
   exploitability is low. — *Severity: Low.*

3. **WebSocket endpoint (`/api/ws`) is not rate-limited.** A client can open
   many sockets / create many race rooms. Rooms self-expire (15 min TTL) and the
   heartbeat prunes dead sockets, so the blast radius is bounded, but consider
   capping connections per IP. — *Severity: Low.*

4. **Supabase Auth rate limiting lives in Supabase, not this backend.** Login /
   signup calls go from the browser straight to Supabase, so the 5/15-min bucket
   here can't throttle them. Enable **Auth rate limiting** and turn on CAPTCHA /
   "Confirm email" in *Supabase Dashboard → Authentication → Protection*.
   — *Severity: Medium (brute-force surface, mitigated by Supabase defaults).*

5. **No HSTS / no CSRF tokens.** HSTS must be set at the TLS proxy (Vercel/Render),
   not in app code. CSRF is largely a non-issue here because the API uses a
   stateless `Authorization: Bearer` JWT (no ambient cookies); note that the
   WebSocket handshake also does not check `Origin` — consider validating
   `Origin`/`Host` on the upgrade if you tighten CORS. — *Severity: Low.*

6. **Data in the browser is client-controlled.** Guest data is stored in
   `localStorage` and cloud rows are RLS-scoped, but any stats the client sends
   are trusted (WPM, accuracy). This is a gaming/telemetry app, so acceptable —
   flagging only so it's a conscious decision. — *Severity: Informational.*

## 5. Verification performed

* `curl` smoke tests confirmed: `429` after 5 waitlist signups, `400` on
  malformed JSON, `413` on a 2 MB body, security + rate-limit headers present,
  and pagination/query endpoints returning correctly.
