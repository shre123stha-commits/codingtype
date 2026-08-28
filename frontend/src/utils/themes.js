export const THEME_IDS = ['midnight', 'phantom', 'obsidian', 'paper', 'mist', 'bone'];

export const THEME_META = [
  { id: 'midnight', label: 'Midnight', swatch: ['#0a0d13', '#7aa2f7'] },
  { id: 'phantom', label: 'Phantom', swatch: ['#050b0d', '#34d399'] },
  { id: 'obsidian', label: 'Obsidian', swatch: ['#0c0c0e', '#facc15'] },
  { id: 'paper', label: 'Paper', swatch: ['#e8edf3', '#2f5fa8'] },
  { id: 'mist', label: 'Mist', swatch: ['#e4e6df', '#3a4f37'] },
  { id: 'bone', label: 'Bone', swatch: ['#efe7dc', '#9e482c'] }
];

export const CHART_THEMES = {
  midnight: {
    grid: '#1a2030',
    axis: '#232c3d',
    tick: '#5b6577',
    wpm: '#7aa2f7',
    raw: '#7dcfff',
    cpm: '#9ece6a',
    burst: '#bb9af7',
    bar: 'rgba(122, 162, 247, 0.5)',
    backspace: '#7dcfff',
    cursor: '#232c3d',
    cursorFill: 'rgba(125, 207, 255, 0.05)'
  },
  obsidian: {
    grid: '#1c1c20',
    axis: '#28282e',
    tick: '#6c7078',
    wpm: '#facc15',
    raw: '#d4dae4',
    cpm: '#a3cc3c',
    burst: '#fde047',
    bar: 'rgba(250, 204, 21, 0.55)',
    backspace: '#d4dae4',
    cursor: '#28282e',
    cursorFill: 'rgba(212, 218, 228, 0.05)'
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
    grid: '#dfe6ee',
    axis: '#c9d4e0',
    tick: '#5b6b7d',
    wpm: '#2f5fa8',
    raw: '#0e7490',
    cpm: '#2e7d5b',
    burst: '#b3541e',
    bar: 'rgba(47, 95, 168, 0.4)',
    backspace: '#0e7490',
    cursor: '#c9d4e0',
    cursorFill: 'rgba(14, 116, 144, 0.05)'
  },
  mist: {
    grid: '#dcded4',
    axis: '#cdd3c6',
    tick: '#8a9182',
    wpm: '#3a4f37',
    raw: '#926f35',
    cpm: '#4f6b3c',
    burst: '#8f5a72',
    bar: 'rgba(58, 79, 55, 0.35)',
    backspace: '#926f35',
    cursor: '#cdd3c6',
    cursorFill: 'rgba(146, 111, 53, 0.06)'
  },
  bone: {
    grid: '#e5dccc',
    axis: '#d9cdbb',
    tick: '#77695c',
    wpm: '#9e482c',
    raw: '#7a5c3e',
    cpm: '#5f7a44',
    burst: '#8a4a62',
    bar: 'rgba(158, 72, 44, 0.4)',
    backspace: '#7a5c3e',
    cursor: '#d9cdbb',
    cursorFill: 'rgba(122, 92, 62, 0.06)'
  }
};

export function chartPalette(theme) {
  return CHART_THEMES[theme] || CHART_THEMES.midnight;
}
