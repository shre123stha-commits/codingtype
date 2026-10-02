import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

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

export function useDaily() {
  const [data, setData] = useState(null);
  const dataRef = useRef(null);
  const apiOnline = useGameStore((s) => s.apiOnline);
  dataRef.current = data;
  const refresh = useCallback(() => {
    api
      .daily()
      .then(setData)
      .catch(() => {
        /* keep whatever we had; self-heal below retries until the API is back */
      });
  }, []);
  // Do not compete with the initial health/catalog probes. The bundled target
  // catalog is ready immediately; once the link is known live we fetch this
  // personalized side panel and retry until it arrives.
  useEffect(() => {
    if (data || apiOnline !== true) return;
    refresh();
    const id = setInterval(() => {
      if (dataRef.current) clearInterval(id);
      else refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [data, apiOnline, refresh]);
  // re-fetch the moment a run completes so streak / finished-so-far update live
  // (delayed a beat so the session POST lands before we read the leaderboard)
  const lastRunId = useGameStore((s) => s.lastRun?.id);
  useEffect(() => {
    if (!lastRunId || apiOnline !== true) return;
    const id = setTimeout(refresh, 1500);
    return () => clearTimeout(id);
  }, [lastRunId, apiOnline, refresh]);
  return data;
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

    const connect = () => {
      if (cancelled || connecting) return;
      connecting = true;
      let settled = 0;
      let reachable = false;

      const markLive = () => {
        if (cancelled || reachable) return;
        reachable = true;
        setApiOnline(true);
        // Warm the public board in the background. The BOARDS tab consumes the
        // same in-flight/cached request, so it opens with data instead of a
        // fresh network wait.
        prefetchLeaderboard();
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
