export function ghostPointsFrom(charTimes) {
  const points = [];
  let cum = 0;
  for (const c of charTimes || []) {
    cum += Math.max(1, Number(c.n) || 1);
    points.push({ t: Number(c.t) || 0, chars: cum });
  }
  return points;
}

export function ghostCharsAt(points, t) {
  if (!points || !points.length) return 0;
  if (t <= points[0].t) return 0;
  let lo = 0;
  let hi = points.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= t) {
      ans = points[mid].chars;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

// Fractional version for the gliding caret.
//
// Groups consecutive points that share a timestamp into clusters and assumes
// each cluster's characters were typed evenly across the interval from its
// timestamp to the next distinct one. Fresh PBs have ~1-char clusters (true
// per-keystroke interpolation); old PBs whose times were rounded to whole
// seconds have big clusters and this spreads them out instead of letting the
// ghost teleport ~100 chars at each second boundary. `totalTime` (the PB's
// real duration) anchors the last cluster so the ghost finishes when your
// best run actually finished.
export function ghostCharsAtF(points, t, totalTime = 0) {
  if (!points || !points.length) return 0;
  const total = points[points.length - 1].chars;
  const t0 = points[0].t;
  if (t <= t0) return 0;

  const clusters = [];
  let i = 0;
  while (i < points.length) {
    const T = points[i].t;
    let j = i;
    while (j + 1 < points.length && points[j + 1].t === T) j += 1;
    clusters.push({ t: T, from: i === 0 ? 0 : points[i - 1].chars, to: points[j].chars });
    i = j + 1;
  }
  const lastT = clusters[clusters.length - 1].t;
  const end =
    totalTime > lastT
      ? totalTime
      : clusters.length > 1
        ? lastT + (lastT - clusters[clusters.length - 2].t)
        : lastT + 1;
  if (t >= end) return total;

  for (let c = 0; c < clusters.length; c += 1) {
    const nextT = c + 1 < clusters.length ? clusters[c + 1].t : end;
    if (t < nextT) {
      const span = Math.max(0.001, nextT - clusters[c].t);
      const f = (t - clusters[c].t) / span;
      return clusters[c].from + (clusters[c].to - clusters[c].from) * f;
    }
  }
  return total;
}
