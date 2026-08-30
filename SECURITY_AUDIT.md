# CodeType — Security Audit

Last audited: 2026-08-30 · Scope: `backend/`, `frontend/`, `supabase/`, `scripts/`, deploy files.
Every "verified" line below was produced by a command run against this tree; the
command is named so you can re-run it.

## 1. Hardcoded secrets — full scan

Scanned all tracked files (excluding `node_modules`) for API keys, tokens,
passwords, connection strings, private keys and cloud credentials, then repeated
the scan across **every commit in history**.

| Check | Command | Result |
|---|---|---|
| Secret patterns in the working tree | `git grep -nIE "(sk-…\|sb_secret\|service_role\|eyJhbGciOi…\|BEGIN …PRIVATE KEY\|postgres://user:pw@\|AKIA…\|ghp_…)"` | **No credential material.** All 7 hits are prose (README, `.env.example` comments, this file) warning *against* using the `service_role` key. |
| Every `api_key` / `secret` / `password` mention | `git grep -nIiE "(api[_-]?key\|secret\|passw(or)?d)"` | Only UI copy, the sign-in form's `password` state variable, and docs. No literal values. |
| `.env` files on disk | `find . -name .env -not -path "*/node_modules/*"` | **None.** |
| `.env` ever committed | `git log --all --diff-filter=A --name-only \| grep '\.env$'` | **Never.** |
| Secret-shaped blob in any commit | loop over `git rev-list --all` + `git grep` | **Clean across all history.** |

`SUPABASE_URL` / `SUPABASE_ANON_KEY` are read from `process.env` at runtime
(`backend/src/env.js`, where real env vars win over `backend/.env`), and the
frontend reads `VITE_*` at build time. The anon key is the *publishable* key —
it is designed to ship to the browser, and Row-Level Security scopes every row
to its owner.

## 2. Controls in place

| Control | Where | Verified |
|---|---|---|
| **Rate limiting on every route** | `middleware/rateLimit.js` + `server.js` | `X-RateLimit-Limit/Remaining/Reset` present on `GET /api/health` |
| **5 attempts / 15 min on auth routes** | `app.post('/api/waitlist', authLimiter)` | 6 POSTs → `200`×5 then `429 {"error":"too_many_attempts","retryAfterSec":900}` |
| Write bucket (90/15 min) on run persistence | `app.post('/api/sessions', writeLimiter)` | — |
| General bucket (300/15 min/IP/path) | `app.use(generalLimiter)` | `X-RateLimit-Limit: 300` |
| Bounded limiter store (20k ceiling + sweep) | `rateLimit.js` | prevents memory exhaustion via key churn |
| **`trust proxy` is a bounded hop count** | `server.js`, `TRUST_PROXY` (default 1) | 6 signups with a *rotating* fake `X-Forwarded-For` + same true IP → 6th returns `429` (all keyed to the true IP) |
| Input sanitization on every route | `middleware/sanitize.js` | see §3 |
| Body-size guard + 1 MB JSON limit | `security.js`, `server.js` | 3 MB POST → `413` |
| Malformed / wrong-shape JSON | `middleware/error.js` | `{bad` → `400 invalid_json`; `[1,2,3]` → `400 invalid_payload` |
| Security headers | `security.js` | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `CSP: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`, `Cache-Control: no-store`, `Cross-Origin-Resource-Policy: same-origin` |
| Socket timeouts (slow-loris) | `server.js` | `requestTimeout` 30 s, `headersTimeout` 35 s, `keepAliveTimeout` 10 s |
| CORS allowlist + preflight caching | `server.js`, `CORS_ORIGIN`, `CORS_MAX_AGE` | allowed origin → preflight `204` + `Access-Control-Allow-Headers: content-type,x-guest-id,authorization`; `Origin: https://evil.example.com` → `403 origin_not_allowed` |
| WebSocket guards | `ws/race.js` | `maxPayload` 64 KB, ≤6 sockets/IP, ≤30 rooms/IP/15 min, 240 msg/min token bucket, Origin allowlist |
| Leaderboards: server-writes-only | `store/leaderboardStore.js` + migration | anon can `SELECT`, anon `INSERT` → `permission denied` (real Postgres) |

## 3. Input handling

`middleware/sanitize.js` is the single choke point. Applied to every route.

