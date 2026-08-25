import { useMemo } from 'react';
import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import HudCard from './HudCard.jsx';
import { useGameStore } from '../store/gameStore.js';
import { stutterBuckets } from '../utils/metrics.js';
import { chartPalette } from '../utils/themes.js';

function TimelineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="border border-edge2 bg-obsidian/95 px-3 py-2 text-[10px] tabular-nums">
      <div className="hud-label mb-1">T+{Math.round(label * 10) / 10}s</div>
      <div className="text-dim">
        STUTTER <span className="font-bold text-accent">{row.cost.toFixed(2)}s</span>
      </div>
      <div className="text-dim">
        ERRS <span className="font-bold text-blood">{row.errors}</span> · BKSP{' '}
        <span className="font-bold text-pulse">{row.backspaces}</span>
      </div>
    </div>
  );
}

export default function StutterTimeline({ eventLog, lineStats }) {
  const snippet = useGameStore((s) => s.snippet);
  const theme = useGameStore((s) => s.theme);
  const pal = chartPalette(theme);

  const buckets = useMemo(() => stutterBuckets(eventLog), [eventLog]);

  const blame = useMemo(() => {
    if (!snippet) return [];
    return Object.entries(lineStats)
      .map(([line, st]) => ({ line: Number(line), ...st }))
      .filter((row) => row.e > 0 || row.p > 0 || row.b > 0)
      .sort((a, b) => b.e * 2 + b.p + b.b * 2 - (a.e * 2 + a.p + a.b * 2))
      .slice(0, 5);
  }, [lineStats, snippet]);

  return (
    <HudCard label="STUTTER TIMELINE · SESSION REPLAY" right={<span className="hud-label">GAP &gt; 850MS</span>}>
      <ResponsiveContainer width="100%" height={170}>
        <ComposedChart data={buckets} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <XAxis
            dataKey="t"
            tick={{ fill: pal.tick, fontSize: 10, fontFamily: 'JetBrains Mono' }}
            stroke={pal.axis}
            tickLine={false}
            unit="s"
          />
          <YAxis
            tick={{ fill: pal.tick, fontSize: 10, fontFamily: 'JetBrains Mono' }}
            stroke={pal.axis}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<TimelineTooltip />} cursor={{ fill: pal.cursorFill }} />
          <Bar dataKey="cost" name="stutter" fill={pal.bar} maxBarSize={14} />
          <Line
            type="monotone"
            dataKey="backspaces"
            name="backspaces"
            stroke={pal.backspace}
            strokeWidth={1.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-3 border-t border-edge/70 pt-2">
        <div className="hud-label mb-2">LINE BLAME · TOP FRICTION ZONES</div>
        {blame.length ? (
          <div className="space-y-1.5">
            {blame.map((row) => {
              const text = snippet.lines[row.line]
                ? snippet.code.slice(snippet.lines[row.line].start, snippet.lines[row.line].end)
                : '';
              const flat = text.trim();
              return (
                <div key={row.line} className="flex items-center gap-2 text-[10px]">
                  <span className="w-8 shrink-0 font-bold tabular-nums text-accent">
                    L{row.line + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-dim">{flat.slice(0, 52) || '(blank)'}</span>
                  <span className="shrink-0 tabular-nums text-faint">
                    E<span className={row.e ? 'text-blood' : ''}>{row.e}</span>
                    {'  '}P{row.p.toFixed(1)}s
                    {'  '}B{row.b}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-2 text-[10px] tracking-[0.2em] text-faint">
            NO FRICTION ZONES DETECTED — CLEAN RUN
          </div>
        )}
      </div>
    </HudCard>
  );
}
