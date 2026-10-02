export default function StatCard({ label, value, unit, tone = 'ink', hint }) {
  const toneCls = {
    ink: 'text-ink',
    amber: 'text-accent',
    cyan: 'text-pulse',
    blood: 'text-blood',
    dim: 'text-dim'
  }[tone];
  return (
    <div className="border border-edge bg-panel2/60 px-3 py-2.5">
      <div className="hud-label mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold tabular-nums ${toneCls}`}>{value}</span>
        {unit ? <span className="text-[10px] font-semibold tracking-[0.18em] text-dim">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-0.5 text-[10px] text-faint">{hint}</div> : null}
    </div>
  );
}
