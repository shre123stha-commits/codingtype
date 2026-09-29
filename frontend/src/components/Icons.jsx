// Shared inline SVG icon set — stroke-based, 24px grid, inherits currentColor.
// Used by the account menu / modal and the theme picker so no emoji or ASCII
// glyphs (⊕ ◎ ◉ ▲ ▼ ✕) leak into the UI.

function base(extra = {}) {
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...extra
  };
}

export function UserIcon({ className = '' }) {
  return (
    <svg {...base()} className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function XIcon({ className = '' }) {
  return (
    <svg {...base()} className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function EyeIcon({ className = '' }) {
  return (
    <svg {...base()} className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ className = '' }) {
  return (
    <svg {...base()} className={className}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function ChevronIcon({ className = '', up = false }) {
  return (
    <svg
      {...base()}
      className={`${className} transition-transform duration-200 ${up ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CheckIcon({ className = '' }) {
  return (
    <svg {...base({ strokeWidth: 3 })} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ArrowRightIcon({ className = '' }) {
  return (
    <svg {...base()} className={className}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function LogOutIcon({ className = '' }) {
  return (
    <svg {...base()} className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

