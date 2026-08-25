export const THEME_IDS = ['obsidian', 'phantom', 'paper', 'bone'];

export const THEME_META = [
  { id: 'obsidian', label: 'Obsidian', swatch: ['#0b0f19', '#facc15'] },
  { id: 'phantom', label: 'Phantom', swatch: ['#050b0d', '#34d399'] },
  { id: 'paper', label: 'Paper', swatch: ['#eef2f6', '#b45309'] },
  { id: 'bone', label: 'Bone', swatch: ['#f3efe6', '#0f766e'] }
];

export const CHART_THEMES = {
  obsidian: {
    grid: '#1e293b',
    axis: '#334155',
    tick: '#64748b',
    wpm: '#facc15',
    raw: '#38bdf8',
    cpm: '#4ade80',
    burst: '#f472b6',
    bar: 'rgba(250, 204, 21, 0.55)',
    backspace: '#38bdf8',
    cursor: '#334155',
    cursorFill: 'rgba(56, 189, 248, 0.05)'
  },
  phantom: {
    grid: '#16262b',
    axis: '#213841',
    tick: '#7d9a94',
    wpm: '#34d399',
    raw: '#a78bfa',
    cpm: '#38bdf8',
    burst: '#fbbf24',
    bar: 'rgba(52, 211, 153, 0.5)',
    backspace: '#a78bfa',
    cursor: '#213841',
    cursorFill: 'rgba(167, 139, 250, 0.06)'
  },
  paper: {
    grid: '#e2e8f0',
    axis: '#cbd5e1',
    tick: '#64748b',
    wpm: '#b45309',
    raw: '#0369a1',
    cpm: '#4d7c0f',
    burst: '#db2777',
    bar: 'rgba(180, 83, 9, 0.4)',
    backspace: '#0369a1',
    cursor: '#cbd5e1',
    cursorFill: 'rgba(3, 105, 161, 0.05)'
  },
  bone: {
    grid: '#e7e0d2',
    axis: '#d8d0bd',
    tick: '#78716c',
    wpm: '#92400e',
    raw: '#0f766e',
    cpm: '#4d7c0f',
    burst: '#be185d',
    bar: 'rgba(146, 64, 14, 0.4)',
    backspace: '#0f766e',
    cursor: '#d8d0bd',
    cursorFill: 'rgba(15, 118, 110, 0.06)'
  }
};

export function chartPalette(theme) {
  return CHART_THEMES[theme] || CHART_THEMES.obsidian;
}
