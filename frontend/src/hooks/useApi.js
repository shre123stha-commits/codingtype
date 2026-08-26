import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../utils/api.js';
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
        const res = await api.snippets();
        if (!cancelled) {
          setCatalog(res.snippets, 'api');
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


