import { useCallback, useEffect, useRef, useState } from 'react';

import { api, fetchCatalog } from '../utils/api.js';
import { guestTag } from '../utils/guestId.js';
import { wsUrl } from '../utils/env.js';
import { track } from '../utils/analytics.js';
import { SNIPPETS } from '../data/snippets.js';
import { ghostPointsFrom } from '../utils/ghostRace.js';
import { useGameStore } from '../store/gameStore.js';

export function useDaily() {
  const [data, setData] = useState(null);
  const dataRef = useRef(null);
  dataRef.current = data;
  const refresh = useCallback(() => {
    api
      .daily()
      .then(setData)
      .catch(() => {
        /* keep whatever we had; self-heal below retries until the API is back */
      });
  }, []);
  // initial fetch + self-heal: while no data is on screen, retry every 5s
  // (page loaded while the API was down must NOT stick on "SYNCING…")
  useEffect(() => {
    if (data) return;
    refresh();
    const id = setInterval(() => {
      if (dataRef.current) clearInterval(id);
      else refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [data, refresh]);
  // re-fetch the moment a run completes so streak / finished-so-far update live
  // (delayed a beat so the session POST lands before we read the leaderboard)
  const lastRunId = useGameStore((s) => s.lastRun?.id);
  useEffect(() => {
    if (!lastRunId) return;
    const id = setTimeout(refresh, 1500);
    return () => clearTimeout(id);
  }, [lastRunId, refresh]);
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
    if (!apiOnline || !lastRun) return;
    if (postedRunIds.has(lastRun.id)) return;
    postedRunIds.add(lastRun.id);
    api
      .saveSession({ ...lastRun, operator: operatorName() })
      .then((res) => {
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
  const setRaceGhost = useGameStore((s) => s.setRaceGhost);
  useEffect(() => {
    if (!snippetId || !REPO_ID.test(snippetId)) {
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
  }, [snippetId, lastRunId, setRaceGhost]);
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

export function useCatalog() {
  const setCatalog = useGameStore((s) => s.setCatalog);
  const setApiOnline = useGameStore((s) => s.setApiOnline);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        await api.health();
        // The catalog endpoint is paginated (100/page); walk it so the engine
        // still gets every language/mode. One request today, correct forever.
        const snippets = await fetchCatalog();
        if (!cancelled) {
          setCatalog(snippets, 'api');
          setApiOnline(true);
          return true;
        }
        return false;
      } catch {
        if (!cancelled) {
          setCatalog(SNIPPETS.map(summarizeLocal), 'local');
          setApiOnline(false);
        }
        return false;
      }
    };

    load();
    // self-heal: if we booted offline, retry the API link every 5s (offline only —
    // no polling load while healthy)
    const id = setInterval(() => {
      if (!cancelled && useGameStore.getState().catalogSource === 'local') load();
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
  const [data, setData] = useState(null);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const refresh = useCallback(() => {
    return api
      .leaderboard()
      .then((d) => {
        setData(d);
        setUpdatedAt(Date.now());
        return d;
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 20000);

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
            if (msg.type === 'leaderboard') refresh();
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
