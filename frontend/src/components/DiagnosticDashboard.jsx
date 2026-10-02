import BenchmarkBar from './BenchmarkBar.jsx';
import ShareCard from './ShareCard.jsx';
import StatCard from './StatCard.jsx';
import StutterTimeline from './StutterTimeline.jsx';
import SymbolMatrix from './SymbolMatrix.jsx';
import VelocityChart from './VelocityChart.jsx';
import HudCard from './HudCard.jsx';
import { useGameStore } from '../store/gameStore.js';

export default function DiagnosticDashboard() {
  const lastRun = useGameStore((s) => s.lastRun);
  const restart = useGameStore((s) => s.restart);
  const loadSnippet = useGameStore((s) => s.loadSnippet);
  const snippet = useGameStore((s) => s.snippet);
  const raceGhost = useGameStore((s) => s.raceGhost);
  const theme = useGameStore((s) => s.theme);

  if (!lastRun) return null;
  const { stats } = lastRun;
  const ghostBeaten =
    lastRun.daily || !raceGhost
      ? null
      : stats.timeSec < raceGhost.timeSec;

  return (
    <div className="space-y-4">
      <HudCard label="TELEMETRY DUMP // TEST COMPLETE" corners="amber" className="shadow-glow-amber" bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <div>
            <div className="hud-label mb-1">SUSTAINED</div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums text-accent" style={{ textShadow: '0 0 24px rgb(var(--c-accent) / 0.35)' }}>
                {stats.wpm}
              </span>
              <span className="text-[11px] font-semibold tracking-[0.22em] text-dim">WPM</span>
            </div>
          </div>
          <div className="h-12 w-px bg-edge" />
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-6">
            <StatCard label="CPM" value={stats.cpm} unit="CH/MIN" tone="ink" />
            <StatCard label="RAW" value={stats.rawWpm} unit="WPM" tone="cyan" />
            <StatCard label="ACCURACY" value={`${stats.accuracy}%`} tone={stats.accuracy >= 95 ? 'ink' : 'blood'} />
            <StatCard label="CONSISTENCY" value={stats.consistency} unit="/100" tone={stats.consistency >= 70 ? 'ink' : 'blood'} />
            <StatCard label="DURATION" value={stats.timeSec.toFixed(1)} unit="SEC" tone="dim" />
            <StatCard label="ERRORS" value={stats.errors} hint={`${stats.backspaces} backspaces`} tone={stats.errors ? 'blood' : 'ink'} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-edge px-5 py-3">
          <span className="hud-label">TARGET</span>
          <span className="text-[11px] text-ink">{lastRun.snippet.source}</span>
          <span className="border border-edge px-1.5 py-0.5 text-[9px] tracking-[0.18em] text-dim">
            {lastRun.mode.toUpperCase()}
          </span>
          <span className="border border-edge px-1.5 py-0.5 text-[9px] tracking-[0.18em] text-dim">
            {lastRun.language.toUpperCase()}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={restart} className="chip chip-on-amber flex items-center gap-1.5 py-2">
              <span className="text-[13px] leading-none" aria-hidden>
                ↻
              </span>
              RUN AGAIN
            </button>
            <button
              type="button"
              onClick={() => snippet && loadSnippet(snippet)}
              className="chip chip-on-cyan py-2"
            >
              NEW TARGET
            </button>
            <ShareCard run={lastRun} theme={theme} />
          </div>
        </div>
        {ghostBeaten !== null ? (
          <div
            className={`mx-5 mb-3 border px-3 py-2 text-[10px] font-semibold tracking-[0.16em] ${
              ghostBeaten
                ? 'border-pulse/50 bg-pulse/10 text-pulse'
                : 'border-blood/50 bg-blood/10 text-blood'
            }`}
          >
            {ghostBeaten
              ? `✓ GHOST BEATEN — YOUR PREVIOUS BEST WAS ${raceGhost.timeSec.toFixed(1)}s`
              : `GHOST WINS — PREVIOUS BEST ${raceGhost.timeSec.toFixed(1)}s, YOU ${stats.timeSec.toFixed(1)}s`}
          </div>
        ) : null}
        {lastRun.daily ? (
          <div className="mx-5 mb-3 border border-accent/50 bg-accent/10 px-3 py-2 text-[10px] font-semibold tracking-[0.16em] text-accent">
            🏆 DAILY CHALLENGE COMPLETE
          </div>
        ) : null}
        {lastRun.mode === 'interview' ? <BenchmarkBar snippetId={lastRun.snippet.id} you={stats.timeSec} /> : null}
      </HudCard>

      <VelocityChart samples={lastRun.samples} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SymbolMatrix symbolStats={lastRun.symbolStats} />
        <StutterTimeline eventLog={lastRun.eventLog} lineStats={lastRun.lineStats} />
      </div>
    </div>
  );
}
