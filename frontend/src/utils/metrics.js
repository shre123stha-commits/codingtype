const round1 = (n) => Math.round(n * 10) / 10;

export function wpmFromChars(chars, elapsedSec) {
  if (elapsedSec <= 0) return 0;
  return (chars / 5) / (elapsedSec / 60);
}

export function burstWpm(charTimes, elapsedSec, windowSec = 5) {
  if (elapsedSec <= 0) return 0;
  const from = Math.max(0, elapsedSec - windowSec);
  const span = Math.min(windowSec, elapsedSec);
  let chars = 0;
  for (const entry of charTimes) {
    if (entry.t > from) chars += entry.n;
  }
  if (span <= 0) return 0;
  return (chars / 5) / (span / 60);
}

export function consistencyFromEvents(eventLog) {
  const gaps = [];
  for (let i = 1; i < eventLog.length; i++) {
    const gap = eventLog[i].t - eventLog[i - 1].t;
    if (gap >= 0 && gap <= 1.5) gaps.push(gap);
  }
  if (gaps.length < 3) return 0;
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (mean <= 0) return 0;
  const variance = gaps.reduce((a, b) => a + (b - mean) * (b - mean), 0) / gaps.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));
}

export function stutterBuckets(eventLog, bucketMs = 1000, stutterMs = 850) {
  if (!eventLog.length) return [];
  const last = eventLog[eventLog.length - 1];
  const seconds = Math.max(1, Math.ceil(last.t * 1000 / bucketMs));
  const buckets = Array.from({ length: seconds }, () => ({ t: 0, cost: 0, errors: 0, backspaces: 0 }));
  for (let i = 0; i < eventLog.length; i++) {
    const ev = eventLog[i];
    const idx = Math.min(seconds - 1, Math.floor(ev.t * 1000 / bucketMs));
    buckets[idx].t = (idx + 1) * 0.5;
    if (ev.back) buckets[idx].backspaces += 1;
    if (!ev.ok && !ev.back) buckets[idx].errors += 1;
    if (i > 0) {
      const gap = ev.t - eventLog[i - 1].t;
      if (gap * 1000 > stutterMs) buckets[idx].cost += (gap * 1000 - stutterMs) / 1000;
    }
  }
  return buckets;
}

export function buildRunStats(s, now) {
  const elapsed = Math.max(0.1, (now - s.startTime - s.pausedMs) / 1000);
  const wpm = Math.round(wpmFromChars(s.correctChars, elapsed));
  const rawWpm = Math.round(wpmFromChars(s.rawChars, elapsed));
  const accuracy = s.attempts ? Math.round(((s.attempts - s.errorCount) / s.attempts) * 1000) / 10 : 100;
  const consistency = consistencyFromEvents(s.eventLog);
  const cpm = Math.round((s.rawChars * 60) / elapsed);
  return {
    wpm,
    rawWpm,
    cpm,
    accuracy,
    consistency,
    timeSec: round1(elapsed),
    errors: s.errorCount,
    backspaces: s.backspaces,
    chars: s.correctChars
  };
}
