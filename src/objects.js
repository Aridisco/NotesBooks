import { P, ST } from './state.js';
import { $, uid } from './util.js';
import { OX, bb, commit } from './render.js';
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
/* tables */
export const TBB = [['ar', '＋R'], ['ac', '＋C'], ['dr', '−R'], ['dc', '−C']].map(x => `<button class="wb" data-tb="${x[0]}" title="Table: ${{
  ar: 'add row',
  ac: 'add column',
  dr: 'remove last row',
  dc: 'remove last column'
}[x[0]]}" aria-label="Table: ${{
  ar: 'add row',
  ac: 'add column',
  dr: 'remove last row',
  dc: 'remove last column'
}[x[0]]}">${x[1]}</button>`).join('');
export function tablePlace(x, y) {
  const q = snp(x, y),
    id = uid();
  P().els.push({
    id,
    t: 'table',
    x: q[0],
    y: q[1],
    w: 330,
    h: 126,
    nr: 3,
    nc: 3,
    cells: [['', '', ''], ['', '', ''], ['', '', '']],
    stroke: ST.stroke,
    fill: 'none',
    sw: ST.sw,
    seed: 1
  });
  selIds([id]);
  commit();
  props();
  setTimeout(() => openCell(P().els.find(e => e.id === id), 0, 0), 0);
}
export function tbl(k) {
  cur().filter(q => q.t === 'table').forEach(e => {
    const rh = e.h / e.nr,
      cw = e.w / e.nc;
    if (k === 'ar') {
      e.nr++;
      e.h += rh;
      e.cells.push(Array(e.nc).fill(''));
    }
    if (k === 'ac') {
      e.nc++;
      e.w += cw;
      e.cells.forEach(r => r.push(''));
    }
    if (k === 'dr' && e.nr > 1) {
      e.nr--;
      e.h -= rh;
      e.cells.pop();
    }
    if (k === 'dc' && e.nc > 1) {
      e.nc--;
      e.w -= cw;
      e.cells.forEach(r => r.pop());
    }
  });
  commit();
  props();
}
export function openCell(e, i, j) {
  if (!e) return;
  const v = P().v,
    cw = e.w / e.nc,
    rh = e.h / e.nr,
    inp = document.createElement('input');
  inp.value = e.cells[i] && e.cells[i][j] || '';
  inp.style.cssText = `position:absolute;left:${(e.x + j * cw) * v.z + v.x + OX() * v.z}px;top:${(e.y + i * rh) * v.z + v.y}px;width:${cw * v.z}px;height:${rh * v.z}px;font:600 ${Math.max(10, Math.min(18, rh * .5)) * v.z}px Figtree,sans-serif;background:var(--panel);color:var(--ink);border:2px solid var(--acc);padding:0 6px;z-index:6;box-sizing:border-box`;
  $('#main').appendChild(inp);
  ST.ed = inp;
  setTimeout(() => {
    inp.focus();
    inp.select();
  }, 0);
  const done = nx => {
    if (ST.ed !== inp) return;
    ST.ed = null;
    const val = inp.value;
    inp.remove();
    while (e.cells.length < e.nr) e.cells.push([]);
    e.cells[i][j] = val;
    commit();
    if (nx) {
      const k = i * e.nc + j + nx;
      if (k >= 0 && k < e.nr * e.nc) setTimeout(() => openCell(e, Math.floor(k / e.nc), k % e.nc), 0);
    }
  };
  inp.addEventListener('blur', () => done(0));
  inp.addEventListener('keydown', k => {
    k.stopPropagation();
    if (k.key === 'Tab') {
      k.preventDefault();
      done(k.shiftKey ? -1 : 1);
    } else if (k.key === 'Enter') {
      k.preventDefault();
      done(i < e.nr - 1 ? e.nc : 0);
    } else if (k.key === 'Escape') inp.blur();
  });
}
/* full screen */
