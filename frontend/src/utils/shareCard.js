export const PALETTES = {
  obsidian: {
    bg: '#0b0f19',
    panel: '#0f172a',
    edge: '#1e293b',
    accent: '#facc15',
    pulse: '#38bdf8',
    ink: '#e2e8f0',
    dim: '#64748b',
    blood: '#f87171',
    good: '#34d399'
  },
  phantom: {
    bg: '#050b0d',
    panel: '#0a1418',
    edge: '#16262b',
    accent: '#34d399',
    pulse: '#a78bfa',
    ink: '#dcebeb',
    dim: '#7d9a94',
    blood: '#fb7185',
    good: '#4ade80'
  },
  paper: {
    bg: '#eef2f6',
    panel: '#ffffff',
    edge: '#cbd5e1',
    accent: '#b45309',
    pulse: '#0369a1',
    ink: '#0f172a',
    dim: '#64748b',
    blood: '#dc2626',
    good: '#047857'
  },
  bone: {
    bg: '#f3efe6',
    panel: '#fbf9f4',
    edge: '#d8d0bd',
    accent: '#92400e',
    pulse: '#0f766e',
    ink: '#1c1917',
    dim: '#57534e',
    blood: '#dc2626',
    good: '#047857'
  }
};

const W = 1000;
const H = 560;
const FONT = '"JetBrains Mono", ui-monospace, monospace';

function crosshair(ctx, x, y, dx, dy, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + dx * 22, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + dy * 22);
  ctx.stroke();
}

function statCell(ctx, x, y, label, value, palette, valueColor) {
  ctx.fillStyle = palette.panel;
  ctx.fillRect(x, y, 168, 64);
  ctx.strokeStyle = palette.edge;
  ctx.strokeRect(x + 0.5, y + 0.5, 168, 64);
  ctx.fillStyle = palette.dim;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText(label, x + 12, y + 24);
  ctx.fillStyle = valueColor || palette.ink;
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(String(value), x + 12, y + 52);
}

export async function renderShareCard(run, themeId) {
  if (typeof document !== 'undefined') {
    try {
      await document.fonts.ready;
    } catch {
      /* font still not ready — fall through to fallback font */
    }
  }
  const p = PALETTES[themeId] || PALETTES.obsidian;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const { stats } = run;
  const sn = run.snippet || {};

  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = p.edge;
  ctx.strokeRect(10.5, 10.5, W - 21, H - 21);
  crosshair(ctx, 10, 10, 1, 1, p.accent);
  crosshair(ctx, W - 10, 10, -1, 1, p.accent);
  crosshair(ctx, 10, H - 10, 1, -1, p.accent);
  crosshair(ctx, W - 10, H - 10, -1, -1, p.accent);

  ctx.fillStyle = p.accent;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText('CODETYPE // RUN REPORT', 36, 62);
  ctx.fillStyle = p.dim;
  ctx.font = `500 14px ${FONT}`;
  const date = new Date(run.finishedAt || Date.now()).toLocaleDateString();
  ctx.textAlign = 'right';
  ctx.fillText(date, W - 36, 62);
  ctx.textAlign = 'left';

  ctx.fillStyle = p.accent;
  ctx.font = `700 100px ${FONT}`;
  ctx.fillText(String(stats.wpm), 36, 200);
  ctx.fillStyle = p.dim;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText('SUSTAINED WPM', 40, 236);

  const cells = [
    ['CPM', stats.cpm, p.good],
    ['RAW', stats.rawWpm, p.pulse],
    ['ACCURACY', `${stats.accuracy}%`, stats.accuracy >= 95 ? p.good : p.blood],
    ['CONSISTENCY', `${stats.consistency}/100`, p.pulse],
    ['DURATION', `${stats.timeSec.toFixed(1)}s`, p.ink],
    ['ERRORS', stats.errors, stats.errors ? p.blood : p.good]
  ];
  cells.forEach(([label, value, color], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    statCell(ctx, 400 + col * 180, 110 + row * 76, label, value, p, color);
  });

  ctx.fillStyle = p.ink;
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText(`// ${sn.source || 'snippet'}`, 36, 320);
  ctx.fillStyle = p.dim;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(`${(sn.title || '').toUpperCase()}  ·  ${(run.mode || '').toUpperCase()}  ·  ${(run.language || '').toUpperCase()}`, 36, 348);

  const friction = Object.entries(run.symbolStats || {})
    .map(([sym, v]) => ({ sym, t: v.t || 0, e: v.e || 0 }))
    .filter((v) => v.e > 0)
    .sort((a, b) => b.e - a.e)
    .slice(0, 5);

  ctx.fillStyle = p.dim;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText('TOP FRICTION SYMBOLS', 36, 400);
  if (!friction.length) {
    ctx.fillStyle = p.good;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText('0 ERRORS ON TRACKED SYMBOLS — CLEAN RUN', 36, 436);
  } else {
    const maxE = Math.max(...friction.map((f) => f.e));
    friction.forEach((f, i) => {
      const y = 424 + i * 26;
      ctx.fillStyle = p.ink;
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText(f.sym, 36, y + 12);
      ctx.fillStyle = p.edge;
      ctx.fillRect(110, y, 520, 14);
      ctx.fillStyle = p.blood;
      ctx.fillRect(110, y, Math.max(6, (f.e / maxE) * 520), 14);
      ctx.fillStyle = p.dim;
      ctx.font = `500 12px ${FONT}`;
      ctx.fillText(`${f.e} err / ${f.t + f.e} ch`, 644, y + 11);
    });
  }

  ctx.fillStyle = p.dim;
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText('CODETYPE — DEV-TUNED KEYBOARD TELEMETRY', 36, H - 30);
  ctx.textAlign = 'right';
  ctx.fillText('codeType // v1.1', W - 36, H - 30);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}
