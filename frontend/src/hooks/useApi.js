import { useCallback, useEffect, useState } from 'react';

import { api } from '../utils/api.js';
import { SNIPPETS } from '../data/snippets.js';
import { ghostPointsFrom } from '../utils/ghostRace.js';
import { useGameStore } from '../store/gameStore.js';

export function useDaily() {
  const [data, setData] = useState(null);
  const refresh = useCallback(() => {
    api.daily().then(setData).catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return data;
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

export function useCatalog() {
  const setCatalog = useGameStore((s) => s.setCatalog);
  const setApiOnline = useGameStore((s) => s.setApiOnline);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.health();
        const res = await api.snippets();
        if (!cancelled) {
          const full = await Promise.all(res.snippets.map((meta) => api.snippet(meta.id)));
          setCatalog(full, 'api');
          setApiOnline(true);
          return;
        }
      } catch {
        if (!cancelled) {
          setCatalog(SNIPPETS, 'local');
          setApiOnline(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setCatalog, setApiOnline]);
}


