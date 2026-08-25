import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import HudCard from './HudCard.jsx';
import { chartPalette } from '../utils/themes.js';

export default function TrendChart({ sessions, theme }) {
  const pal = chartPalette(theme);
  const data = (sessions || [])
    .slice(0, 24)
    .reverse()
    .map((s, i) => ({
      run: i + 1,
      wpm: s.wpm,
      cpm: s.cpm || (s.timeSec ? Math.round((s.chars * 60) / s.timeSec) : 0),
      accuracy: s.accuracy
    }));

  if (!data.length) {
    return (
      <HudCard label="VELOCITY TREND" right={<span className="hud-label">LAST 24 RUNS</span>}>
        <div className="py-10 text-center text-[10px] tracking-[0.2em] text-faint">NO RUNS LOGGED YET</div>
      </HudCard>
    );
  }

  return (
    <HudCard label="VELOCITY TREND" right={<span className="hud-label">LAST {data.length} RUNS</span>}>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <XAxis dataKey="run" tick={{ fill: pal.tick, fontSize: 10 }} stroke={pal.axis} />
            <YAxis yAxisId="left" tick={{ fill: pal.tick, fontSize: 10 }} stroke={pal.axis} domain={[0, 'auto']} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: pal.tick, fontSize: 10 }} stroke={pal.axis} width={44} />
            <Tooltip
              contentStyle={{
                background: pal.grid,
                border: `1px solid ${pal.axis}`,
                borderRadius: 0,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11
              }}
              labelStyle={{ color: pal.tick }}
            />
            <Line yAxisId="right" type="monotone" dataKey="cpm" name="CPM" stroke={pal.cpm} strokeDasharray="4 3" dot={false} strokeWidth={1.5} />
            <Line yAxisId="left" type="monotone" dataKey="wpm" name="WPM" stroke={pal.wpm} dot={false} strokeWidth={2} />
            <Line yAxisId="left" type="monotone" dataKey="accuracy" name="ACC%" stroke={pal.burst} dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4 text-[9px] tracking-[0.18em]">
        <span style={{ color: pal.wpm }}>— WPM</span>
        <span style={{ color: pal.cpm }}>--- CPM</span>
        <span style={{ color: pal.burst }}>— ACCURACY</span>
      </div>
    </HudCard>
  );
}
