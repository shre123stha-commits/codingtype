const MAP = {
  idle: { label: 'STANDBY', dot: 'bg-faint', text: 'text-dim', ring: 'border-edge' },
  running: { label: 'ACTIVE', dot: 'bg-accent animate-pulse-soft', text: 'text-accent', ring: 'border-accent/50' },
  paused: { label: 'PAUSED', dot: 'bg-pulse animate-pulse-soft', text: 'text-pulse', ring: 'border-pulse/50' },
  finished: { label: 'COMPLETE', dot: 'bg-good', text: 'text-good', ring: 'border-good/40' }
};

export default function StatusBadge({ status }) {
  const cfg = MAP[status] || MAP.idle;
  return (
    <span className={`inline-flex items-center gap-2 border ${cfg.ring} bg-panel px-2.5 py-1`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      <span className={`text-[10px] font-semibold tracking-[0.2em] ${cfg.text}`}>{cfg.label}</span>
    </span>
  );
}
