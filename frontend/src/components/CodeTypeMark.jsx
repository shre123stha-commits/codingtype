export default function CodeTypeMark({ compact = false, className = '' }) {
  return (
    <span className={`codetype-mark ${compact ? 'codetype-mark-compact' : ''} ${className}`} aria-label="CodeType">
      <svg className="codetype-mark-icon" viewBox="0 0 36 36" role="img" aria-hidden="true">
        <rect x="1.5" y="1.5" width="33" height="33" rx="10" className="codetype-mark-frame" />
        <path d="M11 12.5 6.5 18l4.5 5.5M25 12.5l4.5 5.5-4.5 5.5M21 9.5 15 26.5" className="codetype-mark-glyph" />
        <circle cx="28.5" cy="7.5" r="2" className="codetype-mark-dot" />
      </svg>
      <span className="codetype-mark-word">CODE<span>TYPE</span></span>
    </span>
  );
}

export function ProviderIcon({ provider }) {
  const label = provider === 'google' ? 'G' : provider === 'facebook' ? 'f' : '𝕏';
  return <span className={`provider-icon provider-icon-${provider}`} aria-hidden="true">{label}</span>;
}
