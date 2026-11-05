// Pure geometry helpers, free of the DOM so they can be unit tested.
// Does the segment A-B cross or lie inside the rectangle? (Liang-Barsky clipping)
export function segInRect(ax0, ay0, bx, by, x1, y1, x2, y2) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax0, dy = by - ay0;
  for (const [p, q] of [[-dx, ax0 - x1], [dx, x2 - ax0], [-dy, ay0 - y1], [dy, y2 - ay0]]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}
