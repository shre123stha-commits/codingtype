export const PALETTES = {
  midnight: {
    bg: '#0a0d13',
    panel: '#10141c',
    edge: '#212936',
    accent: '#7aa2f7',
    pulse: '#7dcfff',
    ink: '#cbd3df',
    dim: '#828d9e',
    blood: '#f7768e',
    good: '#9ece6a'
  },
  mist: {
    bg: '#e4e6df',
    panel: '#eef0e9',
    edge: '#cdd3c6',
    accent: '#3a4f37',
    pulse: '#926f35',
    ink: '#454a42',
    dim: '#8a9182',
    blood: '#b0564c',
    good: '#4f6b3c'
  },
  obsidian: {
    bg: '#0c0c0e',
    panel: '#121215',
    edge: '#28282e',
    accent: '#facc15',
    pulse: '#d4dae4',
    ink: '#ebecee',
    dim: '#9498a0',
    blood: '#f87171',
    good: '#a3cc3c'
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
    bg: '#e8edf3',
    panel: '#f4f7fa',
    edge: '#c9d4e0',
    accent: '#2f5fa8',
    pulse: '#0e7490',
    ink: '#1c2733',
    dim: '#5b6b7d',
    blood: '#c73e51',
    good: '#2e7d5b'
  },
  bone: {
    bg: '#efe7dc',
    panel: '#f8f3ea',
    edge: '#d9cdbb',
    accent: '#9e482c',
    pulse: '#7a5c3e',
    ink: '#2b2622',
    dim: '#77695c',
    blood: '#b23a3a',
    good: '#5f7a44'
  }
};

import QRCode from 'qrcode';

const W = 1000;
const H = 560;
const FONT = '"JetBrains Mono", ui-monospace, monospace';

// The run-report card has its own fixed "midnight aurora" identity (independent
// of the app theme) so it always looks premium on social feeds.
const A = {
  accent: '#7aa2f7',
  accent2: '#9db4ff',
  pulse: '#7dcfff',
  violet: '#bb9af7',
  gold: '#e0af68',
  ink: '#dfe5f0',
  dim: '#8b96ab',
  faint: '#5c667c',
  blood: '#f7768e',
  good: '#9ece6a',
  edge: 'rgba(140,152,175,0.26)'
};

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// char-by-char letter spacing
function spaced(ctx, text, x, y, gap) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + gap;
  }
}

function spacedWidth(ctx, text, gap) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + gap;
  return w - gap;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function cornerTicks(ctx) {
  ctx.strokeStyle = 'rgba(122,162,247,0.85)';
  ctx.lineWidth = 2;
  const t = 22;
  const corner = (x, y, sx, sy) => {
    ctx.beginPath();
    ctx.moveTo(x + sx * t, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * t);
    ctx.stroke();
  };
  corner(11, 11, 1, 1);
  corner(W - 11, 11, -1, 1);
  corner(11, H - 11, 1, -1);
  corner(W - 11, H - 11, -1, -1);
}

