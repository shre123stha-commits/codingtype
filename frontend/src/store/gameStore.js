import { create } from 'zustand';

import { prepareSnippet } from '../utils/snippetEngine.js';
import { frictionKey } from '../utils/symbols.js';
import { burstWpm, buildRunStats, wpmFromChars } from '../utils/metrics.js';
import { THEME_IDS } from '../utils/themes.js';

const OPENERS = new Set(['(', '[', '{', '"', "'", '`']);

function initialTheme() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('codetype-theme');
      if (THEME_IDS.includes(saved)) return saved;
    }
  } catch {
    /* private mode */
  }
  return 'obsidian';
}

const freshSession = () => ({
  pointer: 0,
  errors: {},
  auto: {},
  ghost: {},
  pendingIndent: null,
  history: [],
  backspaces: 0,
  attempts: 0,
  correctChars: 0,
  rawChars: 0,
  errorCount: 0,
  charTimes: [],
  eventLog: [],
  samples: [],
  symbolStats: {},
  lineStats: {},
  startTime: 0,
  pausedMs: 0,
  pauseStart: 0,
  lastRun: null
});

function bumpSymbol(stats, key, isError) {
  if (!key) return stats;
  const cur = stats[key] || { t: 0, e: 0 };
  const next = isError ? { t: cur.t, e: cur.e + 1 } : { t: cur.t + 1, e: cur.e };
  return { ...stats, [key]: next };
}

function bumpLine(stats, line, patch) {
  const cur = stats[line] || { e: 0, p: 0, b: 0 };
  const next = { ...cur, ...patch };
  return { ...stats, [line]: next };
}

function cleanGhost(ghost, pointer) {
  let changed = false;
  const out = {};
  for (const [open, close] of Object.entries(ghost)) {
    if (Number(open) >= pointer || Number(close) < pointer) {
      changed = true;
    } else {
      out[open] = Number(close);
    }
  }
  return changed ? out : ghost;
}

