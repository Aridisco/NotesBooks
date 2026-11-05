import { dirty, P, ST } from './state.js';
import { $, cv } from './util.js';
import { save } from './cloud.js';
import { BBC, COARSE, FF, LITE, VER, col, css, custom, dpr, inkFor, needX, rl, rng, rot } from './env.js';
import { imgSrc } from './edit.js';
import { compDraw, wpts } from './circuit.js';
import { badgePos, drawTable, linkOf, tcellRect } from './objects.js';
import { drawGraph } from './graph.js';
import { invalidateEl, sceneFrame, useScene } from './scene.js';
import { BKC, bkBmp } from './books.js';
import { placeCtx } from './toolbar.js';
import { drawCode } from './code.js';
import { snapshotSoon } from './versions.js';

export function cpts(e) {
  const x0 = e.x,
    y0 = e.y,
    x1 = e.x + (e.qx || 0),
    y1 = e.y + (e.qy || 0),
    x2 = e.x + e.w,
    y2 = e.y + e.h,
    o = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20,
      u = 1 - t;
    o.push([u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2]);
  }
  return o;
}
// Corners of a regular polygon inscribed in the box, first corner at the top.
export function polyPts(b, n) {
  const o = [];
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + k * 2 * Math.PI / n;
    o.push([b.x + b.w / 2 + Math.cos(a) * b.w / 2, b.y + b.h / 2 + Math.sin(a) * b.h / 2]);
  }
  return o;
}
export function bb(e) {
  if (e.t === 'free') {
    const k = BBC.get(e);
    if (k && k.p === e.pts && k.n === e.pts.length) return {
      x: e.x + k.a,
      y: e.y + k.b,
      w: k.w,
      h: k.h
    };
    let a = 1e9,
      b = 1e9,
      c = -1e9,
      d = -1e9;
    e.pts.forEach(p => {
      a = Math.min(a, p[0]);
      b = Math.min(b, p[1]);
      c = Math.max(c, p[0]);
      d = Math.max(d, p[1]);
    });
    BBC.set(e, {
      p: e.pts,
      n: e.pts.length,
      a,
      b,
      w: c - a,
      h: d - b
    });
    return {
      x: e.x + a,
      y: e.y + b,
      w: c - a,
      h: d - b
    };
  }
  if (e.t === 'curve') {
    let a = 1e9,
      b = 1e9,
      c = -1e9,
      d = -1e9;
    cpts(e).forEach(p => {
      a = Math.min(a, p[0]);
      b = Math.min(b, p[1]);
      c = Math.max(c, p[0]);
      d = Math.max(d, p[1]);
    });
    return {
      x: a,
      y: b,
      w: c - a,
      h: d - b
    };
  }
  return {
    x: Math.min(e.x, e.x + e.w),
    y: Math.min(e.y, e.y + e.h),
    w: Math.abs(e.w),
    h: Math.abs(e.h)
  };
}
const IM = new Map();
function imgFor(e) {
  const c = col(e.stroke),
    k = e.id + c + e.svg.length;
  let i = IM.get(k);
  if (!i) {
    i = new Image();
    i.onload = () => {
      invalidateEl(e);
      draw();
    };
    i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(e.svg.replace(/currentColor/g, c));
    IM.set(k, i);
  }
  return i;
}
function tlines(e, fs) {
  if (e.ff && e.ff !== 'hand' && e.ff !== 'sans') needX();
  ST.ctx.font = `500 ${fs}px ${FF[e.ff || 'hand']}`;
  const L = [],
    O = [];
  let base = 0;
  e.text.split('\n').forEach(par => {
    if (!e.bw) {
      L.push(par);
      O.push(base);
    } else {
      let cur = '',
        co = base,
        wo = base;
      par.split(' ').forEach(w => {
        const t = cur ? cur + ' ' + w : w;
        if (cur && ST.ctx.measureText(t).width > e.bw) {
          L.push(cur);
          O.push(co);
          cur = w;
          co = wo;
        } else cur = t;
        wo += w.length + 1;
      });
      L.push(cur);
      O.push(co);
    }
    base += par.length + 1;
  });
  L.o = O;
  return L;
}
export function tfit(e) {
  const fs = e.fs || 24,
    L = tlines(e, fs);
  e.w = e.bw || Math.max(...L.map(l => ST.ctx.measureText(l).width), 10);
  e.h = L.length * fs * 1.2;
}
function drawEl(e) {
  const r = rng(e.seed),
    b = bb(e);
  r.R = e.rg == null ? 1 : e.rg;
  ST.ctx.lineWidth = e.sw;
  ST.ctx.setLineDash(e.ds === 'dashed' ? [e.sw * 4, e.sw * 3] : e.ds === 'dotted' ? [.1, e.sw * 2.5] : []);
  ST.ctx.strokeStyle = col(e.stroke);
  ST.ctx.lineCap = ST.ctx.lineJoin = 'round';
  ST.ctx.fillStyle = e.fill === 'none' ? 'transparent' : e.fill;
  if (e.t === 'table') return drawTable(e);
  if (e.t === 'graph') return drawGraph(e);
  if (e.t === 'curve') {
    const R = r.R,
      x2 = e.x + e.w,
      y2 = e.y + e.h,
      qx = e.qx || 0,
      qy = e.qy || 0;
    ST.ctx.beginPath();
    for (let k = 0; k < (R && !ST.LT ? 2 : 1); k++) {
      const a = () => R ? (r() - .5) * 2.2 * R : 0;
      ST.ctx.moveTo(e.x + a(), e.y + a());
      ST.ctx.quadraticCurveTo(e.x + qx + a() * 1.5, e.y + qy + a() * 1.5, x2 + a(), y2 + a());
    }
    if (e.ah !== 'none') {
      const L = 12 + e.sw * 2,
        hd = (px, py, an) => {
          for (const s of [-.45, .45]) {
            ST.ctx.moveTo(px, py);
            ST.ctx.lineTo(px - Math.cos(an + s) * L, py - Math.sin(an + s) * L);
          }
        };
      hd(x2, y2, Math.atan2(y2 - e.y - qy, x2 - e.x - qx));
      if (e.ah === 'both') hd(e.x, e.y, Math.atan2(-qy, -qx));
    }
    ST.ctx.stroke();
    return;
  }
  if (e.t === 'wire') {
    ST.ctx.beginPath();
    wpts(e).forEach((p, i) => i ? ST.ctx.lineTo(p[0], p[1]) : ST.ctx.moveTo(p[0], p[1]));
    ST.ctx.stroke();
    return;
  }
  if (e.t === 'comp') {
    ST.ctx.save();
    ST.ctx.translate(e.x, e.y);
    compDraw(e.k, e.w, e.h);
    ST.ctx.restore();
    if (e.lbl) {
      ST.ctx.save();
      ST.ctx.fillStyle = col(e.stroke);
      ST.ctx.font = '600 14px Figtree,system-ui,sans-serif';
      ST.ctx.textAlign = 'center';
      ST.ctx.textBaseline = 'bottom';
      ST.ctx.fillText(e.lbl, e.x + e.w / 2, e.y - 4);
      ST.ctx.restore();
    }
    return;
  }
  if (e.t === 'img') {
    const im = imgSrc(e);
    if (im.complete && im.naturalWidth) ST.ctx.drawImage(im, e.x, e.y, e.w, e.h);
    return;
  }
  if (e.t === 'math') {
    const im = imgFor(e);
    if (im.complete && im.naturalWidth) ST.ctx.drawImage(im, e.x, e.y, e.w, e.h);
    return;
  }
  if (e.t === 'code') {
    drawCode(e);
    return;
  }
  if (e.t === 'text') {
    if (e.hide) return;
    ST.ctx.fillStyle = col(e.stroke);
    const fs = e.fs || 24;
    ST.ctx.textBaseline = 'top';
    const L = tlines(e, fs);
    L.forEach((l, i) => {
      const y = e.y + i * fs * 1.2;
      if (!e.runs || !e.runs.length) {
        ST.ctx.fillText(l, e.x, y);
        return;
      }
      const o = L.o[i],
        pts = new Set([0, l.length]);
      e.runs.forEach(r => {
        [r.a - o, r.b - o].forEach(q => {
          if (q > 0 && q < l.length) pts.add(q);
        });
      });
      const A = [...pts].sort((a, b) => a - b),
        base = ST.ctx.fillStyle;
      for (let j = 0; j < A.length - 1; j++) {
        const a = A[j],
          b = A[j + 1],
          r = [...e.runs].reverse().find(q => q.a <= o + a && q.b >= o + b),
          x = e.x + ST.ctx.measureText(l.slice(0, a)).width,
          w = ST.ctx.measureText(l.slice(a, b)).width;
        if (r && r.h) {
          ST.ctx.fillStyle = r.h;
          ST.ctx.fillRect(x, y, w, fs * 1.2);
        }
        ST.ctx.fillStyle = r && r.c || base;
        ST.ctx.fillText(l.slice(a, b), x, y);
      }
      ST.ctx.fillStyle = base;
    });
    return;
  }
  ST.ctx.beginPath();
  if (e.t === 'rect') {
    if (e.fill !== 'none') ST.ctx.fillRect(b.x, b.y, b.w, b.h);
    ST.ctx.beginPath();
    rl(ST.ctx, b.x, b.y, b.x + b.w, b.y, r);
    rl(ST.ctx, b.x + b.w, b.y, b.x + b.w, b.y + b.h, r);
    rl(ST.ctx, b.x + b.w, b.y + b.h, b.x, b.y + b.h, r);
    rl(ST.ctx, b.x, b.y + b.h, b.x, b.y, r);
  } else if (e.t === 'diamond' || e.t === 'poly') {
    const m = e.t === 'poly' ? polyPts(b, e.n || 5) : [[b.x + b.w / 2, b.y], [b.x + b.w, b.y + b.h / 2], [b.x + b.w / 2, b.y + b.h], [b.x, b.y + b.h / 2]];
    if (e.fill !== 'none') {
      ST.ctx.beginPath();
      m.forEach((p, i) => i ? ST.ctx.lineTo(...p) : ST.ctx.moveTo(...p));
      ST.ctx.fill();
    }
    ST.ctx.beginPath();
    m.forEach((p, i) => rl(ST.ctx, p[0], p[1], m[(i + 1) % m.length][0], m[(i + 1) % m.length][1], r));
  } else if (e.t === 'ellipse') {
    const cx = b.x + b.w / 2,
      cy = b.y + b.h / 2;
    if (e.fill !== 'none') {
      ST.ctx.ellipse(cx, cy, b.w / 2, b.h / 2, 0, 0, 7);
      ST.ctx.fill();
      ST.ctx.beginPath();
    }
    for (let p = 0; p < (r.R === 0 || ST.LT ? 1 : 2); p++) {
      const ph = p * .4,
        N = ST.LT ? 22 : 36;
      for (let i = 0; i <= N + 4; i++) {
        const a = ph + i / N * Math.PI * 2,
          j = 1 + (r() - .5) * .014 * r.R,
          x = cx + Math.cos(a) * b.w / 2 * j,
          y = cy + Math.sin(a) * b.h / 2 * j;
        i ? ST.ctx.lineTo(x, y) : ST.ctx.moveTo(x, y);
      }
    }
  } else if (e.t === 'line' || e.t === 'arrow') {
    const x2 = e.x + e.w,
      y2 = e.y + e.h;
    rl(ST.ctx, e.x, e.y, x2, y2, r);
    if (e.t === 'arrow' && e.ah !== 'none') {
      const an = Math.atan2(e.h, e.w),
        L = 12 + e.sw * 2,
        hd = (px, py, a) => {
          for (const s of [-.45, .45]) {
            ST.ctx.moveTo(px, py);
            ST.ctx.lineTo(px - Math.cos(a + s) * L, py - Math.sin(a + s) * L);
          }
        };
      hd(x2, y2, an);
      if (e.ah === 'both') hd(e.x, e.y, an + Math.PI);
    }
  } else if (e.t === 'free') {
    const p = e.pts;
    ST.ctx.moveTo(e.x + p[0][0], e.y + p[0][1]);
    for (let i = 1; i < p.length - 1; i++) ST.ctx.quadraticCurveTo(e.x + p[i][0], e.y + p[i][1], e.x + (p[i][0] + p[i + 1][0]) / 2, e.y + (p[i][1] + p[i + 1][1]) / 2);
    const l = p[p.length - 1];
    ST.ctx.lineTo(e.x + l[0], e.y + l[1]);
  }
  ST.ctx.stroke();
}
export function drawR(e) {
  if (e.hl) {
    // highlighter: one translucent stroke so overlaps inside it do not darken
    ST.ctx.save();
    ST.ctx.globalAlpha = .4;
    drawEl(e);
    ST.ctx.restore();
    return;
  }
  if (!e.r) return drawEl(e);
  const b = bb(e);
  ST.ctx.save();
  ST.ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
  ST.ctx.rotate(e.r);
  ST.ctx.translate(-b.x - b.w / 2, -b.y - b.h / 2);
  drawEl(e);
  ST.ctx.restore();
}
export function hdl(e) {
  if (e.t === 'curve') return [{
    k: 's',
    x: e.x,
    y: e.y
  }, {
    k: 'e',
    x: e.x + e.w,
    y: e.y + e.h
  }, {
    k: 'c',
    x: .25 * e.x + .5 * (e.x + (e.qx || 0)) + .25 * (e.x + e.w),
    y: .25 * e.y + .5 * (e.y + (e.qy || 0)) + .25 * (e.y + e.h)
  }];
  if (e.t === 'line' || e.t === 'arrow' || e.t === 'wire') return [{
    k: 's',
    x: e.x,
    y: e.y
  }, {
    k: 'e',
    x: e.x + e.w,
    y: e.y + e.h
  }];
  const b = bb(e),
    cx = b.x + b.w / 2,
    cy = b.y + b.h / 2,
    z = P().v.z;
  return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h], [cx, b.y - 30 / z]].map((p, i) => {
    const q = rot(p[0], p[1], cx, cy, e.r || 0);
    return {
      k: i === 4 ? 'rot' : i,
      x: q[0],
      y: q[1]
    };
  });
}
export const A4W = 794;
export const A4H = 1123;
export const cl = q => P().mode === 'a4' ? [Math.max(0, Math.min(A4W, q[0])), Math.max(0, Math.min(A4H, q[1]))] : q;
// Two A4 pages side by side: a page with `spread` set is shown together with the next page of its notebook.
export const GAP = 40;
export function spreadOf(p) {
  if (!p || p.mode !== 'a4') return null;
  const nb = ST.S.nbs.find(n => n.pages.includes(p));
  if (!nb) return null;
  const i = nb.pages.indexOf(p), nx = nb.pages[i + 1], pv = nb.pages[i - 1];
  let L = null, R = null;
  if (p.spread && nx && nx.mode === 'a4') [L, R] = [p, nx];
  else if (pv && pv.spread && pv.mode === 'a4') [L, R] = [pv, p];
  if (!L) return null;
  R.v = L.v; // one shared view, so both sheets pan and zoom together
  return { L, R };
}
export const spreadW = p => spreadOf(p) ? A4W * 2 + GAP : A4W;
// World-space x of the active page's origin (0 for single pages and left sheets).
export const OX = () => {
  const s = spreadOf(P());
  return s && s.R === P() ? A4W + GAP : 0;
};
export function fitA4(p) {
  const W = cv.clientWidth,
    H = cv.clientHeight,
    tw = spreadW(p),
    z = Math.max(.2, Math.min((W - 40) / tw, (H - 110) / A4H, 1.5));
  Object.assign(p.v, {
    z,
    x: (W - tw * z) / 2,
    y: (H - A4H * z) / 2 + 24
  });
}
function clampV(p) {
  const v = p.v,
    W = cv.clientWidth,
    H = cv.clientHeight,
    m = 70;
  v.x = Math.max(m - spreadW(p) * v.z, Math.min(W - m, v.x));
  v.y = Math.max(m - A4H * v.z, Math.min(H - m, v.y));
}
export const bgOf = p => p.mode === 'a4' ? css('--line') : custom(p) ? p.bg : css('--bg');
// Draws one sheet (paper, pattern, book page, objects) into ST.ctx, where device = k * world + (ox, oy) and the
// target is W x H device pixels. Used for the screen (classic renderer) and for every cached tile (GPU renderer).
export function paintSheet(pg, offX, a4, k, ox, oy, W, H, d, skip) {
  const c = ST.ctx, x0 = ox + k * offX;
  c.save();
  if (a4) {
    c.setTransform(k, 0, 0, k, x0, oy);
    c.save();
    if (!ST.LT) {
      c.shadowColor = 'rgba(0,0,0,.28)';
      c.shadowBlur = 20 * d;
    }
    c.fillStyle = custom(pg) ? pg.bg : css('--panel');
    c.fillRect(0, 0, A4W, A4H);
    c.restore();
    c.beginPath();
    c.rect(0, 0, A4W, A4H);
    c.clip();
  }
  // grid pattern in device pixels so dots and lines stay crisp at any zoom
  const g = 28 * k, pat = pg.pat || 'dots';
  if (pat !== 'none' && g > 8 * d) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.save();
    c.globalAlpha = .2;
    c.fillStyle = c.strokeStyle = ST.INK;
    c.lineWidth = d;
    const gx = (x0 % g + g) % g, gy = (oy % g + g) % g;
    c.beginPath();
    if (pat === 'dots') {
      for (let x = gx; x < W + d; x += g) for (let y = gy; y < H + d; y += g) c.rect(x - d, y - d, 2 * d, 2 * d);
      c.fill();
    } else {
      for (let y = gy; y < H; y += g) {
        c.moveTo(0, y);
        c.lineTo(W, y);
      }
      if (pat === 'squares') for (let x = gx; x < W; x += g) {
        c.moveTo(x, 0);
        c.lineTo(x, H);
      }
      c.stroke();
    }
    c.restore();
  }
  c.setTransform(k, 0, 0, k, x0, oy);
  if (pg.bk) {
    const bm = bkBmp(pg);
    if (bm) c.drawImage(bm, 0, 0, A4W, A4W * bm.height / bm.width);else {
      const c0 = BKC.get(pg.bk.id + ':' + pg.bk.i);
      if (c0 && c0.miss) {
        c.save();
        c.fillStyle = ST.INK;
        c.globalAlpha = .5;
        c.font = '500 22px Figtree,sans-serif';
        c.textAlign = 'center';
        c.fillText('Book file is not on this device. Import the same PDF again.', A4W / 2, A4H / 2);
        c.restore();
      }
    }
  }
  const m = 40 * d / k + 40, vx0 = -x0 / k - m, vy0 = -oy / k - m, vx1 = (W - x0) / k + m, vy1 = (H - oy) / k + m;
  const vis = e => {
    if (skip && skip.has(e)) return;
    if (e.t !== 'text' || e.w) {
      const b = bb(e), r = e.r ? Math.hypot(b.w, b.h) / 2 : 0, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const X0 = e.r ? cx - r : b.x, Y0 = e.r ? cy - r : b.y, X1 = e.r ? cx + r : b.x + b.w, Y1 = e.r ? cy + r : b.y + b.h;
      if (X0 > vx1 || Y0 > vy1 || X1 < vx0 || Y1 < vy0) return;
    }
    drawR(e);
  };
  // highlighter strokes go under everything else, like ink over a marker
  pg.els.forEach(e => e.hl && vis(e));
  pg.els.forEach(e => !e.hl && vis(e));
  c.restore();
}
// A redraw where only the view moved (pan, pinch, wheel, zoom buttons): the renderer can skip looking for edits.
export function drawView() {
  const pending = ST.rq;
  draw();
  if (!pending) ST.viewOnly = true;
}
export function draw() {
  ST.viewOnly = false;
  if (ST.rq) return;
  if (ST.LT) ST.rq = setTimeout(() => {
    ST.rq = 0;
    drawNow();
  }, 45);else ST.rq = requestAnimationFrame(() => {
    ST.rq = 0;
    drawNow();
  });
}
// Synchronous redraw, used by benchmarks and anything that needs pixels right now.
export function renderNow() {
  if (ST.rq) {
    cancelAnimationFrame(ST.rq);
    clearTimeout(ST.rq);
    ST.rq = 0;
  }
  drawNow();
}
function drawNow() {
  ST.LT = LITE();
  const d = dpr(),
    p = P(),
    v = p.v;
  ST.INK = inkFor(p);
  if (p.mode === 'a4') clampV(p);
  const a4 = p.mode === 'a4';
  const sp = a4 ? spreadOf(p) : null,
    sheets = sp ? [[sp.L, 0], [sp.R, A4W + GAP]] : [[p, 0]],
    k = d * v.z, ax = sp && sp.R === p ? A4W + GAP : 0;
  // GPU path: cached tiles are composited underneath, this canvas only carries live edits and selection
  const sc = useScene() ? sceneFrame({ p, v, d, a4, sheets }) : null, live = sc && sc.live;
  if (sc) {
    ST.ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (sc.gl) ST.ctx.clearRect(0, 0, cv.width, cv.height);
  } else {
    ST.ctx.setTransform(1, 0, 0, 1, 0, 0);
    ST.ctx.fillStyle = bgOf(p);
    ST.ctx.fillRect(0, 0, cv.width, cv.height);
    sheets.forEach(([pg, o]) => paintSheet(pg, o, a4, k, d * v.x, d * v.y, cv.width, cv.height, d));
  }
  if (live && live.length) {
    // objects being drawn, moved or resized are left out of the tiles and painted here every frame
    ST.ctx.save();
    ST.ctx.setTransform(k, 0, 0, k, d * v.x + k * ax, d * v.y);
    live.filter(e => e.hl).forEach(drawR);
    live.filter(e => !e.hl).forEach(drawR);
    ST.ctx.restore();
  }
  // selection, links and handles belong to the active page, so draw them in its coordinate space
  ST.ctx.setTransform(d * v.z, 0, 0, d * v.z, d * (v.x + (sp && sp.R === p ? A4W + GAP : 0) * v.z), d * v.y);
  const aco = css('--acc');
  p.els.forEach(e => {
    if (!linkOf(e)) return;
    const q = badgePos(e);
    ST.ctx.save();
    ST.ctx.fillStyle = aco;
    ST.ctx.beginPath();
    ST.ctx.arc(q[0], q[1], 9 / v.z, 0, 7);
    ST.ctx.fill();
    ST.ctx.fillStyle = '#fff';
    ST.ctx.font = `700 ${12 / v.z}px Figtree,sans-serif`;
    ST.ctx.textAlign = 'center';
    ST.ctx.textBaseline = 'middle';
    ST.ctx.fillText('↗', q[0], q[1] + .5 / v.z);
    ST.ctx.restore();
  });
  const s = p.els.find(e => e.id === ST.sel),
    acc = css('--acc'),
    z = v.z;
  if (ST.msel.length) {
    ST.ctx.save();
    ST.ctx.strokeStyle = acc;
    ST.ctx.lineWidth = 1.2 / z;
    ST.ctx.setLineDash([5, 4]);
    p.els.filter(q => ST.msel.includes(q.id)).forEach(q => {
      const b = bb(q);
      ST.ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
    });
    ST.ctx.restore();
  }
  if (ST.act && ST.act.k === 'box') {
    ST.ctx.save();
    ST.ctx.fillStyle = acc;
    ST.ctx.globalAlpha = .08;
    ST.ctx.strokeStyle = acc;
    ST.ctx.lineWidth = 1 / z;
    const bx = Math.min(ST.act.x, ST.act.x2),
      by = Math.min(ST.act.y, ST.act.y2),
      bw = Math.abs(ST.act.x2 - ST.act.x),
      bh = Math.abs(ST.act.y2 - ST.act.y);
    ST.ctx.fillRect(bx, by, bw, bh);
    ST.ctx.globalAlpha = 1;
    ST.ctx.strokeRect(bx, by, bw, bh);
    ST.ctx.restore();
  }
  if (ST.guide && ST.act) {
    ST.ctx.save();
    ST.ctx.strokeStyle = acc;
    ST.ctx.lineWidth = 1 / z;
    ST.ctx.setLineDash([4, 4]);
    ST.ctx.beginPath();
    if (ST.guide.x != null) {
      ST.ctx.moveTo(ST.guide.x, -1e5);
      ST.ctx.lineTo(ST.guide.x, 1e5);
    }
    if (ST.guide.y != null) {
      ST.ctx.moveTo(-1e5, ST.guide.y);
      ST.ctx.lineTo(1e5, ST.guide.y);
    }
    ST.ctx.stroke();
    ST.ctx.restore();
  }
  if (s) {
    const b = bb(s),
      ln = s.t === 'line' || s.t === 'arrow' || s.t === 'wire' || s.t === 'curve';
    ST.ctx.save();
    ST.ctx.strokeStyle = acc;
    ST.ctx.lineWidth = 1.2 / z;
    ST.ctx.setLineDash([5, 4]);
    if (!ln) {
      ST.ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
      ST.ctx.rotate(s.r || 0);
      ST.ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
    }
    ST.ctx.restore();
    ST.ctx.save();
    ST.ctx.strokeStyle = acc;
    ST.ctx.lineWidth = 1.5 / z;
    if (s.t === 'table' && ST.tc && ST.tc.id === s.id) {
      const c = tcellRect(s, ST.tc.i, ST.tc.j);
      if (c) {
        ST.ctx.save();
        ST.ctx.setLineDash([]);
        ST.ctx.lineWidth = 2.5 / z;
        ST.ctx.strokeRect(c.x, c.y, c.w, c.h);
        ST.ctx.restore();
      }
    }
    hdl(s).forEach(h => {
      const sz = (COARSE ? 9 : 6) / z;
      ST.ctx.beginPath();
      h.k === 'rot' || h.k === 'c' ? ST.ctx.arc(h.x, h.y, sz, 0, 7) : ST.ctx.rect(h.x - sz, h.y - sz, 2 * sz, 2 * sz);
      ST.ctx.fillStyle = css('--panel');
      ST.ctx.fill();
      ST.ctx.stroke();
    });
    ST.ctx.restore();
  }
  $('#zoomv') && ($('#zoomv').textContent = Math.round(v.z * 100) + '%');
  placeCtx();
}
// Text alternative for the canvas, read by screen readers through #cvdesc.
export function describePage() {
  const el = $('#cvdesc'), p = P();
  if (!el || !p) return;
  const c = {};
  p.els.forEach(e => c[e.t] = (c[e.t] || 0) + 1);
  const kinds = Object.entries(c).map(([k, v]) => v + ' ' + k).join(', ') || 'empty';
  const texts = p.els.filter(e => e.t === 'text' && e.text).slice(0, 10).map(e => e.text.replace(/\s+/g, ' ').slice(0, 60));
  el.textContent = 'Page "' + p.name + '": ' + p.els.length + ' objects (' + kinds + ').' + (texts.length ? ' Text: ' + texts.join('; ') : '');
}
export function commit() {
  const p = P();
  dirty.add(p.id);
  ST.hist = ST.hist.slice(0, ST.hi + 1);
  ST.hist.push(JSON.stringify(p.els));
  if (ST.hist.length > (ST.hist[ST.hist.length - 1].length > 3e5 ? 10 : 40)) {
    ST.hist.shift();
  }
  ST.hi = ST.hist.length - 1;
  VER.set(p, (VER.get(p) || 0) + 1);
  describePage();
  snapshotSoon();
  save();
  draw();
}
export function undo(d) {
  const n = ST.hi + d;
  if (n < 0 || n >= ST.hist.length) return;
  ST.hi = n;
  P().els = JSON.parse(ST.hist[ST.hi]);
  VER.set(P(), (VER.get(P()) || 0) + 1);
  dirty.add(ST.S.cur);
  describePage();
  ST.sel = null;
  ST.msel = [];
  save();
  draw();
}