// layered backdrop: deep gradient, aurora glows, faint dot grid, vignette
function backdrop(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d1424');
  g.addColorStop(0.55, '#0a0f1b');
  g.addColorStop(1, '#080b12');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const glow = (x, y, r, color) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  };
  glow(240, 30, 440, 'rgba(122,162,247,0.20)'); // periwinkle behind the hero
  glow(905, 470, 400, 'rgba(125,207,255,0.13)'); // cyan behind the QR
  glow(420, 640, 540, 'rgba(187,154,247,0.08)'); // violet sweep along the bottom

  ctx.fillStyle = 'rgba(205,215,235,0.04)';
  for (let y = 24; y < H - 12; y += 24) {
    for (let x = 24; x < W - 12; x += 24) ctx.fillRect(x, y, 1.5, 1.5);
  }

  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, 'rgba(5,7,12,0)');
  v.addColorStop(1, 'rgba(5,7,12,0.5)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// longest unbroken stretch of correct keys (backspaces reset the streak)
function cleanStreak(eventLog) {
  let best = 0;
  let cur = 0;
  for (const ev of eventLog || []) {
    if (ev.back) {
      cur = 0;
      continue;
    }
    if (ev.ok) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

// velocity curve: live WPM samples over the run
function sparkline(ctx, x, y, w, h, samples, peak) {
  ctx.strokeStyle = 'rgba(140,152,175,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + h + 0.5);
  ctx.lineTo(x + w, y + h + 0.5);
  ctx.stroke();

  if (!samples || samples.length < 2) {
    ctx.fillStyle = A.faint;
    ctx.font = `500 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('CURVE NEEDS A LONGER RUN', x + w / 2, y + h / 2 + 3);
    ctx.textAlign = 'left';
    return;
  }

  const T = Math.max(1, ...samples.map((s) => s.t));
  const maxV = Math.max(...samples.map((s) => s.wpm), peak, 1) * 1.15;
  const px = (t) => x + (Math.min(t, T) / T) * w;
  const py = (v) => y + h - (v / maxV) * (h - 8) - 4;

  const pts = samples.map((s) => ({ x: px(s.t), y: py(s.wpm) }));

  // soft area fill
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, 'rgba(122,162,247,0.28)');
  fill.addColorStop(1, 'rgba(122,162,247,0)');
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, y + h);
  pts.forEach((pt) => ctx.lineTo(pt.x, pt.y));
  ctx.lineTo(pts[pts.length - 1].x, y + h);
  ctx.closePath();
  ctx.fill();

  // gradient stroke
  const stroke = ctx.createLinearGradient(x, 0, x + w, 0);
  stroke.addColorStop(0, A.accent);
  stroke.addColorStop(1, A.pulse);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
  ctx.stroke();

  // endpoint dot with glow
  const last = pts[pts.length - 1];
  ctx.save();
  ctx.shadowColor = 'rgba(125,207,255,0.9)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = A.pulse;
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// white rounded QR pad with a soft drop shadow; text = the typist's identity
function drawQR(ctx, x, y, box, text) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x - 8, y - 8, box + 16, box + 16, 12);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(140,152,175,0.3)';
  ctx.lineWidth = 1;
  roundRect(ctx, x - 8.5, y - 8.5, box + 17, box + 17, 12);
  ctx.stroke();

  let m = null;
  let n = 0;
  try {
    const q = QRCode.create(text, { errorCorrectionLevel: 'L' });
    n = q.modules.size;
    m = Array.from({ length: n }, (_, yy) => Array.from({ length: n }, (_, xx) => q.modules.get(yy, xx)));
  } catch {
    m = null;
  }
  if (!m) return;
  const pad = 10;
  const cell = Math.floor((box - pad * 2) / n);
  const ox = x + Math.floor((box - cell * n) / 2);
  const oy = y + Math.floor((box - cell * n) / 2);
  ctx.fillStyle = '#0a0e18';
  for (let yy = 0; yy < n; yy++) {
    for (let xx = 0; xx < n; xx++) {
      if (m[yy][xx]) ctx.fillRect(ox + xx * cell, oy + yy * cell, cell + 0.5, cell + 0.5);
    }
  }
}

export async function renderShareCard(run, _themeId, handle = 'GUEST') {
  if (typeof document !== 'undefined') {
    try {
      await document.fonts.ready;
    } catch {
      /* font still not ready — fall through to fallback font */
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const { stats } = run;
  const sn = run.snippet || {};

  // --- backdrop + frame ---
  backdrop(ctx);
  ctx.strokeStyle = A.edge;
  ctx.lineWidth = 1;
  ctx.strokeRect(10.5, 10.5, W - 21, H - 21);
  const topSheen = ctx.createLinearGradient(0, 0, W, 0);
  topSheen.addColorStop(0, 'rgba(122,162,247,0)');
  topSheen.addColorStop(0.18, 'rgba(122,162,247,0.55)');
  topSheen.addColorStop(0.5, 'rgba(125,207,255,0.3)');
  topSheen.addColorStop(0.8, 'rgba(122,162,247,0)');
  ctx.strokeStyle = topSheen;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(11, 11);
  ctx.lineTo(W - 11, 11);
  ctx.stroke();
  cornerTicks(ctx);

  // --- header ---
  ctx.font = `700 18px ${FONT}`;
  ctx.fillStyle = A.accent;
  ctx.fillText('CODETYPE', 40, 54);
  const brandW = ctx.measureText('CODETYPE').width;
  ctx.fillStyle = A.dim;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText('// RUN REPORT', 40 + brandW + 12, 54);
  ctx.textAlign = 'right';
  ctx.font = `600 12px ${FONT}`;
  const dateStr = new Date(run.finishedAt || Date.now()).toLocaleDateString();
  ctx.fillStyle = A.faint;
  ctx.fillText(dateStr, W - 40, 54);
  ctx.fillStyle = A.accent2;
  ctx.fillText(`@${handle}`, W - 40 - ctx.measureText(dateStr).width - 16, 54);
  ctx.textAlign = 'left';
  const headLine = ctx.createLinearGradient(40, 0, W - 40, 0);
  headLine.addColorStop(0, 'rgba(122,162,247,0.4)');
  headLine.addColorStop(1, 'rgba(122,162,247,0)');
  ctx.strokeStyle = headLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 72.5);
  ctx.lineTo(W - 40, 72.5);
  ctx.stroke();

  // --- hero: sustained WPM with gradient + glow ---
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = A.dim;
  spaced(ctx, 'SUSTAINED WPM', 40, 122, 4);

  const num = String(stats.wpm);
  ctx.font = `700 96px ${FONT}`;
  const heroGrad = ctx.createLinearGradient(40, 150, 340, 240);
  heroGrad.addColorStop(0, A.accent2);
  heroGrad.addColorStop(1, A.pulse);
  ctx.save();
  ctx.shadowColor = 'rgba(122,162,247,0.45)';
  ctx.shadowBlur = 32;
  ctx.fillStyle = heroGrad;
  ctx.fillText(num, 36, 232);
  ctx.restore();

  const underGrad = ctx.createLinearGradient(40, 0, 200, 0);
  underGrad.addColorStop(0, A.accent);
  underGrad.addColorStop(1, 'rgba(125,207,255,0)');
  ctx.fillStyle = underGrad;
  roundRect(ctx, 40, 248, 130, 3, 1.5);
  ctx.fill();

  // --- velocity curve (live samples from this run) ---
  ctx.font = `600 10px ${FONT}`;
  ctx.fillStyle = A.faint;
  spaced(ctx, 'VELOCITY', 40, 284, 3);
  sparkline(ctx, 40, 294, 292, 62, run.samples, stats.wpm);

  // clean-run micro stat
  const streak = cleanStreak(run.eventLog);
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = A.pulse;
  ctx.fillText(String(streak), 40, 384);
  const stW = ctx.measureText(String(streak)).width;
  ctx.font = `500 10px ${FONT}`;
  ctx.fillStyle = A.faint;
  ctx.fillText(' CH TYPED CLEAN IN A ROW', 40 + stW + 8, 384);

  // --- open stat band (no boxes: hairline dividers + colored ticks) ---
  const cells = [
    ['CPM', stats.cpm, A.pulse],
    ['RAW', stats.rawWpm, A.accent],
    ['ACCURACY', `${stats.accuracy}%`, stats.accuracy >= 95 ? A.good : A.blood],
    ['CONSISTENCY', `${stats.consistency}/100`, A.gold],
    ['DURATION', `${stats.timeSec.toFixed(1)}s`, A.ink],
    ['ERRORS', stats.errors, stats.errors ? A.blood : A.good]
  ];
  const bandX = 360;
  const bandW = 100;
  ctx.strokeStyle = 'rgba(140,152,175,0.14)';
  ctx.lineWidth = 1;
  for (let i = 1; i < cells.length; i++) {
    const dx = bandX + i * bandW + 0.5;
    ctx.beginPath();
    ctx.moveTo(dx, 130);
    ctx.lineTo(dx, 214);
    ctx.stroke();
  }
  cells.forEach(([label, value, color], i) => {
    const x = bandX + i * bandW;
    ctx.font = `600 10px ${FONT}`;
    ctx.fillStyle = A.dim;
    spaced(ctx, label, x + 16, 140, 2);
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.92;
    ctx.font = `700 27px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(truncate(String(value), 10), x + 16, 186);
    ctx.restore();
    ctx.fillStyle = color;
    roundRect(ctx, x + 16, 200, 26, 3, 1.5);
    ctx.fill();
  });

  // --- divider + target ---
  ctx.strokeStyle = 'rgba(140,152,175,0.16)';
  ctx.beginPath();
  ctx.moveTo(40, 398.5);
  ctx.lineTo(W - 40, 398.5);
  ctx.stroke();

  ctx.fillStyle = A.accent;
  roundRect(ctx, 40, 414, 3, 18, 1.5);
  ctx.fill();
  ctx.fillStyle = A.ink;
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText(`// ${sn.source || 'snippet'}`, 54, 428);
  ctx.fillStyle = A.dim;
  ctx.font = `600 12px ${FONT}`;
  const sub = truncate(
    `${(sn.title || '').toUpperCase()}  ·  ${(run.mode || '').toUpperCase()}  ·  ${(run.language || '').toUpperCase()}`,
    64
  );
  ctx.fillText(sub, 54, 452);
  if (run.daily) {
    ctx.font = `700 10px ${FONT}`;
    const badge = 'DAILY ✓';
    const bw = ctx.measureText(badge).width + 18;
    const bx = 54 + ctx.measureText(sub).width + 16;
    ctx.strokeStyle = 'rgba(122,162,247,0.55)';
    ctx.lineWidth = 1;
    roundRect(ctx, bx, 440, bw, 17, 8.5);
    ctx.stroke();
    ctx.fillStyle = A.accent;
    ctx.fillText(badge, bx + 9, 452.5);
  }

  // --- friction bars (middle column) ---
  const friction = Object.entries(run.symbolStats || {})
    .map(([sym, v]) => ({ sym, t: v.t || 0, e: v.e || 0 }))
    .filter((v) => v.e > 0)
    .sort((a, b) => b.e - a.e)
    .slice(0, 5);

  ctx.font = `600 10px ${FONT}`;
  ctx.fillStyle = A.faint;
  spaced(ctx, 'TOP FRICTION SYMBOLS', 460, 428, 2);
  if (!friction.length) {
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = A.good;
    ctx.fillText('✓ 0 ERRORS — CLEAN RUN', 460, 462);
  } else {
    const maxE = Math.max(...friction.map((f) => f.e));
    friction.forEach((f, i) => {
      const y = 442 + i * 23;
      ctx.fillStyle = A.ink;
      ctx.font = `700 15px ${FONT}`;
      ctx.fillText(f.sym, 460, y + 10);
      ctx.fillStyle = 'rgba(140,152,175,0.14)';
      roundRect(ctx, 512, y, 228, 9, 4.5);
      ctx.fill();
      const barGrad = ctx.createLinearGradient(512, 0, 740, 0);
      barGrad.addColorStop(0, '#e06c84');
      barGrad.addColorStop(1, A.blood);
      ctx.fillStyle = barGrad;
      roundRect(ctx, 512, y, Math.max(9, (f.e / maxE) * 228), 9, 4.5);
      ctx.fill();
      ctx.fillStyle = A.faint;
      ctx.font = `500 10px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${f.e} ERR / ${f.t + f.e} CH`, 820, y + 9);
      ctx.textAlign = 'left';
    });
  }

  // --- your QR (bottom right) ---
  const qrBox = 108;
  const qrX = W - 40 - qrBox;
  const qrY = 414;
  drawQR(ctx, qrX, qrY, qrBox, truncate(`CodeType @${handle} - ${stats.wpm} WPM - ${stats.accuracy}% acc`, 60));

  // --- version mark ---
  ctx.fillStyle = A.faint;
  ctx.font = `500 9px ${FONT}`;
  ctx.fillText('codeType // v1.2', 40, 545);

  return canvas.toDataURL('image/png');
}
