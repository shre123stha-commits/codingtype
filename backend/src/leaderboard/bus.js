// Tiny in-process pub/sub for leaderboard changes. Keeps the routes and the
// WebSocket server decoupled: a route publishes, the WS layer broadcasts.
const listeners = new Set();

export function onScore(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitScore(payload) {
  for (const fn of listeners) {
    try {
      fn(payload);
    } catch (err) {
      console.error('[codetype-api] leaderboard listener failed', err?.message || err);
    }
  }
}
