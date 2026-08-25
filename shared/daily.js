import { SNIPPETS } from './snippets.js';

export function dailySnippet(dateStr = new Date().toISOString().slice(0, 10)) {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const pool = SNIPPETS.filter((s) => s.mode !== 'sprint');
  return pool[h % pool.length];
}

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
