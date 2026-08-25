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
