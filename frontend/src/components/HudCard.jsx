import Corners from './Corners.jsx';

export default function HudCard({ label, right, corners = 'slate', children, className = '', bodyClassName = 'p-4' }) {
  return (
    <section className={`hud-card ${className}`}>
      {corners !== null && <Corners color={corners} />}
      {(label || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-edge px-4 py-2.5">
          {label ? <span className="hud-label">{label}</span> : <span />}
          {right ? <div className="flex items-center gap-2">{right}</div> : null}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
