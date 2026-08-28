// Live rival-cursor position for 1v1 races.
//
// The race socket reports the opponent's character count in discrete pings
// (bots every ~350ms, human rivals every ~250ms). Naively rendering the
// latest report makes the caret freeze, then teleport to each report.
//
// Instead we measure the rival's recent typing speed (averaged over the last
// ~1s of reports, so the bot's ±1-char jitter can't shake it) and keep the
// cursor gliding at that speed between reports. A hard cap keeps it from
// running more than LEAD_CAP ahead of the last position the server actually
// confirmed. Returns fractional character positions — LineRow renders the
// fraction as a sub-character slide.

const LEAD_CAP_SEC = 0.9;

let reports = []; // [{ t, chars }] — most recent position reports
let frozenPos = null;
let displayFloor = 0; // the cursor never walks backwards, even when a
// velocity correction would briefly pull the projection below it
let raceKey = null;

export function rivalCursorReset(code, chars = 0) {
  raceKey = code || null;
  reports = [{ t: Date.now(), chars: Number(chars) || 0 }];
  frozenPos = null;
  displayFloor = Number(chars) || 0;
}

// a new position report — monotonic (bot jitter can dip a char; the cursor
// must never walk backwards)
export function rivalCursorPush(chars) {
  const n = Number(chars) || 0;
  const last = reports[reports.length - 1];
  if (!last || n <= last.chars) return;
  reports.push({ t: Date.now(), chars: n });
  if (reports.length > 24) reports.splice(0, reports.length - 24);
}

// the rival finished (or the race froze them) — park exactly where they are
export function rivalCursorFreeze(chars) {
  frozenPos = Number(chars) || 0;
  displayFloor = frozenPos;
}

// call once per render tick
export function rivalCursorChars(now) {
  if (frozenPos !== null) return frozenPos;
  const n = reports.length;
  if (!n) return 0;
  const last = reports[n - 1];
  if (n < 2) return last.chars;
  // average speed over the last ~1s of reports (start at the second-newest —
  // the newest vs itself is zero time, zero speed)
  let ref = null;
  for (let i = n - 2; i >= 0; i -= 1) {
    if (last.t - reports[i].t <= 1000) {
      ref = reports[i];
      break;
    }
  }
  if (!ref) ref = reports[0];
  const dt = (last.t - ref.t) / 1000;
  const vel = dt > 0.15 ? (last.chars - ref.chars) / dt : 0;
  const lead = Math.min(Math.max(0, (now - last.t) / 1000), LEAD_CAP_SEC);
  const projected = last.chars + vel * lead;
  // never walk backwards: when a burst ends, the velocity estimate drops and
  // the projection can dip below where we already drew the cursor
  if (projected > displayFloor) displayFloor = projected;
  return displayFloor;
}

export function rivalCursorActive(code) {
  return Boolean(code) && raceKey === code;
}
