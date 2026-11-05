// Table geometry and structure edits, kept free of the DOM so they can be unit tested.
// Fills in the geometry of older tables and scales it to the table's current size.
export function tgeo(e) {
  if (!e.cw || e.cw.length !== e.nc) e.cw = Array(e.nc).fill(e.w / e.nc);
  if (!e.rh || e.rh.length !== e.nr) e.rh = Array(e.nr).fill(e.h / e.nr);
  const sx = e.w / e.cw.reduce((a, b) => a + b, 0), sy = e.h / e.rh.reduce((a, b) => a + b, 0);
  const cw = e.cw.map(v => v * sx), rh = e.rh.map(v => v * sy), xs = [e.x], ys = [e.y];
  cw.forEach(v => xs.push(xs[xs.length - 1] + v));
  rh.forEach(v => ys.push(ys[ys.length - 1] + v));
  return { cw, rh, xs, ys };
}
export const mergeAt = (e, i, j) => (e.mg || []).find(m => i >= m.r && i < m.r + m.rs && j >= m.c && j < m.c + m.cs);
export const covered = (e, i, j) => {
  const m = mergeAt(e, i, j);
  return m && (m.r !== i || m.c !== j);
};

// Moves cell styles to new coordinates after rows or columns are inserted or removed (null drops the style).
function remap(e, f) {
  const o = {};
  Object.entries(e.cs || {}).forEach(([k, v]) => {
    const n = f(...k.split(',').map(Number));
    if (n) o[n.join(',')] = v;
  });
  e.cs = o;
}
export function insRow(e, k, ref) {
  e.rh = tgeo(e).rh;
  const h = e.rh[ref];
  e.cells.splice(k, 0, Array(e.nc).fill(''));
  e.rh.splice(k, 0, h);
  e.nr++;
  e.h += h;
  remap(e, (i, j) => [i >= k ? i + 1 : i, j]);
  (e.mg || []).forEach(m => m.r >= k ? m.r++ : k < m.r + m.rs && m.rs++);
}
export function insCol(e, k, ref) {
  e.cw = tgeo(e).cw;
  const w = e.cw[ref];
  e.cells.forEach(r => r.splice(k, 0, ''));
  e.cw.splice(k, 0, w);
  e.nc++;
  e.w += w;
  remap(e, (i, j) => [i, j >= k ? j + 1 : j]);
  (e.mg || []).forEach(m => m.c >= k ? m.c++ : k < m.c + m.cs && m.cs++);
}
export function delRow(e, k) {
  if (e.nr < 2) return;
  const g = tgeo(e);
  (e.mg || []).forEach(m => {
    if (m.r === k && m.rs > 1) e.cells[k + 1][m.c] = e.cells[k][m.c];
  });
  e.cells.splice(k, 1);
  e.h -= g.rh[k];
  e.rh = g.rh;
  e.rh.splice(k, 1);
  e.nr--;
  remap(e, (i, j) => i === k ? null : [i > k ? i - 1 : i, j]);
  e.mg = (e.mg || []).map(m => m.r > k ? { ...m, r: m.r - 1 } : k < m.r + m.rs ? { ...m, rs: m.rs - 1 } : m).filter(m => m.rs > 0 && m.rs * m.cs > 1);
}
export function delCol(e, k) {
  if (e.nc < 2) return;
  const g = tgeo(e);
  (e.mg || []).forEach(m => {
    if (m.c === k && m.cs > 1) e.cells[m.r][k + 1] = e.cells[m.r][k];
  });
  e.cells.forEach(r => r.splice(k, 1));
  e.w -= g.cw[k];
  e.cw = g.cw;
  e.cw.splice(k, 1);
  e.nc--;
  remap(e, (i, j) => j === k ? null : [i, j > k ? j - 1 : j]);
  e.mg = (e.mg || []).map(m => m.c > k ? { ...m, c: m.c - 1 } : k < m.c + m.cs ? { ...m, cs: m.cs - 1 } : m).filter(m => m.cs > 0 && m.rs * m.cs > 1);
}
// Grows the merged area of the current cell by one column (right) or one row (down), keeping the text of every absorbed cell.
export function merge(e, i, j, down) {
  e.mg = e.mg || [];
  let m = mergeAt(e, i, j);
  if (!m) e.mg.push(m = { r: i, c: j, rs: 1, cs: 1 });
  const add = [];
  if (down) {
    if (m.r + m.rs >= e.nr) return;
    for (let c = m.c; c < m.c + m.cs; c++) add.push([m.r + m.rs, c]);
  } else {
    if (m.c + m.cs >= e.nc) return;
    for (let r = m.r; r < m.r + m.rs; r++) add.push([r, m.c + m.cs]);
  }
  const others = e.mg.filter(o => o !== m && add.some(([r, c]) => r >= o.r && r < o.r + o.rs && c >= o.c && c < o.c + o.cs));
  // another merged block sticking out of the new area cannot be absorbed cleanly
  if (others.some(o => down ? o.c < m.c || o.c + o.cs > m.c + m.cs || o.rs > 1 : o.r < m.r || o.r + o.rs > m.r + m.rs || o.cs > 1)) return 'Unmerge the neighbouring cells first.';
  e.mg = e.mg.filter(o => !others.includes(o));
  const txt = [e.cells[m.r][m.c], ...add.map(([r, c]) => e.cells[r][c])].filter(Boolean);
  add.forEach(([r, c]) => e.cells[r][c] = '');
  e.cells[m.r][m.c] = txt.join('\n');
  down ? m.rs++ : m.cs++;
}
