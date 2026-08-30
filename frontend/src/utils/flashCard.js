// Flash-card renderers — big, theme-matched PNG share cards drawn on canvas:
//   renderProfileCard  1080x1350  typist profile (feats, WPM, rank, QR)
//   renderRaceCard     1080x1350  post-race summary with performance curve
//   renderResultCard   1200x675   direct race result (winner vs loser)
// Plus the share helpers: download PNG, copy image to clipboard, post to X.

import { PALETTES } from './shareCard.js';
import QRCode from 'qrcode';

const FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

function awaitFonts() {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    return document.fonts.ready.then(() => {}, () => {});
  }
  return Promise.resolve();
}

function newCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function loadAvatar(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('avatar failed to load'));
    img.src = src;
  });
}

// char-by-char letter spacing (ctx.letterSpacing is not universal)
function spaced(ctx, text, x, y, gap) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + gap;
  }
}

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function frame(ctx, w, h, p) {
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, w, h);
  // dot grid
  ctx.fillStyle = 'rgba(148,163,184,0.055)';
  for (let y = 22; y < h; y += 22) {
    for (let x = 22; x < w; x += 22) ctx.fillRect(x, y, 1.5, 1.5);
  }
  // top glow (theme accent, so it matches the card's palette)
  const g = ctx.createRadialGradient(w / 2, -h * 0.08, 0, w / 2, -h * 0.08, h * 0.75);
  g.addColorStop(0, `rgba(${hexRgb(p.accent)},0.10)`);
  g.addColorStop(1, `rgba(${hexRgb(p.accent)},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // border
  ctx.strokeStyle = p.edge;
  ctx.lineWidth = 2;
  ctx.strokeRect(30.5, 30.5, w - 61, h - 61);
  // corner ticks
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 3;
  const c = 34;
  const t = 30;
  const corner = (x, y, sx, sy) => {
    ctx.beginPath();
    ctx.moveTo(x + sx * t, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * t);
    ctx.stroke();
  };
  corner(c, c, 1, 1);
  corner(w - c, c, -1, 1);
  corner(c, h - c, 1, -1);
  corner(w - c, h - c, -1, -1);
}

function header(ctx, w, p, tag, title, titleColor) {
  ctx.fillStyle = p.dim;
  ctx.font = `600 16px ${FONT}`;
  spaced(ctx, tag, 60, 104, 5);
  ctx.textAlign = 'right';
  ctx.fillText(new Date().toLocaleDateString(), w - 60, 104);
  ctx.textAlign = 'left';
  ctx.fillStyle = titleColor || p.accent;
  ctx.font = `700 60px ${FONT}`;
  spaced(ctx, title, 60, 184, 10);
  ctx.strokeStyle = p.edge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 224);
  ctx.lineTo(w - 60, 224);
  ctx.stroke();
}

function bigCell(ctx, x, y, w, h, label, value, p, valueColor, sub) {
  ctx.fillStyle = p.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = p.edge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  ctx.fillStyle = p.accent;
  ctx.fillRect(x, y + 10, 4, h - 20);
  ctx.fillStyle = p.dim;
  ctx.font = `600 17px ${FONT}`;
  spaced(ctx, label, x + 28, y + 42, 3);
  ctx.fillStyle = valueColor || p.ink;
  ctx.font = `700 ${sub ? 52 : 58}px ${FONT}`;
  ctx.fillText(String(value), x + 28, y + (sub ? h - 44 : h - 38));
  if (sub) {
    ctx.fillStyle = p.dim;
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText(truncate(sub, 44), x + 28, y + h - 18);
  }
}

function shareBar(ctx, x, y, w, h, label, p) {
  ctx.fillStyle = `rgba(${hexRgb(p.accent)},0.08)`;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 10);
  ctx.stroke();
  ctx.fillStyle = p.accent;
  ctx.font = `700 22px ${FONT}`;
  ctx.textAlign = 'center';
  spaced(ctx, label, x + w / 2 - spacedWidth(ctx, label, 4) / 2, y + h / 2 + 8, 4);
  ctx.textAlign = 'left';
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

function hexRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}` : '56,189,248';
}

