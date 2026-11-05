import { P, ST } from './state.js';
import { $, cv, uid } from './util.js';
import { save } from './cloud.js';
import { css, custom, inkFor, needX } from './env.js';
import { A4H, A4W, bb, cl, commit, draw, drawR, fitA4, tfit } from './render.js';
import { render } from './notebooks.js';
import { bkBmp } from './books.js';
import { props } from './toolbar.js';
import { side } from './sidebar.js';
import { isValidBackup } from './backup.js';
import { codeFit } from './code.js';
import { buildPdf } from './pdf.js';
import { toast } from './report.js';

export function cur() {
  const ids = ST.msel.length ? ST.msel : ST.sel ? [ST.sel] : [];
  return P().els.filter(q => ids.includes(q.id));
}
export function selIds(ids) {
  ST.sel = ids.length === 1 ? ids[0] : null;
  ST.msel = ids.length > 1 ? ids : [];
}
export function union(a) {
  let x1 = 1e9,
    y1 = 1e9,
    x2 = -1e9,
    y2 = -1e9;
  a.forEach(e => {
    const q = bb(e);
    x1 = Math.min(x1, q.x);
    y1 = Math.min(y1, q.y);
    x2 = Math.max(x2, q.x + q.w);
    y2 = Math.max(y2, q.y + q.h);
  });
  return {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1
  };
}
function pasteClip(arr) {
  const ids = [];
  arr.forEach(c => {
    c.id = uid();
    c.x += 28;
    c.y += 28;
    P().els.push(c);
    ids.push(c.id);
  });
  window._clip = JSON.stringify(arr);
  selIds(ids);
  commit();
  props();
}
export function dupe() {
  const c = JSON.parse(JSON.stringify(cur()));
  if (c.length) pasteClip(c);
}
export function zord(d) {
  const ids = new Set(cur().map(q => q.id));
  if (!ids.size) return;
  const a = P().els,
    m = a.filter(q => ids.has(q.id)),
    r = a.filter(q => !ids.has(q.id));
  P().els = d > 0 ? [...r, ...m] : [...m, ...r];
  commit();
  props();
}
export function align(k) {
  const its = cur();
  if (its.length < 2) return;
  const U = union(its);
  its.forEach(e => {
    const b = bb(e);
    if (k === 'l') e.x += U.x - b.x;
    if (k === 'c') e.x += U.x + U.w / 2 - b.x - b.w / 2;
    if (k === 'r') e.x += U.x + U.w - b.x - b.w;
    if (k === 't') e.y += U.y - b.y;
    if (k === 'm') e.y += U.y + U.h / 2 - b.y - b.h / 2;
    if (k === 'b') e.y += U.y + U.h - b.y - b.h;
  });
  commit();
  props();
}
export const ALN = () => ST.msel.length > 1 ? [['l', '⇤'], ['c', '⇔'], ['r', '⇥'], ['t', '⇧'], ['m', '⇕'], ['b', '⇩']].map(x => `<button class="wb" data-al="${x[0]}" title="Align" aria-label="Align">${x[1]}</button>`).join('') + '<span class="sep"></span>' : '';
export const ahHTML = s => '<select id="ahs" title="Arrowheads">' + [['arrow', '→'], ['both', '↔'], ['none', '—']].map(x => `<option value="${x[0]}" ${(s && s.ah || ST.tah) === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('') + '</select>';
export const dssHTML = s => '<select id="dss" title="Line style">' + ['solid', 'dashed', 'dotted'].map(k => `<option value="${k}" ${(s && s.ds || ST.tds) === k ? 'selected' : ''}>${k}</option>`).join('') + '</select>';
export function fitAll() {
  const p = P(),
    W = cv.clientWidth,
    H = cv.clientHeight;
  if (p.mode === 'a4') {
    fitA4(p);
    draw();
    return;
  }
  if (!p.els.length) {
    p.v = {
      x: 0,
      y: 0,
      z: 1
    };
    draw();
    return;
  }
  const U = union(p.els),
    z = Math.max(.2, Math.min(2, (W - 120) / Math.max(U.w, 1), (H - 160) / Math.max(U.h, 1)));
  p.v = {
    z,
    x: (W - U.w * z) / 2 - U.x * z,
    y: (H - U.h * z) / 2 - U.y * z
  };
  save();
  draw();
}
const IMC = new Map();
export function imgSrc(e) {
  const k = e.id + e.src.length;
  let i = IMC.get(k);
  if (!i) {
    i = new Image();
    i.onload = () => draw();
    i.src = e.src;
    IMC.set(k, i);
  }
  return i;
}
function addImage(f) {
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1000 / Math.max(im.width, im.height)),
        c = document.createElement('canvas');
      c.width = im.width * k;
      c.height = im.height * k;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      const src = f.type === 'image/png' && f.size < 400000 ? r.result : c.toDataURL('image/jpeg', .85),
        w = Math.min(420, c.width),
        h = w * c.height / c.width,
        p = P(),
        v = p.v,
        q = cl([(cv.clientWidth / 2 - v.x) / v.z - w / 2, (cv.clientHeight / 2 - v.y) / v.z - h / 2]),
        id = uid();
      p.els.push({
        id,
        t: 'img',
        x: q[0],
        y: q[1],
        w,
        h,
        stroke: ST.stroke,
        fill: 'none',
        sw: ST.sw,
        seed: 1,
        src
      });
      selIds([id]);
      commit();
      props();
    };
    im.src = r.result;
  };
  r.readAsDataURL(f);
}
$('#imgf').onchange = e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) addImage(f);
};
cv.addEventListener('dragover', e => e.preventDefault());
cv.addEventListener('drop', e => {
  e.preventDefault();
  [...e.dataTransfer.files].filter(f => f.type.startsWith('image/')).forEach(addImage);
});
addEventListener('paste', e => {
  if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
  const f = [...(e.clipboardData ? e.clipboardData.files : [])].find(f => f.type.startsWith('image/'));
  if (f) {
    e.preventDefault();
    addImage(f);
    return;
  }
  if (window._clip) {
    e.preventDefault();
    pasteClip(JSON.parse(window._clip));
  }
});
$('#panel').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'cls' || t.id === 'cln') {
    const c = cur().filter(q => q.t === 'code');
    if (t.id === 'cls') ST.clang = t.value;
    c.forEach(q => {
      if (t.id === 'cls') q.lang = t.value;else q.nums = t.checked;
      codeFit(q);
    });
    if (c.length) commit();
    props();
  }
  if (t.id === 'ffs') {
    ST.tff = t.value;
    if (ST.tff !== 'hand' && ST.tff !== 'sans') needX();
    const c = cur().filter(q => q.t === 'text');
    c.forEach(q => {
      q.ff = ST.tff;
      tfit(q);
    });
    if (c.length) commit();
    props();
  }
  if (t.id === 'ahs') {
    ST.tah = t.value;
    const c = cur().filter(q => q.t === 'arrow' || q.t === 'curve');
    c.forEach(q => q.ah = ST.tah);
    if (c.length) commit();
    props();
  }
  if (t.id === 'dss') {
    ST.tds = t.value;
    const c = cur().filter(q => !['text', 'math', 'img'].includes(q.t));
    c.forEach(q => q.ds = ST.tds);
    if (c.length) commit();
    props();
  }
});
const dl = (bl, name) => {
  const u = URL.createObjectURL(bl),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
};
// Draws a whole page (A4 sheet, or the bounding box of an infinite page) to an offscreen canvas.
function pageCanvas(p, k = 2) {
  let a = 0,
    b = 0,
    w = A4W,
    h = A4H;
  if (p.mode !== 'a4') {
    if (!p.els.length) return null;
    let x1 = 1e9,
      y1 = 1e9,
      x2 = -1e9,
      y2 = -1e9;
    p.els.forEach(e => {
      const q = bb(e);
      x1 = Math.min(x1, q.x);
      y1 = Math.min(y1, q.y);
      x2 = Math.max(x2, q.x + q.w);
      y2 = Math.max(y2, q.y + q.h);
    });
    a = x1 - 40;
    b = y1 - 40;
    w = x2 - x1 + 80;
    h = y2 - y1 + 80;
  }
  const c = document.createElement('canvas');
  c.width = w * k;
  c.height = h * k;
  const g = c.getContext('2d'),
    old = ST.ctx,
    oi = ST.INK;
  ST.ctx = g;
  ST.INK = inkFor(p);
  g.fillStyle = custom(p) ? p.bg : css('--panel');
  g.fillRect(0, 0, c.width, c.height);
  g.setTransform(k, 0, 0, k, -a * k, -b * k);
  if (p.bk) {
    const bm = bkBmp(p);
    if (bm) g.drawImage(bm, 0, 0, A4W, A4W * bm.height / bm.width);
  }
  p.els.forEach(drawR);
  ST.ctx = old;
  ST.INK = oi;
  c.pt = p.mode === 'a4' ? [595.28, 841.89] : [w * .75, h * .75];
  return c;
}
export function exportPNG() {
  const p = P(),
    c = pageCanvas(p);
  if (c) c.toBlob(bl => dl(bl, (p.name || 'page') + '.png'), 'image/png');else toast('This page is empty.');
}
export async function exportPDF(pages, name) {
  const out = [];
  for (const p of pages) {
    const c = pageCanvas(p);
    if (!c) continue;
    const bl = await new Promise(r => c.toBlob(r, 'image/jpeg', .92));
    out.push({
      jpg: new Uint8Array(await bl.arrayBuffer()),
      pw: c.width,
      ph: c.height,
      wpt: c.pt[0],
      hpt: c.pt[1]
    });
  }
  if (!out.length) return toast('Nothing to export: the pages are empty.');
  dl(new Blob([buildPdf(out)], {
    type: 'application/pdf'
  }), name + '.pdf');
}
$('#exp').onclick = exportPNG;
$('#bak').onclick = () => dl(new Blob([JSON.stringify({
  nbs: ST.S.nbs
})], {
  type: 'application/json'
}), 'sketchbooks-backup.json');
$('#imp').onclick = () => $('#ifile').click();
$('#ifile').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!isValidBackup(d)) throw new Error('Not a valid backup file');
    d.nbs.forEach(n => {
      n.id = uid();
      n.open = true;
      n.pages.forEach(p => {
        p.id = uid();
        p.v = {
          x: 0,
          y: 0,
          z: 1
        };
        p.els = p.els || [];
      });
      ST.S.nbs.push(n);
    });
    ST.S.view = 'shelf';
    save();
    side();
    render();
  } catch (er) {
    alert('Not a valid backup file');
  }
};