| Input | Treatment | Verified |
|---|---|---|
| Strings | control chars stripped, length-capped | `mode` ≤24, `snippetId` ≤40, `title` ≤80, `source` ≤120, `operator` ≤24 |
| Numbers | coerced **and clamped** | `wpm:1e30, accuracy:-5, chars:99999999` stored as `600 / 0 / 1000000` |
| Stats maps | rebuilt key-by-key; ≤128–400 keys; key ≤8 chars | `charStats` with `__proto__` / `constructor` / `prototype` → stored keys `["a"]` only |
| Prototype pollution | forbidden keys rejected on the **raw** key, before truncation | `Object.prototype` unchanged after the attack payload |
| Keystroke timings | ≤2000 entries, `t` ∈ [0, 86400] | `[{"t":"abc","n":"x"}]` → `[{"t":0,"n":1}]` |
| Query params | typed, bounded, never NaN | `limit` clamped, `offset` ≥0, `cursor` must be finite |
| Body shape | must be a plain object | top-level array → `400` |
| Email | strict regex + 200-char cap + case-fold | `not-an-email` → `400 VALID EMAIL REQUIRED` |
| `X-Guest-Id` | UUID-shaped, `..` and `/` rejected, checked **before** it reaches a path | `../../../../etc/passwd` created no file |
| WS frames | ≤64 KB, type ≤24 chars, non-object rejected, `chars` clamped [0, 100000], durations whitelisted `{0,30,60,90}` | — |

A note on the forbidden-key check: it deliberately runs on the **raw** key.
Checking after truncation would let `__proto__` become `__proto_` and slip
through as an ordinary key — harmless, but sloppy, and it was fixed.

## 4. Remaining vulnerabilities

Listed honestly. None are regressions; all are either deployment
responsibilities or accepted trade-offs.

1. **The in-memory rate limiter is per-process.** Behind a load balancer with
   multiple Node instances each has its own counters, so an attacker can spread
   attempts across them. Swap the store in `rateLimit.js` for Redis / Upstash
   for a scaled deploy. — *Low (mitigated on single-instance).*

2. **CORS defaults to `*` when `CORS_ORIGIN` is unset.** The API is stateless
   (Bearer JWT, no cookies), so a wildcard cannot leak a signed-in user's rows
   to another origin — but any site can call the public endpoints. Set
   `CORS_ORIGIN=https://your-frontend.vercel.app` in production. The server logs
   a warning at boot when it is unset. — *Low.*

3. **`TRUST_PROXY` must match your topology.** The default (`1`) is correct
   behind one proxy. If you ever expose the API directly, set `TRUST_PROXY=0`,
   or a client can forge `X-Forwarded-For`. — *Low, but a real footgun.*

4. **Supabase Auth rate limiting lives in Supabase, not here.** Login/signup go
   browser → Supabase directly, so the 5/15-min bucket cannot throttle them.
   Enable **Auth rate limiting** and CAPTCHA under *Authentication →
   Protection*. — *Medium (brute-force surface).*

5. **The leaderboard is world-writable only via this server, and that is the
   whole design.** It requires `SUPABASE_SERVICE_ROLE_KEY` in the **backend**
   env. If that key ever reaches a `VITE_*` variable or the frontend bundle,
   anyone can forge scores. It is not in the repo and must stay out. —
   *Informational until configured.*

6. **Guest identity is a localStorage device id.** Clearing site data starts a
   fresh guest, and a user can mint new ids to post extra leaderboard entries.
   The accuracy gate (≥90%), the WPM clamp (≤600), the DB check constraints and
   the write rate limit bound the damage, but a determined user can still
   occupy several leaderboard slots. Real anti-abuse needs accounts. —
   *Low–Medium (accepted: it is a typing game).*

7. **Client-reported stats are trusted.** WPM/accuracy come from the browser.
   Unavoidable without server-side replay verification. — *Informational.*

8. **No HSTS, no CSRF tokens.** HSTS must be set at the TLS proxy
   (Vercel/Render). CSRF is largely moot: the API uses a stateless Bearer JWT
   with no ambient cookies. Note the WS handshake only checks `Origin` when
   `CORS_ORIGIN` is set. — *Low.*

9. **`node_modules/` is tracked in Git** (11,494 of 11,626 tracked files). Not a
   secret leak, but it bloats the repo to ~22 MB of `.git` and makes review
   noisy. Untracking it is a ~11.5k-file diff **and** would break the deploy if
   your host installs nothing and relies on the committed tree — so it was left
   alone deliberately. Check your Render build command first. — *Low.*

## 5. How to re-run the verification

```bash
cd backend && PORT=3199 node server.js &
B=http://127.0.0.1:3199
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code} " -X POST $B/api/waitlist \
  -H 'Content-Type: application/json' -d "{\"email\":\"p$i@example.com\"}"; done; echo
#  → 200 200 200 200 200 429
curl -s -w " %{http_code}\n" -X POST $B/api/sessions -H 'Content-Type: application/json' -d '{bad'
head -c 3000000 /dev/zero | tr '\0' a > /tmp/big; curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST $B/api/sessions -H 'Content-Type: application/json' --data-binary @/tmp/big
```