function drawQR(ctx, x, y, box, text) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 6, y - 6, box + 12, box + 12);
  ctx.strokeStyle = 'rgba(15,23,42,0.3)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 5.25, y - 5.25, box + 10.5, box + 10.5);
  let m = null;
  let n = 0;
  try {
    const q = QRCode.create(text, { errorCorrectionLevel: 'M' });
    n = q.modules.size;
    m = Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => q.modules.get(y, x)));
  } catch {
    m = null;
  }
  if (!m) return;
  const pad = 10;
  const cell = Math.floor((box - pad * 2) / n);
  const ox = x + Math.floor((box - cell * n) / 2);
  const oy = y + Math.floor((box - cell * n) / 2);
  ctx.fillStyle = '#0b1220';
  for (let yy = 0; yy < n; yy++) {
    for (let xx = 0; xx < n; xx++) {
      if (m[yy][xx]) ctx.fillRect(ox + xx * cell, oy + yy * cell, cell + 0.5, cell + 0.5);
    }
  }
}

// ---------------------------------------------------------------- profile

const LANG_LABELS = { python: 'PY', javascript: 'JS', java: 'JAVA', 'c++': 'C++', rust: 'RUST', sql: 'SQL' };

// Derives everything the profile card shows from raw session rows.
export function buildProfile({ sessions = [], authUser = null, streak = 0, profile = null }) {
  const feats = sessions.length;
  const totalChars = sessions.reduce((n, s) => n + (Number(s.chars) || 0), 0);
  const avgWpm = feats ? Math.round(sessions.reduce((n, s) => n + (Number(s.wpm) || 0), 0) / feats) : 0;
  const avgAccuracy = feats ? Math.round((sessions.reduce((n, s) => n + (Number(s.accuracy) || 0), 0) / feats) * 10) / 10 : 0;
  const bestWpm = sessions.reduce((m, s) => Math.max(m, Number(s.wpm) || 0), 0);
  const order = ['python', 'javascript', 'java', 'c++', 'rust', 'sql'];
  const languages = order.filter((l) => sessions.some((s) => s.language === l)).map((l) => LANG_LABELS[l]);
  const level = 1 + Math.floor(feats / 20);
  const TIERS = [
    ['S', 90],
    ['A', 75],
    ['B', 60],
    ['C', 45],
    ['D', 0]
  ];
  let rank = '—';
  let rankPct = 0;
  let rankNext = 'COMPLETE A RUN TO RANK UP';
  if (feats > 0) {
    let idx = TIERS.findIndex(([, min]) => avgWpm >= min);
    if (idx < 0) idx = TIERS.length - 1;
    rank = TIERS[idx][0];
    if (idx === 0) {
      rankPct = 100;
      rankNext = 'MAX RANK ACHIEVED';
    } else {
      const cur = TIERS[idx][1];
      const next = TIERS[idx - 1][1];
      rankPct = Math.max(4, Math.min(100, Math.round(((avgWpm - cur) / (next - cur)) * 100)));
      rankNext = `${TIERS[idx - 1][0]}-TIER`;
    }
  }
  // The real name (when set) wins over the email-derived handle everywhere
  // the card shows the identity; `avatar` is the photo data-URL (or null).
  const name = (profile && profile.name ? String(profile.name) : '').trim();
  const avatar = (profile && profile.avatar) || null;
  const base = name || (authUser ? String(authUser).split('@')[0] : 'GUEST');
  const handle = base.toUpperCase();
  const cardName = name ? name.toUpperCase() : authUser ? `@${handle}` : handle;
  return { handle, cardName, avatar, level, rank, rankPct, rankNext, feats, totalChars, avgWpm, avgAccuracy, bestWpm, languages, streak: streak || 0 };
}

export function profileQrText(p) {
  return truncate(`CodeType ${p.cardName} - Lv ${p.level} / ${p.rank}-TIER - ${p.feats} runs - ${p.avgWpm} WPM avg - ${p.avgAccuracy}% acc`, 100);
}

export function profileShareText(p) {
  return `${p.cardName} · Level ${p.level} · ${p.rank}-TIER on CodeType — ${p.feats} runs · ${p.avgWpm} WPM avg · ${p.avgAccuracy}% acc. Type the code you actually ship. #CodeType`;
}

