import { P, ST } from './state.js';
import { $, uid } from './util.js';
import { OX, bb, commit } from './render.js';
import { col, css } from './env.js';
import { I } from './icons.js';
import { toast } from './report.js';
import { covered, delCol, delRow, insCol, insRow, merge, mergeAt, tgeo } from './tableOps.js';
export { tgeo };
import { snp } from './input.js';
import { cur, selIds, union } from './edit.js';
import { props } from './toolbar.js';

export const TCOL = ['#e03131', '#f08c00', '#2f9e44', '#1971c2', '#9c36b5'];
export const THL = ['rgba(255,224,102,.65)', 'rgba(140,233,154,.6)', 'rgba(116,192,252,.55)', 'rgba(250,162,193,.6)'];
/* links */
const urlRe = /https?:\/\/[^\s]+/;
export function linkOf(e) {
  return e.href || e.t === 'text' && (e.text.match(urlRe) || [])[0] || null;
}
export function normUrl(u) {
  u = u.trim();
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  return /^(https?|mailto):/i.test(u) ? u : '';
}
export function openLink(u) {
  window.open(u, '_blank', 'noopener');
}
export function badgePos(e) {
  const b = bb(e),
    z = P().v.z;
  return [b.x + b.w + 10 / z, b.y - 10 / z];
}
export function linkEd() {
  const c = cur();
  if (!c.length) return;
  const v = P().v,
    U = union(c),
    i = document.createElement('input');
  i.value = c[0].href || '';
  i.placeholder = 'https://… (empty = remove link)';
  i.style.cssText = `position:absolute;left:${Math.max(8, U.x * v.z + v.x + OX() * v.z)}px;top:${Math.max(60, U.y * v.z + v.y - 40)}px;width:260px;font:14px Figtree,sans-serif;background:var(--panel);color:var(--ink);border:1px solid var(--acc);border-radius:6px;padding:5px 8px;z-index:6`;
  $('#main').appendChild(i);
  ST.ed = i;
  setTimeout(() => i.focus(), 0);
  const done = () => {
    if (ST.ed !== i) return;
    ST.ed = null;
    const u = normUrl(i.value);
    i.remove();
    c.forEach(q => {
      if (u) q.href = u;else delete q.href;
    });
    commit();
    props();
  };
  i.addEventListener('blur', done);
  i.addEventListener('keydown', k => {
    if (k.key === 'Enter' || k.key === 'Escape') i.blur();
    k.stopPropagation();
  });
}
/* tables: per-column widths and per-row heights, merged cells, header row, cell color and alignment */
const TBG = ['#ffe3e3', '#fff3bf', '#d3f9d8', '#d0ebff', '#eebefa'];
export function cellAt(e, x, y) {
  const g = tgeo(e), f = (a, v) => {
    let k = 0;
    while (k < a.length - 2 && v >= a[k + 1]) k++;
    return k;
  };
  const i = f(g.ys, y), j = f(g.xs, x), m = mergeAt(e, i, j);
  return m ? { i: m.r, j: m.c } : { i, j };
}
export function tcellRect(e, i, j, g = tgeo(e)) {
  if (i >= e.nr || j >= e.nc) return null;
  const m = mergeAt(e, i, j) || { r: i, c: j, rs: 1, cs: 1 };
  return { x: g.xs[m.c], y: g.ys[m.r], w: g.xs[m.c + m.cs] - g.xs[m.c], h: g.ys[m.r + m.rs] - g.ys[m.r], r: m.r, c: m.c, rs: m.rs, cs: m.cs };
}
const cst = (e, i, j) => (e.cs || {})[i + ',' + j] || {};
function wrapLines(c, text, maxW) {
  const out = [];
  String(text).split('\n').forEach(par => {
    let line = '';
    par.split(/(\s+)/).forEach(w => {
      if (line && c.measureText(line + w).width > maxW && w.trim()) {
        out.push(line.trimEnd());
        line = w.trimStart();
      } else line += w;
    });
    out.push(line);
  });
  return out;
}
const tfs = e => e.fs || 16;
export function drawTable(e) {
  const c = ST.ctx, g = tgeo(e), fs = tfs(e), lh = fs * 1.3, hdr = e.hdr !== false, ink = col(e.stroke);
  c.save();
  c.setLineDash([]);
  const cells = [];
  for (let i = 0; i < e.nr; i++) for (let j = 0; j < e.nc; j++) if (!covered(e, i, j)) cells.push([i, j, tcellRect(e, i, j, g)]);
  cells.forEach(([i, j, r]) => {
    const bg = cst(e, i, j).bg || (hdr && i === 0 ? css('--accbg') : null);
    if (bg) {
      c.fillStyle = bg;
      c.fillRect(r.x, r.y, r.w, r.h);
    }
  });
  c.strokeStyle = ink;
  c.lineWidth = e.sw;
  c.beginPath();
  cells.forEach(([, , r]) => c.rect(r.x, r.y, r.w, r.h));
  c.stroke();
  c.fillStyle = ink;
  c.textBaseline = 'top';
  cells.forEach(([i, j, r]) => {
    const t = e.cells[i] && e.cells[i][j];
    if (!t) return;
    const st = cst(e, i, j), al = st.al || 'l';
    c.font = `${hdr && i === 0 ? 700 : 500} ${fs}px Figtree,system-ui,sans-serif`;
    const L = wrapLines(c, t, r.w - 12);
    c.save();
    c.beginPath();
    c.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    c.clip();
    c.textAlign = al === 'c' ? 'center' : al === 'r' ? 'right' : 'left';
    const x = al === 'c' ? r.x + r.w / 2 : al === 'r' ? r.x + r.w - 6 : r.x + 6, y0 = r.y + Math.max(4, (r.h - L.length * lh) / 2) + (lh - fs) / 2;
    if (st.bg) c.fillStyle = '#1c2230';
    L.forEach((l, k) => c.fillText(l, x, y0 + k * lh));
    c.restore();
  });
  c.restore();
}
export function tablePlace(x, y) {
  const q = snp(x, y),
    id = uid();
  P().els.push({ id, t: 'table', x: q[0], y: q[1], w: 360, h: 132, nr: 3, nc: 3, cw: [120, 120, 120], rh: [44, 44, 44], hdr: true, fs: 16,
    cells: [['', '', ''], ['', '', ''], ['', '', '']], stroke: ST.stroke, fill: 'none', sw: ST.sw, seed: 1 });
  selIds([id]);
  ST.tc = { id, i: 0, j: 0 };
  commit();
  props();
  setTimeout(() => openCell(P().els.find(e => e.id === id), 0, 0), 0);
}
export function tbl(k) {
  const e = cur().find(q => q.t === 'table');
  if (!e) return;
  const tc = ST.tc && ST.tc.id === e.id ? ST.tc : { i: 0, j: 0 }, r = tcellRect(e, tc.i, tc.j) || { r: 0, c: 0, rs: 1, cs: 1 };
  const key = r.r + ',' + r.c, [op, val] = k.split(':');
  if (op === 'ra') insRow(e, r.r, r.r);
  if (op === 'rb') insRow(e, r.r + r.rs, r.r + r.rs - 1);
  if (op === 'rd') delRow(e, r.r);
  if (op === 'cl') insCol(e, r.c, r.c);
  if (op === 'cr') insCol(e, r.c + r.cs, r.c + r.cs - 1);
  if (op === 'cd') delCol(e, r.c);
  if (op === 'hdr') e.hdr = e.hdr === false;
  if (op === 'al' || op === 'bg') {
    e.cs = e.cs || {};
    e.cs[key] = { ...e.cs[key], [op]: val === 'none' ? undefined : val };
  }
  if (op === 'mr' || op === 'md') {
    const msg = merge(e, r.r, r.c, op === 'md');
    if (msg) return toast(msg);
  }
  if (op === 'um') e.mg = (e.mg || []).filter(m => !(m.r === r.r && m.c === r.c));
  if (op === 'ra' || op === 'rb') ST.tc = { id: e.id, i: op === 'ra' ? r.r : r.r + r.rs, j: r.c };
  if (op === 'cl' || op === 'cr') ST.tc = { id: e.id, i: r.r, j: op === 'cl' ? r.c : r.c + r.cs };
  if (op === 'rd' || op === 'cd') ST.tc = { id: e.id, i: Math.min(r.r, e.nr - 1), j: Math.min(r.c, e.nc - 1) };
  commit();
  props();
}
export function tableMenuHTML() {
  const e = cur().find(q => q.t === 'table');
  if (!e) return '<small>Select a table first.</small>';
  const tc = ST.tc && ST.tc.id === e.id ? ST.tc : { i: 0, j: 0 }, st = cst(e, tc.i, tc.j), m = mergeAt(e, tc.i, tc.j);
  const B = (icon, label, short, k, on) => `<button class="b${on ? ' on' : ''}" data-tb="${k}" aria-label="${label}" title="${label}" aria-pressed="${!!on}">${I[icon]}<span>${short}</span></button>`;
  return `<b>Row ${tc.i + 1}</b><div class="seg ic">` + B('rowTop', 'Insert row above', 'Above', 'ra') + B('rowBottom', 'Insert row below', 'Below', 'rb') + (e.nr > 1 ? B('rowRemove', 'Delete row', 'Delete', 'rd') : '') + '</div>' +
    `<b>Column ${tc.j + 1}</b><div class="seg ic">` + B('colLeft', 'Insert column left', 'Left', 'cl') + B('colRight', 'Insert column right', 'Right', 'cr') + (e.nc > 1 ? B('colRemove', 'Delete column', 'Delete', 'cd') : '') + '</div>' +
    '<b>Cell</b><div class="seg ic">' + B('alignLeft', 'Align left', 'Left', 'al:l', (st.al || 'l') === 'l') + B('alignCenter', 'Align center', 'Center', 'al:c', st.al === 'c') + B('alignRight', 'Align right', 'Right', 'al:r', st.al === 'r') + '</div>' +
    '<div class="seg sws">' + ['none', ...TBG].map(c => `<button class="sw${(st.bg || 'none') === c ? ' on' : ''}" data-tb="bg:${c}" aria-label="Cell color ${c === 'none' ? 'none' : c}" style="background:${c === 'none' ? 'repeating-linear-gradient(45deg,var(--line) 0 3px,transparent 3px 6px)' : c}"></button>`).join('') + '</div>' +
    '<div class="seg ic">' + B('merge', 'Merge with the cell on the right', 'Merge →', 'mr') + B('merge', 'Merge with the cell below', 'Merge ↓', 'md') + (m ? B('x', 'Unmerge', 'Unmerge', 'um') : '') + '</div>' +
    '<b>Table</b><div class="seg"><button class="b' + (e.hdr === false ? ' on' : '') + '" data-tb="hdr" aria-pressed="' + (e.hdr === false) + '">No header</button><button class="b' + (e.hdr !== false ? ' on' : '') + '" data-tb="hdr" aria-pressed="' + (e.hdr !== false) + '">Header row</button></div>' +
    '<small class="mhint">Tap a cell to pick it · double-tap to type · drag a grid line to resize · Shift+Enter for a new line</small>';
}
export function openCell(e, i, j) {
  if (!e) return;
  const v = P().v, r = tcellRect(e, i, j), fs = tfs(e), hdr = e.hdr !== false && i === 0, st = cst(e, i, j);
  if (!r) return;
  ST.tc = { id: e.id, i, j };
  const inp = document.createElement('textarea');
  inp.value = e.cells[i] && e.cells[i][j] || '';
  inp.setAttribute('aria-label', `Cell row ${i + 1}, column ${j + 1}`);
  inp.style.cssText = `position:absolute;left:${(r.x + OX()) * v.z + v.x}px;top:${r.y * v.z + v.y}px;width:${r.w * v.z}px;min-height:${r.h * v.z}px;font:${hdr ? 700 : 500} ${fs * v.z}px/1.3 Figtree,sans-serif;text-align:${{ c: 'center', r: 'right' }[st.al] || 'left'};background:var(--panel);color:var(--ink);border:2px solid var(--acc);border-radius:2px;padding:${4 * v.z}px ${6 * v.z}px;z-index:6;box-sizing:border-box;white-space:pre-wrap;overflow:hidden;transform:none`;
  $('#main').appendChild(inp);
  ST.ed = inp;
  const grow = () => {
    inp.style.height = 'auto';
    inp.style.height = Math.max(r.h * v.z, inp.scrollHeight) + 'px';
  };
  grow();
  inp.addEventListener('input', grow);
  setTimeout(() => {
    inp.focus();
    inp.select();
  }, 0);
  const done = nx => {
    if (ST.ed !== inp) return;
    ST.ed = null;
    const val = inp.value;
    inp.remove();
    while (e.cells.length < e.nr) e.cells.push(Array(e.nc).fill(''));
    e.cells[i][j] = val;
    // grow the row so every line of the cell stays visible
    ST.ctx.font = `${hdr ? 700 : 500} ${fs}px Figtree,system-ui,sans-serif`;
    const need = wrapLines(ST.ctx, val, r.w - 12).length * fs * 1.3 + 10, last = r.r + r.rs - 1;
    if (need > r.h) {
      const g = tgeo(e);
      e.rh = g.rh;
      e.rh[last] += need - r.h;
      e.h += need - r.h;
    }
    commit();
    if (nx) {
      // walk to the next visible cell, skipping cells hidden inside a merge
      let k = i * e.nc + j;
      do k += nx; while (k >= 0 && k < e.nr * e.nc && covered(e, Math.floor(k / e.nc), k % e.nc));
      if (k >= 0 && k < e.nr * e.nc) setTimeout(() => openCell(e, Math.floor(k / e.nc), k % e.nc), 0);
    } else props();
  };
  inp.addEventListener('blur', () => done(0));
  inp.addEventListener('keydown', k => {
    k.stopPropagation();
    if (k.key === 'Tab') {
      k.preventDefault();
      done(k.shiftKey ? -1 : 1);
    } else if (k.key === 'Enter' && !k.shiftKey && !k.altKey) {
      k.preventDefault();
      done(r.r + r.rs < e.nr ? e.nc * r.rs : 0);
    } else if (k.key === 'Escape') inp.blur();
  });
}
/* full screen */
