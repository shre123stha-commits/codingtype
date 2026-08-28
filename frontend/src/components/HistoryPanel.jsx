import { useCallback, useEffect, useState } from 'react';

import HudCard from './HudCard.jsx';
import { api } from '../utils/api.js';
import { useGameStore } from '../store/gameStore.js';

const MODE_LABEL = { algorithm: 'ALG', repo: 'REPO', sprint: 'SPR', interview: 'INT' };

function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function HistoryPanel({ limit = 12 }) {
  const apiOnline = useGameStore((s) => s.apiOnline);
  const lastRun = useGameStore((s) => s.lastRun);
  const [sessions, setSessions] = useState([]);
  const [pbests, setPbests] = useState([]);
  const [tab, setTab] = useState('sessions');

  const refresh = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([api.sessions(limit), api.pbests()]);
      setSessions(s.sessions);
      setPbests(p.pbests);
    } catch {
      /* offline mode */
    }
  }, [limit]);

  useEffect(() => {
    if (!apiOnline) return;
    refresh();
  }, [apiOnline, refresh]);

  // display-only: a finished run re-pulls the table (persistence itself is
  // owned by useSessionPost in App, which posts from any view)
  useEffect(() => {
    if (!apiOnline || !lastRun) return;
    refresh();
  }, [lastRun, apiOnline, refresh]);

  if (!apiOnline) {
    return (
      <HudCard label="SESSION LOG">
        <div className="py-8 text-center text-[10px] leading-relaxed tracking-[0.18em] text-faint">
          LINK OFFLINE
          <br />
          <span className="text-dim">TELEMETRY PERSISTENCE UNAVAILABLE</span>
        </div>
      </HudCard>
    );
  }

  return (
    <HudCard
      label="SESSION LOG"
      right={
        <div className="flex gap-1">
          {['sessions', 'pbests'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`chip ${tab === t ? 'chip-on-cyan' : 'chip-off'} !px-2 !py-0.5 !text-[9px]`}
            >
              {t === 'sessions' ? 'LOG' : 'PBs'}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'sessions' ? (
        sessions.length ? (
          <table className="w-full text-left">
            <thead>
              <tr className="hud-label border-b border-edge">
                <th className="pb-1.5 pr-2 font-semibold">TIME</th>
                <th className="pb-1.5 pr-2 font-semibold">LANG</th>
                <th className="pb-1.5 pr-2 font-semibold">MODE</th>
                <th className="pb-1.5 pr-2 text-right font-semibold">WPM</th>
                <th className="pb-1.5 text-right font-semibold">ACC</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-edge/40 last:border-b-0">
                  <td className="py-1.5 pr-2 text-[10px] tabular-nums text-dim">{fmtTime(s.createdAt)}</td>
                  <td className="py-1.5 pr-2 text-[10px] text-ink">{s.language.toUpperCase()}</td>
                  <td className="py-1.5 pr-2 text-[10px] uppercase text-dim">{MODE_LABEL[s.mode] || s.mode}</td>
                  <td className="py-1.5 pr-2 text-right text-[11px] font-bold tabular-nums text-accent">{s.wpm}</td>
                  <td className="py-1.5 text-right text-[10px] tabular-nums text-dim">{s.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-8 text-center text-[10px] tracking-[0.2em] text-faint">NO SESSIONS RECORDED</div>
        )
      ) : pbests.length ? (
        <div className="space-y-2">
          {pbests.map((p) => (
            <div key={`${p.mode}-${p.language}`} className="border border-edge bg-panel2/50 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-[0.18em] text-pulse">
                  {p.language.toUpperCase()} · {MODE_LABEL[p.mode] || p.mode}
                </span>
                <span className="text-lg font-bold tabular-nums text-accent">{p.wpm}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[9px] text-faint">
                <span className="truncate pr-2">{p.snippetTitle}</span>
                <span className="shrink-0 tabular-nums">
                  RAW {p.rawWpm} · {p.accuracy}%
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-[10px] tracking-[0.2em] text-faint">NO RECORDS YET</div>
      )}
    </HudCard>
  );
}
