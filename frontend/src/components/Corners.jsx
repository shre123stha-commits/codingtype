const COLORS = {
  amber: 'border-accent/80',
  cyan: 'border-pulse/70',
  slate: 'border-edge2'
};

function Corner({ color, size, position }) {
  const styles = {
    tl: { top: -1, left: -1, borderBottom: 'none', borderRight: 'none' },
    tr: { top: -1, right: -1, borderBottom: 'none', borderLeft: 'none' },
    bl: { bottom: -1, left: -1, borderTop: 'none', borderRight: 'none' },
    br: { bottom: -1, right: -1, borderTop: 'none', borderLeft: 'none' }
  };
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute border ${COLORS[color]}`}
      style={{ width: size, height: size, ...styles[position] }}
    />
  );
}

export default function Corners({ color = 'slate', size = 12 }) {
  return (
    <>
      <Corner color={color} size={size} position="tl" />
      <Corner color={color} size={size} position="tr" />
      <Corner color={color} size={size} position="bl" />
      <Corner color={color} size={size} position="br" />
    </>
  );
}