export async function renderProfileCard(profile, themeId) {
  await awaitFonts();
  const p = PALETTES[themeId] || PALETTES.obsidian;
  const W = 1080;
  const H = 1350;
  const canvas = newCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const q = profile;
  frame(ctx, W, H, p);
  header(ctx, W, p, 'CODETYPE // PROFILE EXPORT', 'TYPIST PROFILE');

  // avatar
  const ax = 165;
  const ay = 405;
  const r = 100;
  ctx.strokeStyle = p.pulse;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ax, ay, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = p.edge;
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(a) * (r + 8), ay + Math.sin(a) * (r + 8));
    ctx.lineTo(ax + Math.cos(a) * (r + 18), ay + Math.sin(a) * (r + 18));
    ctx.stroke();
  }
  // avatar: the user's own photo (circle-cropped) when set, else @HANDLE initials
  let avatarImg = null;
  if (q.avatar) {
    try {
      avatarImg = await loadAvatar(q.avatar);
    } catch {
      avatarImg = null;
    }
  }
  if (avatarImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, r - 12, 0, Math.PI * 2);
    ctx.clip();
    const side = (r - 12) * 2;
    const sw = Math.min(avatarImg.width, avatarImg.height);
    ctx.drawImage(
      avatarImg,
      (avatarImg.width - sw) / 2,
      (avatarImg.height - sw) / 2,
      sw,
      sw,
      ax - (r - 12),
      ay - (r - 12),
      side,
      side
    );
    ctx.restore();
  } else {
    ctx.fillStyle = p.panel;
    ctx.beginPath();
    ctx.arc(ax, ay, r - 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.font = `700 72px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(q.handle.slice(0, 2) || 'CT', ax, ay + 8);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // name block
  const nx = 320;
  ctx.fillStyle = p.ink;
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(truncate(q.cardName, 22), nx, 352);
  ctx.fillStyle = p.accent;
  ctx.font = `700 26px ${FONT}`;
  spaced(ctx, `LEVEL ${q.level}`, nx, 404, 4);
  ctx.fillStyle = p.pulse;
  spaced(ctx, `RANK: ${q.rank}-TIER`, nx, 446, 4);
  ctx.fillStyle = p.dim;
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText(truncate(`${q.feats} FEATS · ${q.totalChars.toLocaleString()} CHARS TYPED`, 46), nx, 490);

  // stat grid
  const gy = 560;
  const gw = 468;
  const gh = 160;
  bigCell(ctx, 60, gy, gw, gh, 'TOTAL FEATS', q.feats, p, p.accent);
  bigCell(ctx, 552, gy, gw, gh, 'AVG WPM', q.avgWpm, p, p.pulse);
  bigCell(ctx, 60, gy + 184, gw, gh, 'ACCURACY', `${q.avgAccuracy}%`, p, q.avgAccuracy >= 95 ? p.good : p.blood);
  bigCell(
    ctx,
    552,
    gy + 184,
    gw,
    gh,
    'LANGUAGES MASTERED',
    q.languages.length,
    p,
    p.accent,
    q.languages.length ? q.languages.join(' · ') : 'NONE YET — GO TYPE'
  );

  // next rank
  const ny = 950;
  ctx.fillStyle = p.dim;
  ctx.font = `600 17px ${FONT}`;
  spaced(ctx, 'NEXT RANK', 60, ny, 3);
  ctx.textAlign = 'right';
  ctx.fillStyle = p.accent;
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText(q.rankPct >= 100 ? 'MAX RANK ACHIEVED' : q.feats === 0 ? 'NO DATA YET' : `${q.rankPct}% TO ${q.rankNext}`, W - 60, ny);
  ctx.textAlign = 'left';
  const by = ny + 22;
  const bw = W - 120;
  ctx.fillStyle = p.panel;
  ctx.fillRect(60, by, bw, 20);
  ctx.strokeStyle = p.edge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(60.75, by + 0.75, bw - 1.5, 18.5);
  const fw = Math.max(0.02, q.rankPct / 100) * (bw - 4);
  const grad = ctx.createLinearGradient(60, 0, 60 + bw, 0);
  grad.addColorStop(0, p.accent);
  grad.addColorStop(1, p.pulse);
  ctx.fillStyle = grad;
  ctx.fillRect(62, by + 2, fw, 16);

  // streak / best
  const sy = by + 76;
  ctx.fillStyle = p.good;
  ctx.font = `700 20px ${FONT}`;
  spaced(ctx, `STREAK: ${q.streak} ${q.streak === 1 ? 'DAY' : 'DAYS'}`, 60, sy, 3);
  ctx.fillStyle = p.pulse;
  ctx.textAlign = 'right';
  ctx.fillText(`PERSONAL BEST: ${q.bestWpm} WPM`, W - 60, sy);
  ctx.textAlign = 'left';

  // QR + footer
  const qrY = sy + 44;
  drawQR(ctx, W - 60 - 170, qrY, 170, profileQrText(q));
  ctx.fillStyle = p.ink;
  ctx.font = `600 20px ${FONT}`;
  spaced(ctx, `CODETYPE.IO | ${q.cardName}`, 60, qrY + 52, 2);
  ctx.fillStyle = p.dim;
  ctx.font = `500 15px ${FONT}`;
  ctx.fillText('SCAN FOR PROFILE SNAPSHOT', 60, qrY + 86);

  ctx.fillStyle = p.dim;
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText('CODETYPE — DEV-TUNED KEYBOARD TELEMETRY', 60, H - 44);
  ctx.textAlign = 'right';
  ctx.fillText('codeType // v1.2', W - 60, H - 44);
  ctx.textAlign = 'left';

  return canvas;
}

// ------------------------------------------------------------------ race

export function raceShareText({ won, wpm, accuracy, title, oppName, oppWpm }) {
  const opp = `${oppName} (${oppWpm} WPM)`;
  return won
    ? `Just won a 1V1 race on CodeType! ${wpm} WPM · ${accuracy}% acc vs ${opp} — ${title}. #CodeType #1v1Race`
    : `Just lost a 1V1 on CodeType — ${wpm} WPM · ${accuracy}% acc to ${opp} — ${title}. Rematch? #CodeType`;
}

export async function renderRaceCard(data, themeId) {
  await awaitFonts();
  const p = PALETTES[themeId] || PALETTES.obsidian;
  const W = 1080;
  const H = 1350;
  const canvas = newCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const won = data.won;
  frame(ctx, W, H, p);
  header(ctx, W, p, 'CODETYPE // RACE EXPORT', 'RACE SUMMARY', p.pulse);

  ctx.fillStyle = p.dim;
  ctx.font = `600 19px ${FONT}`;
  ctx.fillText(truncate(`1V1 QUICK RACE — ${data.title || 'TARGET'}`, 64), 60, 262);
  ctx.textAlign = 'right';
  ctx.fillText(data.modeLabel || 'FIRST TO FINISH', W - 60, 262);
  ctx.textAlign = 'left';

  // win banner
  ctx.save();
  ctx.shadowColor = won ? p.good : p.blood;
  ctx.shadowBlur = 36;
  ctx.fillStyle = won ? p.good : p.blood;
  ctx.font = `700 88px ${FONT}`;
  ctx.textAlign = 'center';
  const banner = won ? 'VICTORY' : 'DEFEAT';
  spaced(ctx, banner, W / 2 - spacedWidth(ctx, banner, 14) / 2, 372, 14);
  ctx.restore();
  ctx.textAlign = 'left';

  // stat row
  const cy = 430;
  const cw = 304;
  bigCell(ctx, 60, cy, cw, 170, 'WPM', data.wpm ?? '—', p, p.accent);
  bigCell(ctx, 388, cy, cw, 170, 'ACCURACY', `${data.accuracy}%`, p, (data.accuracy || 0) >= 95 ? p.good : p.blood);
  bigCell(ctx, 716, cy, cw, 170, 'RANK', data.rank || (won ? '1ST' : '2ND'), p, won ? p.accent : p.dim);

  // performance curve
  const py = 640;
  const ph = 350;
  ctx.fillStyle = p.panel;
  ctx.fillRect(60, py, W - 120, ph);
  ctx.strokeStyle = p.edge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(60.75, py + 0.75, W - 121.5, ph - 1.5);
  ctx.fillStyle = p.dim;
  ctx.font = `600 16px ${FONT}`;
  spaced(ctx, 'PERFORMANCE CURVE', 88, py + 40, 3);
  // legend
  ctx.textAlign = 'right';
  ctx.font = `600 14px ${FONT}`;
  ctx.fillStyle = p.accent;
  ctx.fillText(`RIVAL ${data.oppName || ''}`.toUpperCase(), W - 88, py + 38);
  ctx.fillStyle = p.pulse;
  ctx.fillText('YOU', W - 88 - ctx.measureText(`RIVAL ${data.oppName || ''} `.toUpperCase()).width - 40, py + 38);
  ctx.textAlign = 'left';
  const px0 = 110;
  const py0 = py + 70;
  const pw = W - 110 - 100;
  const phh = ph - 110;
  ctx.strokeStyle = 'rgba(148,163,184,0.14)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = py0 + (phh * i) / 4;
    ctx.beginPath();
    ctx.moveTo(px0, y);
    ctx.lineTo(px0 + pw, y);
    ctx.stroke();
  }
  for (let i = 0; i <= 5; i++) {
    const x = px0 + (pw * i) / 5;
    ctx.beginPath();
    ctx.moveTo(x, py0);
    ctx.lineTo(x, py0 + phh);
    ctx.stroke();
  }
  ctx.fillStyle = p.dim;
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText('100%', px0 - 44, py0 + 10);
  ctx.fillText('50%', px0 - 40, py0 + phh / 2 + 10);
  ctx.fillText('0%', px0 - 34, py0 + phh + 4);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(data.T || 0)}s`, px0 + pw, py0 + phh + 24);
  ctx.textAlign = 'left';

  const samples = data.progress || [];
  const T = Math.max(
    1,
    data.yourFinishT || 0,
    data.oppDone ? data.oppFinishT || 0 : 0,
    ...samples.map((s) => s.t)
  );
  data.T = T;
  const youPts = [];
  const oppPts = [];
  for (const s of samples) {
    youPts.push({ x: s.t / T, y: (s.me / data.total) * 100 });
    oppPts.push({ x: s.t / T, y: (s.opp / data.total) * 100 });
  }
  youPts.push({ x: (data.yourFinishT || T) / T, y: 100 });
  if (data.oppDone) oppPts.push({ x: (data.oppFinishT || T) / T, y: 100 });

  const drawLine = (pts, color, width, dashed) => {
    if (!pts.length) return;
    ctx.save();
    if (dashed) ctx.setLineDash([10, 8]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach((pt, i) => {
      const x = px0 + pt.x * pw;
      const y = py0 + phh - (Math.min(100, pt.y) / 100) * phh;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  };
  // your area fill
  if (youPts.length > 1) {
    const area = ctx.createLinearGradient(0, py0, 0, py0 + phh);
    area.addColorStop(0, `rgba(${hexRgb(p.pulse)},0.22)`);
    area.addColorStop(1, `rgba(${hexRgb(p.pulse)},0)`);
    ctx.fillStyle = area;
    ctx.beginPath();
    ctx.moveTo(px0, py0 + phh);
    youPts.forEach((pt) => ctx.lineTo(px0 + pt.x * pw, py0 + phh - (Math.min(100, pt.y) / 100) * phh));
    ctx.lineTo(px0 + ((data.yourFinishT || T) / T) * pw, py0 + phh);
    ctx.closePath();
    ctx.fill();
  }
  drawLine(oppPts, p.accent, 3.5, !data.oppDone);
  drawLine(youPts, p.pulse, 4.5, false);
  // endpoint dots
  const dot = (pt, color) => {
    if (!pt) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px0 + pt.x * pw, py0 + phh - (Math.min(100, pt.y) / 100) * phh, 6, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(youPts[youPts.length - 1], p.pulse);
  dot(oppPts[oppPts.length - 1], p.accent);

  // bottom stat row
  const by = 1030;
  bigCell(ctx, 60, by, cw, 150, 'KEYSTROKES', data.keystrokes ?? '—', p, p.ink);
  bigCell(ctx, 388, by, cw, 150, 'ERRORS', data.errors ?? 0, p, (data.errors || 0) > 0 ? p.blood : p.good);
  bigCell(ctx, 716, by, cw, 150, 'VICTORIES', data.victories ?? 0, p, p.accent, 'CAREER 1V1 RECORD');

  shareBar(ctx, 60, 1220, W - 120, 64, won ? 'SHARE THIS VICTORY' : 'SHARE THE DEFEAT', p);
  ctx.fillStyle = p.dim;
  ctx.font = `500 14px ${FONT}`;
  ctx.fillText(`CODETYPE.IO | ${won ? '#RACECHAMPION' : '#REMATCHPLS'}`, 60, H - 44);
  ctx.textAlign = 'right';
  ctx.fillText('codeType // v1.2', W - 60, H - 44);
  ctx.textAlign = 'left';

  return canvas;
}

// --------------------------------------------------------------- result

export async function renderResultCard(data, themeId) {
  await awaitFonts();
  const p = PALETTES[themeId] || PALETTES.obsidian;
  const W = 1200;
  const H = 675;
  const canvas = newCanvas(W, H);
  const ctx = canvas.getContext('2d');
  frame(ctx, W, H, p);

  ctx.textAlign = 'center';
  ctx.fillStyle = p.pulse;
  ctx.font = `700 52px ${FONT}`;
  spaced(ctx, 'RACE RESULT', W / 2 - spacedWidth(ctx, 'RACE RESULT', 12) / 2, 112, 12);
  ctx.fillStyle = p.dim;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(truncate(`1V1 RACE · ${data.title || 'TARGET'} · ${data.modeLabel || 'FIRST TO FINISH'}`, 78), W / 2, 150);
  ctx.textAlign = 'left';

  const py = 190;
  const pw = 470;
  const ph = 210;
  const winner = { x: 70, name: data.yourName, wpm: data.wpm, color: p.good, label: 'WINNER' };
  const loser = { x: 660, name: data.oppName, wpm: data.oppWpm, color: p.blood, label: 'LOSER' };
  const panel = (side) => {
    ctx.fillStyle = `rgba(${hexRgb(side.color)},0.07)`;
    ctx.fillRect(side.x, py, pw, ph);
    ctx.strokeStyle = side.color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(side.x + 1.25, py + 1.25, pw - 2.5, ph - 2.5);
    ctx.fillStyle = side.color;
    ctx.font = `600 16px ${FONT}`;
    spaced(ctx, side.label, side.x + 28, py + 44, 4);
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(truncate(side.name, 18), side.x + 28, py + 108);
    ctx.fillStyle = p.dim;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText(`${side.wpm ?? '—'} WPM${side.bot ? ' · BOT' : ''}`, side.x + 28, py + 156);
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText(data.won && side === winner ? 'FINISHED FIRST' : 'FINISHED', side.x + 28, py + 188);
  };
  panel(winner);
  panel(loser);
  ctx.textAlign = 'center';
  ctx.fillStyle = p.ink;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText('VS', W / 2, py + 122);
  ctx.textAlign = 'left';

  // accuracy / errors
  const sy = py + ph + 40;
  ctx.fillStyle = p.dim;
  ctx.font = `600 15px ${FONT}`;
  spaced(ctx, 'ACCURACY', 70, sy, 3);
  ctx.fillStyle = (data.accuracy || 0) >= 95 ? p.good : p.blood;
  ctx.font = `700 42px ${FONT}`;
  ctx.fillText(`${data.accuracy}%`, 70, sy + 52);
  ctx.textAlign = 'right';
  ctx.fillStyle = p.dim;
  ctx.font = `600 15px ${FONT}`;
  spaced(ctx, 'ERRORS', W - 70 - spacedWidth(ctx, 'ERRORS', 3), sy, 3);
  ctx.fillStyle = (data.errors || 0) > 0 ? p.blood : p.good;
  ctx.font = `700 42px ${FONT}`;
  ctx.fillText(String(data.errors ?? 0), W - 70, sy + 52);
  ctx.textAlign = 'left';

  shareBar(ctx, 70, sy + 84, W - 140, 56, 'SHARE RESULT', p);
  ctx.fillStyle = p.dim;
  ctx.font = `500 13px ${FONT}`;
  ctx.fillText('CODETYPE.IO', 70, H - 36);
  ctx.textAlign = 'right';
  ctx.fillText('codeType // v1.2', W - 70, H - 36);
  ctx.textAlign = 'left';

  return canvas;
}

// -------------------------------------------------------------- sharing

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png blob failed'))), 'image/png');
  });
}

export async function downloadCanvas(canvas, filename) {
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function copyCanvasPng(canvas) {
  const blob = await canvasToBlob(canvas);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

export function shareOnX(text) {
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
