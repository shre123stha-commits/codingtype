import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import HudCard from './HudCard.jsx';
import { useGameStore } from '../store/gameStore.js';
import { chartPalette } from '../utils/themes.js';

function TelemetryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-edge2 bg-obsidian/95 px-3 py-2 shadow-glow-cyan">
      <div className="hud-label mb-1">T+{label}s</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-[11px] tabular-nums">
          <span className="h-2 w-2" style={{ background: entry.stroke }} />
          <span className="w-12 text-dim">{entry.name}</span>
          <span className="font-bold text-ink">{entry.value} WPM</span>
        </div>
      ))}
    </div>
  );
}

export default function VelocityChart({ samples }) {
  const theme = useGameStore((s) => s.theme);
  const pal = chartPalette(theme);

  return (
    <HudCard
      label="VELOCITY TELEMETRY"
      corners="cyan"
      right={<span className="hud-label">{samples.length} SAMPLES · 1Hz</span>}
      bodyClassName="p-2"
    >
      {samples.length >= 2 ? (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={samples} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={pal.grid} strokeDasharray="2 5" vertical={false} />
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
            />
            <Tooltip content={<TelemetryTooltip />} cursor={{ stroke: pal.cursor, strokeDasharray: '3 3' }} />
            <Legend
              wrapperStyle={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}
              iconType="plainline"
            />
            <Line
              type="monotone"
              dataKey="wpm"
              name="WPM"
              stroke={pal.wpm}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: pal.wpm }}
            />
            <Line
              type="monotone"
              dataKey="raw"
              name="RAW"
              stroke={pal.raw}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: pal.raw }}
            />
            <Line
              type="monotone"
              dataKey="cpm"
              name="CPM"
              stroke={pal.cpm}
              strokeWidth={1.5}
              strokeDasharray="2 4"
              dot={false}
              activeDot={{ r: 3, fill: pal.cpm }}
            />
            <Line
              type="monotone"
              dataKey="burst"
              name="BURST 5s"
              stroke={pal.burst}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 3, fill: pal.burst }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[260px] items-center justify-center text-[11px] tracking-[0.2em] text-faint">
          INSUFFICIENT SAMPLES FOR TEMPORAL PLOT
        </div>
      )}
    </HudCard>
  );
}
