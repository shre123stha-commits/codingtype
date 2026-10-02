import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

import {
  api,
  fetchCatalog,
  invalidateLeaderboardCache,
  prefetchLeaderboard,
  readCachedLeaderboard
} from '../utils/api.js';
import { guestTag } from '../utils/guestId.js';
import { wsUrl } from '../utils/env.js';
import { track } from '../utils/analytics.js';
import { SNIPPETS } from '../data/snippets.js';
import { ghostPointsFrom } from '../utils/ghostRace.js';
import { useGameStore } from '../store/gameStore.js';
// Same module the API uses to pick the daily target, so the client's local
// derivation can never drift from the server's answer.
import { dailySnippet, todayStr } from '../../../shared/daily.js';

// ── Daily challenge ────────────────────────────────────────────────────────
// The daily target is a pure function of the date and the bundled catalog, so
// the browser can derive it with zero network — the same FNV-1a pick the server
// makes (shared/daily.js, over the same ordered snippet list). The card is
// therefore fully rendered on first paint, and the API is only asked for the
// two things it alone knows: this operator's streak and today's finishing
// times. `local: true` marks the not-yet-personalized half.
function localDaily() {
  const sn = dailySnippet(todayStr());
  return {
    date: todayStr(),
    snippetId: sn.id,
    title: sn.title,
    source: sn.source,
    language: sn.language,
    mode: sn.mode,
    streak: 0,
    myRuns: 0,
    top: [],
    local: true
  };
}

// Module-scoped so every consumer shares ONE request and ONE snapshot: the
// control deck, RACE and FLASH CARDS each call useDaily(), which used to mean
// three identical /api/daily round trips on the same page.
let dailySnapshot = null;
let dailyRequest = null;
let dailyRetry = null;
let dailyAttempts = 0;
let derivedFor = null; // local date the local fallback was derived for
const dailyListeners = new Set();

function currentDaily() {
  const today = todayStr();
  // Re-derive when the local day rolls over (a tab left open past midnight).
  // A server answer is never discarded for a date mismatch — the API's clock
  // decides the challenge, and it may sit in a different timezone than this
  // browser, so its date is legitimately not ours.
  if (!dailySnapshot || derivedFor !== today) {
    dailySnapshot = localDaily();
    derivedFor = today;
  }
  return dailySnapshot;
}

function publishDaily(next) {
  dailySnapshot = next;
  for (const listener of dailyListeners) listener();
}

// Backs off instead of hammering: 3s, then ~5s, 8s … capped at 30s, up to 10
// tries. Mounting again (or finishing a run) resets the budget and refetches.
function scheduleDailyRetry() {
  if (dailyRetry || !dailyListeners.size || dailyAttempts >= 10) return;
  const delay = Math.min(30_000, 3000 * 1.6 ** dailyAttempts);
  dailyRetry = setTimeout(() => {
    dailyRetry = null;
    fetchDaily();
  }, delay);
}

// A settled answer stays fresh enough for a few seconds, so the control deck,
// RACE and FLASH CARDS mounting one after another share a single request
// instead of firing their own copy.
const DAILY_MIN_GAP_MS = 10_000;
let dailyLastAttempt = 0;

function fetchDaily({ force = false } = {}) {
  if (dailyRequest) return dailyRequest;
  if (!force && Date.now() - dailyLastAttempt < DAILY_MIN_GAP_MS) return Promise.resolve(null);
  dailyLastAttempt = Date.now();
  dailyRequest = api
    .daily()
    .then((d) => {
      dailyAttempts = 0;
      if (d && d.snippetId) publishDaily({ ...d, local: false });
      return d;
    })
    .catch(() => {
      dailyAttempts += 1;
      scheduleDailyRetry();
      return null;
    })
    .finally(() => {
      dailyRequest = null;
    });
  return dailyRequest;
}

export function prefetchDaily() {
  return fetchDaily();
}

export function refreshDaily() {
  dailyAttempts = 0;
  return fetchDaily({ force: true });
}

export function useDaily() {
  const [data, setData] = useState(currentDaily);

  useEffect(() => {
    const listener = () => setData(currentDaily());
    dailyListeners.add(listener);
    listener();
    // Deliberately NOT gated on apiOnline: waiting for the health probe to
    // resolve put the daily a whole round trip (two, on a cold API) behind
    // first paint. It self-heals with backoff while the API is unreachable.
    fetchDaily();
    return () => {
      dailyListeners.delete(listener);
    };
  }, []);

  // re-fetch the moment a run completes so streak / finished-so-far update live
  // (delayed a beat so the session POST lands before we read the daily)
  const lastRunId = useGameStore((s) => s.lastRun?.id);
  useEffect(() => {
    if (!lastRunId) return undefined;
    const id = setTimeout(refreshDaily, 1500);
    return () => clearTimeout(id);
  }, [lastRunId]);

  return data;
}