export const useGameStore = create((set, get) => ({
  catalog: [],
  catalogSource: 'loading',
  apiOnline: false,
  authUser: null, // signed-in email, or null = guest (local data)
  uiOpen: false,
  theme: initialTheme(),

  mode: 'algorithm',
  language: 'javascript',
  strictMode: false,
  ghostMode: true,
  indentAssist: true,
  blind: null,

  view: 'train',
  deckTab: 'daily',
  inputLocked: false,
  raceGhost: null,

  snippet: null,
  status: 'idle',

  ...freshSession(),

  setCatalog(list, source) {
    set({ catalog: list, catalogSource: source });
  },
  setApiOnline(v) {
    set({ apiOnline: v });
  },
  setAuthUser(v) {
    set({ authUser: v });
  },
  setUiOpen(v) {
    set({ uiOpen: v });
  },
  setTheme(t) {
    if (!THEME_IDS.includes(t)) return;
    try {
      localStorage.setItem('codetype-theme', t);
    } catch {
      /* private mode */
    }
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = t;
    }
    set({ theme: t });
  },
  setMode(v) {
    set({ mode: v });
  },
  setLanguage(v) {
    set({ language: v });
  },
  setStrictMode(v) {
    set({ strictMode: v });
  },
  setGhostMode(v) {
    set({ ghostMode: v });
  },
  setIndentAssist(v) {
    set({ indentAssist: v });
  },
  setView(v) {
    set({ view: v });
  },
  setDeckTab(v) {
    set({ deckTab: v });
  },
  cycleBlind() {
    const next = get().blind === null ? 3 : get().blind === 3 ? 0 : null;
    set({ blind: next });
  },
  lockInput(v) {
    set({ inputLocked: v });
  },
  setRaceGhost(g) {
    set({ raceGhost: g });
  },

  // raw may be a full snippet (with .code) or a catalog summary (no code).
  // Summaries fetch their code on demand so the catalog stays light.
  async loadSnippet(raw) {
    let full = raw;
    if (full && !full.code && full.id) {
      try {
        const res = await fetch(`/api/snippets/${encodeURIComponent(full.id)}`);
        if (!res.ok) throw new Error('snippet fetch failed');
        full = await res.json();
      } catch {
        return null;
      }
    }
    if (!full || !full.code) return null;
    const snippet = prepareSnippet(full);
    set({ snippet, status: 'idle', ...freshSession() });
    return snippet;
  },

  restart() {
    if (!get().snippet) return;
    set({ status: 'idle', ...freshSession() });
  },

  togglePause(now) {
    const s = get();
    if (s.status === 'running') {
      set({ status: 'paused', pauseStart: now });
    } else if (s.status === 'paused') {
      set({
        status: 'running',
        pausedMs: s.pausedMs + (now - s.pauseStart),
        pauseStart: 0
      });
    }
  },

  elapsedAt(now) {
    const s = get();
    if (!s.startTime) return 0;
    const end = s.status === 'paused' ? s.pauseStart : now;
    return Math.max(0, (end - s.startTime - s.pausedMs) / 1000);
  },

  liveWpm(now) {
    const s = get();
    return Math.round(wpmFromChars(s.correctChars, s.elapsedAt(now)));
  },

  tick(now) {
    const s = get();
    if (s.status !== 'running' || !s.startTime) return;
    const elapsed = s.elapsedAt(now);
    const last = s.samples[s.samples.length - 1];
    if (elapsed < 1 || (last && elapsed - last.t < 0.95)) return;
    const t = Math.round(elapsed * 10) / 10;
    const sample = {
      t,
      wpm: Math.round(wpmFromChars(s.correctChars, elapsed)),
      raw: Math.round(wpmFromChars(s.rawChars, elapsed)),
      cpm: Math.round((s.rawChars * 60) / elapsed),
      burst: Math.round(burstWpm(s.charTimes, elapsed))
    };
    set({ samples: [...s.samples, sample] });
  },

  handleKey(key, now) {
    const s = get();
    const sn = s.snippet;
    if (!sn || s.status === 'finished' || s.inputLocked) return;
    if (key === 'Escape') {
      get().togglePause(now);
      return;
    }
    if (s.status === 'paused') return;

    const { code, charLine, indentRuns, matchClose, lines } = sn;
    const wasIdle = s.status === 'idle';
    const startTime = wasIdle ? now : s.startTime;

    const lineAt = (i) => {
      if (charLine[i] !== undefined) return charLine[i];
      for (let li = 0; li < lines.length; li++) {
        if (lines[li].end === i) return li;
      }
      return lines.length - 1;
    };

    const w = {
      pointer: s.pointer,
      errors: s.errors,
      auto: s.auto,
      ghost: s.ghost,
      pendingIndent: s.pendingIndent,
      history: s.history,
      backspaces: s.backspaces,
      attempts: s.attempts,
      correctChars: s.correctChars,
      rawChars: s.rawChars,
      errorCount: s.errorCount,
      charTimes: s.charTimes,
      eventLog: s.eventLog,
      samples: s.samples,
      symbolStats: s.symbolStats,
      lineStats: s.lineStats
    };

    const t = (now - startTime) / 1000;
    const pushEvent = (i, ok, back) => {
      w.eventLog = [...w.eventLog, { t, i, ok, back }];
    };

    const finish = () => {
      const stats = buildRunStats(
        {
          startTime,
          pausedMs: s.pausedMs,
          correctChars: w.correctChars,
          rawChars: w.rawChars,
          attempts: w.attempts,
          errorCount: w.errorCount,
          backspaces: w.backspaces,
          eventLog: w.eventLog
        },
        now
      );
      const charStats = {};
      for (const ev of w.eventLog) {
        if (ev.back) continue;
        const ch = code[ev.i];
        if (ch == null) continue;
        const cur = charStats[ch] || { t: 0, e: 0 };
        charStats[ch] = ev.ok ? { t: cur.t + 1, e: cur.e } : { t: cur.t, e: cur.e + 1 };
      }
      const lastRun = {
        id: crypto.randomUUID(),
        mode: s.mode,
        language: s.language,
        snippet: {
          id: sn.id,
          title: sn.title,
          source: sn.source,
          chars: sn.charCount
        },
        stats,
        samples: w.samples,
        symbolStats: w.symbolStats,
        lineStats: w.lineStats,
        eventLog: w.eventLog,
        charTimes: w.charTimes,
        charStats,
        daily: Boolean(sn.isDaily),
        finishedAt: Date.now()
      };
      set({
        ...w,
        status: 'finished',
        startTime,
        lastRun
      });
    };

    const commit = () => {
      w.ghost = cleanGhost(w.ghost, w.pointer);
      set({
        ...w,
        status: wasIdle && (w.pointer > 0 || w.attempts > 0) ? 'running' : s.status,
        startTime: wasIdle ? startTime : s.startTime
      });
    };

    if (key === 'Backspace') {
      if (w.pointer > 0 && w.history.length > 0) {
        const last = w.history[w.history.length - 1];
        w.pointer = last.i;
        w.history = w.history.slice(0, -1);
        w.backspaces += 1;
        if (last.err) {
          const errors = { ...w.errors };
          delete errors[last.i];
          w.errors = errors;
          w.errorCount = Math.max(0, w.errorCount - 1);
        }
        if (last.assisted) {
          const auto = { ...w.auto };
          delete auto[last.i];
          w.auto = auto;
          if (last.i === 0 || code[last.i - 1] === '\n') {
            const runEnd = indentRuns[last.i];
            if (runEnd > last.i && w.pointer === last.i) {
              w.pendingIndent = [last.i, runEnd];
            }
          }
        }
        if (last.user) {
          w.rawChars = Math.max(0, w.rawChars - 1);
        }
        w.lineStats = bumpLine(w.lineStats, lineAt(w.pointer), { b: 1 });
        pushEvent(w.pointer, false, true);
      }
      commit();
      return;
    }

    const pending = w.pendingIndent;

    const consumeRun = (from, to, user) => {
      for (let i = from; i < to; i++) {
        w.history = [...w.history, { i, user, assisted: !user, err: null }];
        if (!user) w.auto = { ...w.auto, [i]: true };
      }
      if (user) {
        const n = to - from;
        w.rawChars += n;
        w.correctChars += n;
        w.charTimes = [...w.charTimes, { t, n }];
      }
      w.pointer = to;
    };

    if (key === 'Tab') {
      if (pending) {
        w.attempts += 1;
        pushEvent(pending[0], true, false);
        consumeRun(pending[0], pending[1], true);
        w.pendingIndent = null;
        commit();
        if (w.pointer >= code.length) finish();
        return;
      }
      const expected = w.pointer < code.length ? code[w.pointer] : null;
      if (expected === ' ') {
        w.attempts += 1;
        const isLineStart = w.pointer === 0 || code[w.pointer - 1] === '\n';
        let to = w.pointer + 1;
        if (isLineStart) to = Math.max(to, indentRuns[w.pointer] || to);
        const from = w.pointer;
        pushEvent(from, true, false);
        consumeRun(from, to, true);
        commit();
        if (w.pointer >= code.length) finish();
        return;
      }
      w.attempts += 1;
      w.errorCount += 1;
      w.errors = { ...w.errors, [w.pointer]: '\t' };
      w.symbolStats = bumpSymbol(w.symbolStats, frictionKey(code, w.pointer), true);
      w.lineStats = bumpLine(w.lineStats, lineAt(w.pointer), { e: 1 });
      pushEvent(w.pointer, false, false);
      if (!s.strictMode) {
        w.history = [...w.history, { i: w.pointer, user: true, assisted: false, err: true }];
        w.rawChars += 1;
        w.pointer += 1;
      }
      commit();
      if (w.pointer >= code.length) finish();
      return;
    }

    if (key === 'Enter') {
      const expected = w.pointer < code.length ? code[w.pointer] : null;
      if (expected === '\n') {
        w.attempts += 1;
        const from = w.pointer;
        w.history = [...w.history, { i: from, user: true, assisted: false, err: null }];
        w.rawChars += 1;
        w.correctChars += 1;
        w.charTimes = [...w.charTimes, { t, n: 1 }];
        w.pointer += 1;
        pushEvent(from, true, false);
        if (s.indentAssist && w.pointer < code.length && code[w.pointer] === ' ') {
          const runEnd = indentRuns[w.pointer];
          if (runEnd > w.pointer) w.pendingIndent = [w.pointer, runEnd];
        }
        commit();
        if (w.pointer >= code.length) finish();
        return;
      }
      w.attempts += 1;
      w.errorCount += 1;
      w.errors = { ...w.errors, [w.pointer]: '\n' };
      w.lineStats = bumpLine(w.lineStats, lineAt(w.pointer), { e: 1 });
      pushEvent(w.pointer, false, false);
      if (!s.strictMode) {
        w.history = [...w.history, { i: w.pointer, user: true, assisted: false, err: true }];
        w.rawChars += 1;
        w.pointer += 1;
      }
      commit();
      if (w.pointer >= code.length) finish();
      return;
    }

    if (pending) {
      if (key === ' ') {
        w.attempts += 1;
        const from = w.pointer;
        const to = from + 1;
        if (to >= pending[1]) w.pendingIndent = null;
        else w.pendingIndent = [to, pending[1]];
        pushEvent(from, true, false);
        consumeRun(from, to, true);
        commit();
        if (w.pointer >= code.length) finish();
        return;
      }
      if (s.strictMode) {
        w.attempts += 1;
        w.errorCount += 1;
        w.errors = { ...w.errors, [w.pointer]: key };
        w.lineStats = bumpLine(w.lineStats, lineAt(w.pointer), { e: 1 });
        pushEvent(w.pointer, false, false);
        commit();
        return;
      }
      w.pendingIndent = null;
      consumeRun(pending[0], pending[1], false);
    }

    if (w.pointer >= code.length) return;

    const expected = code[w.pointer];
    if (key === expected) {
      w.attempts += 1;
      const from = w.pointer;
      if (w.errors[from] !== undefined) {
        const errors = { ...w.errors };
        delete errors[from];
        w.errors = errors;
      }
      w.history = [...w.history, { i: from, user: true, assisted: false, err: null }];
      w.rawChars += 1;
      w.correctChars += 1;
      w.charTimes = [...w.charTimes, { t, n: 1 }];
      w.pointer += 1;
      pushEvent(from, true, false);
      w.symbolStats = bumpSymbol(w.symbolStats, frictionKey(code, from), false);
      if (s.ghostMode && OPENERS.has(key) && matchClose[from] !== undefined) {
        w.ghost = { ...w.ghost, [from]: matchClose[from] };
      }
      commit();
      if (w.pointer >= code.length) finish();
      return;
    }

    w.attempts += 1;
    w.errorCount += 1;
    w.errors = { ...w.errors, [w.pointer]: key };
    w.symbolStats = bumpSymbol(w.symbolStats, frictionKey(code, w.pointer), true);
    w.lineStats = bumpLine(w.lineStats, lineAt(w.pointer), { e: 1 });
    pushEvent(w.pointer, false, false);
    if (!s.strictMode) {
      w.history = [...w.history, { i: w.pointer, user: true, assisted: false, err: true }];
      w.rawChars += 1;
      w.pointer += 1;
    }
    commit();
    if (w.pointer >= code.length) finish();
  }
}));

if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = useGameStore.getState().theme;
}
