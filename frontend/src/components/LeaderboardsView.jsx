// LEADERBOARDS — top 10, per category, for both timeframes.
//
// Categories: the DAILY challenge plus one board per DRILL category
// (algorithm / repo / sprint / interview). Timeframes: ALL TIME and TODAY.
// Boards start seeded with 10 sample operators and are replaced by real runs
// as people beat them. Ranked by WPM; a run under 90% accuracy never ranks.
import { useMemo, useState } from 'react';

import HudCard from './HudCard.jsx';
import { useLeaderboards } from '../hooks/useApi.js';
import { BOARDS, BOARD_LABELS, CATEGORIES, CATEGORY_LABELS, MIN_ACCURACY, TOP_N } from '../utils/leaderboardMeta.js';

function Medal({ rank }) {
  if (rank === 1) return <span className="text-[13px]" aria-hidden>🥇</span>;
  if (rank === 2) return <span className="text-[13px]" aria-hidden>🥈</span>;
  if (rank === 3) return <span className="text-[13px]" aria-hidden>🥉</span>;
  return <span className="tabular-nums text-faint">{String(rank).padStart(2, '0')}</span>;
}

function BoardTable({ entries, loading }) {
  if (loading && !entries) {
    return <div className="py-10 text-center text-[10px] tracking-[0.3em] text-faint">LOADING BOARD…</div>;
  }
  if (!entries || !entries.length) {
    return (
      <div className="py-10 text-center text-[10px] leading-relaxed tracking-[0.16em] text-faint">
        NO QUALIFYING RUNS YET
        <br />
        FINISH A RUN AT {MIN_ACCURACY}%+ ACCURACY TO CLAIM #1
      </div>
    );
  }
  return (
    <table className="w-full border-collapse text-[11px]">
      <caption className="sr-only">Top {TOP_N} operators</caption>
      <thead>
        <tr className="hud-label border-b border-edge">
          <th scope="col" className="w-12 px-2 py-2 text-left font-semibold">#</th>
          <th scope="col" className="px-2 py-2 text-left font-semibold">OPERATOR</th>
          <th scope="col" className="w-20 px-2 py-2 text-right font-semibold">WPM</th>
          <th scope="col" className="w-20 px-2 py-2 text-right font-semibold">ACC</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr
            key={e.id || `${e.name}-${i}`}
            className={`border-b border-edge/40 ${e.sample ? 'opacity-60' : ''} ${i === 0 ? 'bg-good/[0.05]' : ''}`}
          >
            <td className="px-2 py-1.5">
              <Medal rank={i + 1} />
            </td>
            <td className="truncate px-2 py-1.5 font-semibold tracking-[0.08em] text-ink">
              {e.name}
              {e.sample ? <span className="ml-1.5 text-[8px] tracking-[0.18em] text-faint">SAMPLE</span> : null}
            </td>
            <td className="px-2 py-1.5 text-right font-bold tabular-nums text-accent">{e.wpm}</td>
            <td className="px-2 py-1.5 text-right tabular-nums text-dim">{e.accuracy}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function LeaderboardsView() {
  const { data, live, updatedAt } = useLeaderboards();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [board, setBoard] = useState(BOARDS[0]);

  const entries = data?.boards?.[category]?.[board] || null;
  const updated = useMemo(
    () => (updatedAt ? new Date(updatedAt).toLocaleTimeString() : '—'),
    [updatedAt]
  );

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 py-6">
      <HudCard
        label="LEADERBOARDS"
        corners="amber"
        right={
          <>
            <span
              className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[9px] tracking-[0.16em] ${
                live ? 'border-good/50 text-good' : 'border-edge text-faint'
              }`}
              title={live ? 'Live — updates the moment anyone posts a score' : 'Polling every 20s'}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse-soft bg-good' : 'bg-faint'}`} />
              {live ? 'LIVE' : 'POLLING'}
            </span>
            <span className="text-[9px] tracking-[0.14em] text-faint" aria-label={`Last updated ${updated}`}>
              {updated}
            </span>
          </>
        }
        bodyClassName="p-4"
      >
        {/* category picker — DAILY + one per drill category */}
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="choose leaderboard category">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`chip !px-3 !py-1 !text-[10px] ${category === c ? 'chip-on-amber' : 'chip-off'}`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {/* timeframe toggle */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="choose timeframe">
          <span className="mr-1 text-[9px] font-semibold tracking-[0.22em] text-faint">TIMEFRAME</span>
          {BOARDS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBoard(b)}
              className={`chip !px-3 !py-1 !text-[10px] ${board === b ? 'chip-on-cyan' : 'chip-off'}`}
            >
              {BOARD_LABELS[b]}
            </button>
          ))}
        </div>

        <div className="border border-edge bg-panel/40">
          <BoardTable entries={entries} loading={!data} />
        </div>

        <p className="mt-3 text-[9px] leading-relaxed tracking-[0.1em] text-faint">
          TOP {TOP_N} · RANKED BY WPM · RUNS BELOW {MIN_ACCURACY}% ACCURACY DO NOT QUALIFY · BEAT AN ENTRY AND IT
          UPDATES HERE FOR EVERYONE, LIVE.
        </p>
      </HudCard>
    </main>
  );
}