// The bundled catalog carries the code, so the daily preview and "RUN DAILY"
// work with zero network instead of waiting for a by-id fetch.
export function localSnippetById(id) {
  const found = SNIPPETS.find((s) => s.id === id);
  return found ? summarizeLocal(found) : null;
}

export function usePbestSnippets() {
  const [snippets, setSnippets] = useState(null);
  const refresh = useCallback(() => {
    api
      .pbestSnippets()
      .then((d) => setSnippets(d.snippets))
      .catch(() => setSnippets([]));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return snippets;
}

export function useAnalytics() {
  const [keyStats, setKeyStats] = useState(null);
  const [fingerStats, setFingerStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [pbests, setPbests] = useState([]);
  useEffect(() => {
    api.keystats().then((d) => setKeyStats(d.chars)).catch(() => {});
    api.fingerstats().then((d) => setFingerStats(d.fingers)).catch(() => {});
    api.sessions(24).then((d) => setSessions(d.sessions)).catch(() => {});
    api.pbests().then((d) => setPbests(d.pbests)).catch(() => {});
  }, []);
  return { keyStats, fingerStats, sessions, pbests };
}

// module-scoped: survives view switches so a finished run is posted exactly
// once, no matter which view it was completed in (StrictMode-safe)
const postedRunIds = new Set();

// Persists finished runs to the session store. Previously lived inside
// HistoryPanel — but that only mounted on TRAIN/ANALYTICS, so it has to be
// app-level: the home page no longer shows the session log.
// Who a run is credited to on the leaderboards: the operator's chosen name,
// else their account handle, else a device tag so two guests are never both
// just "GUEST".
function operatorName() {
  const st = useGameStore.getState();
  const name = String(st.profileName || '').trim();
  if (name) return name;
  if (st.authUser) return String(st.authUser).split('@')[0];
  return guestTag();
}

export function useSessionPost() {
  const apiOnline = useGameStore((s) => s.apiOnline);
  const lastRun = useGameStore((s) => s.lastRun);
  const setLbPlacement = useGameStore((s) => s.setLbPlacement);
  useEffect(() => {
    if (apiOnline !== true || !lastRun) return;
    if (postedRunIds.has(lastRun.id)) return;
    postedRunIds.add(lastRun.id);
    api
      .saveSession({ ...lastRun, operator: operatorName() })
      .then((res) => {
        if (res?.leaderboard?.placements?.length) invalidateLeaderboardCache();
        if (res?.leaderboard?.best) setLbPlacement(res.leaderboard.best);
      })
      .catch(() => {});
    track('session_complete', {
      mode: lastRun.mode,
      language: lastRun.language,
      wpm: lastRun.wpm,
      accuracy: lastRun.accuracy
    });
  }, [apiOnline, lastRun, setLbPlacement]);
}

const REPO_ID = /^(py|js|java|cpp|rs|sql)-/;

export function useGhost() {
  const snippetId = useGameStore((s) => s.snippet?.id);
  const lastRunId = useGameStore((s) => s.lastRun?.id);
  const apiOnline = useGameStore((s) => s.apiOnline);
  const setRaceGhost = useGameStore((s) => s.setRaceGhost);
  useEffect(() => {
    if (apiOnline !== true || !snippetId || !REPO_ID.test(snippetId)) {
      setRaceGhost(null);
      return;
    }
    let live = true;
    api
      .pbest(snippetId)
      .then((d) => {
        if (!live) return;
        const points = ghostPointsFrom(d.charTimes);
        if (!points.length) {
          setRaceGhost(null);
          return;
        }
        setRaceGhost({ points, total: points[points.length - 1].chars, timeSec: d.timeSec, wpm: d.wpm });
      })
      .catch(() => {
        if (live) setRaceGhost(null);
      });
    return () => {
      live = false;
    };
  }, [snippetId, lastRunId, apiOnline, setRaceGhost]);
}

function summarizeLocal(s) {
  return {
    id: s.id,
    language: s.language,
    mode: s.mode,
    title: s.title,
    source: s.source,
    chars: s.code.length,
    lines: s.code.split('\n').length,
    friction: (s.code.match(/[{}[\];.,:=<>!&|+\-*\/]/g) || []).length,
    code: s.code // local mode keeps the code inline so typing works offline
  };
}

// The bundled catalog is authoritative enough to start practicing immediately.
// Hydrating the API summary afterwards is an enhancement, not a blocker for
// first paint or for the API status badge.
const LOCAL_CATALOG = SNIPPETS.map(summarizeLocal);

export function useCatalog() {
  const setCatalog = useGameStore((s) => s.setCatalog);
  const setApiOnline = useGameStore((s) => s.setApiOnline);

  // Run before paint: the control deck and typing target never wait on the
  // network. This also gives an offline visitor a fully working app instantly.
  useLayoutEffect(() => {
    setCatalog(LOCAL_CATALOG, 'local');
  }, [setCatalog]);

  useEffect(() => {
    let cancelled = false;
    let connecting = false;
    let warmed = false;

    const connect = () => {
      if (cancelled || connecting) return;
      connecting = true;
      let settled = 0;
      let reachable = false;

      // Warm the two side panels NOW, on the same tick as the health probe.
      // They used to wait for health to resolve, which serialized them a full
      // round trip (two, when the API is cold-starting) behind everything
      // else. The BOARDS tab and the daily card consume these same requests,
      // so they open with real data instead of a fresh network wait.
      // Once only: while the API is unreachable this loop retries every 5s,
      // and each subsystem already backs off on its own (daily) or polls
      // (boards) — re-warming on every probe would just double the traffic.
      if (!warmed) {
        warmed = true;
        prefetchLeaderboard();
        prefetchDaily();
      }

      const markLive = () => {
        if (cancelled || reachable) return;
        reachable = true;
        setApiOnline(true);
      };
      const finish = () => {
        settled += 1;
        if (settled !== 2) return;
        connecting = false;
        if (!reachable && !cancelled) setApiOnline(false);
      };

      // Do these in parallel. The old health → catalog waterfall held the
      // badge at LOCAL until both round trips had finished. Either successful
      // public endpoint proves the API is live; catalog hydration can finish
      // independently after the practice UI is already usable.
      api.health().then(markLive).catch(() => {}).finally(finish);
      fetchCatalog()
        .then((snippets) => {
          if (snippets.length && !cancelled) setCatalog(snippets, 'api');
          if (snippets.length) markLive();
        })
        .catch(() => {})
        .finally(finish);
    };

    connect();
    // self-heal only while the API is actually unavailable. A catalog refresh
    // is no longer a prerequisite for a LIVE link, so a slow catalog cannot
    // make the badge regress to LOCAL.
    const id = setInterval(() => {
      if (!cancelled && useGameStore.getState().apiOnline !== true) connect();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [setCatalog, setApiOnline]);
}

// ── Leaderboards ───────────────────────────────────────────────────────────
// All 10 boards in one request, then kept live two ways:
//   • a WebSocket push the instant anyone anywhere posts a top-10 score
//   • a 20s poll, which is what keeps this correct with no socket open and
//     across multiple API instances (the server's score bus is per-process)
export function useLeaderboards() {
  const [data, setData] = useState(() => readCachedLeaderboard()?.data || null);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => readCachedLeaderboard()?.updatedAt || null);

  const refresh = useCallback(({ force = false } = {}) => {
    return api
      .leaderboard({ force })
      .then((d) => {
        setData(d);
        setUpdatedAt(Date.now());
        return d;
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    // Usually resolves from the startup warm-up cache. Polls and live score
    // events deliberately bypass it so visible data is always current.
    refresh();
    const poll = setInterval(() => refresh({ force: true }), 20000);

    let ws = null;
    let closed = false;
    let retry = null;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(wsUrl());
        ws.onopen = () => {
          setLive(true);
          try {
            ws.send(JSON.stringify({ type: 'subscribeLeaderboard' }));
          } catch {
            /* ignore */
          }
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'leaderboard') refresh({ force: true });
          } catch {
            /* ignore malformed frames */
          }
        };
        ws.onclose = () => {
          setLive(false);
          if (!closed) retry = setTimeout(connect, 5000);
        };
        ws.onerror = () => {
          try {
            ws.close();
          } catch {
            /* already closed */
          }
        };
      } catch {
        if (!closed) retry = setTimeout(connect, 5000);
      }
    };
    connect();

    return () => {
      closed = true;
      clearInterval(poll);
      if (retry) clearTimeout(retry);
      if (ws) {
        try {
          ws.close();
        } catch {
          /* already closed */
        }
      }
    };
  }, [refresh]);

  return { data, live, updatedAt, refresh };
}
