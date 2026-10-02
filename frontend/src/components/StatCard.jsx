export default function StatCard({ label, value, unit, tone = 'ink', hint }) {
  const toneCls = {
    ink: 'text-ink',
    amber: 'text-accent',
    cyan: 'text-pulse',
    blood: 'text-blood',
    dim: 'text-dim'
  }[tone];
  return (
    <div className="min-w-0 border border-edge bg-panel2/60 px-2.5 py-2.5 sm:px-3">
      <div className="hud-label mb-1 truncate" title={label}>
        {label}
      </div>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5">
        <span className={`shrink-0 whitespace-nowrap text-lg font-bold leading-none tabular-nums ${toneCls}`}>{value}</span>
        {unit ? (
          <span className="shrink-0 whitespace-nowrap text-[8px] font-semibold tracking-[0.1em] text-dim">
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? <div className="mt-1 break-words text-[9px] leading-relaxed text-faint">{hint}</div> : null}
    </div>
  );
}
