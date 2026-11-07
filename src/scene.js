// GPU renderer, the way Figma and browsers do it: the page is painted once into 512px tiles (with the normal
// Canvas2D drawing code, so objects look exactly the same), the tiles are uploaded as WebGL textures, and every
// frame only composites them. Panning and zooming then cost the same with 50 objects or 50,000.
// Only tiles touched by an edit are repainted; objects being dragged or drawn live on the overlay canvas.
import { ST } from './state.js';
import { cv } from './util.js';
import { css } from './env.js';
import { A4W, GAP, bb, bgOf, draw, paintSheet } from './render.js';
import { report } from './report.js';

const TS = 512, MAX_TILES = 96, BUDGET_MS = 8, SETTLE_MS = 160;
const LIVE = new Set(['draw', 'move', 'gmove', 'rs', 'tgrid']);
let renderer = 'gpu';
try {
  renderer = localStorage.getItem('sketchbooks-renderer') || 'gpu';
} catch (e) { report(e, 'Renderer preference could not be read', { quiet: true }); }
export const rendererName = () => renderer;
export function setRenderer(r) {
  renderer = r;
  try {
    localStorage.setItem('sketchbooks-renderer', r);
  } catch (e) { report(e, 'Renderer preference could not be saved', { quiet: true }); }
  invalidateAll();
  gl && gl.clear(gl.COLOR_BUFFER_BIT);
}
export const useScene = () => renderer === 'gpu';
// web fonts that finish loading change how text looks, so painted tiles are out of date
document.fonts && document.fonts.addEventListener('loadingdone', () => {
  invalidateAll();
  draw();
});

/* ---------- tile cache ---------- */
const tiles = new Map(); // `${scale}|${tx}|${ty}` -> { s, tx, ty, tex?, cv?, used, stale }
let sceneKey = '';
let snap = new Map(); // object id -> { f: fingerprint, r: world rect }
let liveIds = '';
let lastScale = 0, lastScaleAt = 0, settleTimer = 0;
let pendingRects = [];

const dropTile = (k, t) => {
  if (t.tex && gl) gl.deleteTexture(t.tex);
  tiles.delete(k);
};
export function invalidateAll() {
  tiles.forEach((t, k) => dropTile(k, t));
  snap = new Map();
}
// World rect an object can paint into (stroke width, sketchy jitter, arrowheads, rotation).
function rectOf(e, offX) {
  const b = bb(e), m = 24 + (e.sw || 1) * 3;
  if (e.r) {
    const r = Math.hypot(b.w, b.h) / 2 + m, cx = b.x + b.w / 2 + offX, cy = b.y + b.h / 2;
    return [cx - r, cy - r, cx + r, cy + r];
  }
  if (e.t === 'text' && !e.w) return [-1e9, -1e9, 1e9, 1e9];
  return [b.x + offX - m, b.y - m, b.x + b.w + offX + m, b.y + b.h + m];
}
export function invalidateEl(e) {
  pendingRects.push(rectOf(e, 0), rectOf(e, A4W + GAP));
}
function dirtyRect(r) {
  tiles.forEach((t, k) => {
    const w = TS / t.s, x = t.tx * w, y = t.ty * w;
    if (r[0] < x + w && r[2] > x && r[1] < y + w && r[3] > y) {
      // tiles at the current scale are repainted in place; others are simply dropped
      if (t.s === curScale) t.stale = true;else dropTile(k, t);
    }
  });
}
// Big or frequently changing values are summarized so the comparison stays cheap.
const fp = e => JSON.stringify(e, (k, v) => k === 'svg' || k === 'src' ? (v ? v.length : 0) : k === 'pts' ? v.length + ':' + v[0] + ':' + v[v.length - 1] : v);
function diffScene(sheets) {
  const next = new Map();
  sheets.forEach(([pg, o]) => pg.els.forEach(e => {
    const f = fp(e), old = snap.get(e.id);
    if (old && old.f === f) return next.set(e.id, old);
    const r = rectOf(e, o);
    next.set(e.id, { f, r });
    dirtyRect(r);
    if (old) dirtyRect(old.r);
  }));
  snap.forEach((v, id) => !next.has(id) && dirtyRect(v.r));
  snap = next;
}
function liveSet() {
  const a = ST.act;
  if (!a || !LIVE.has(a.k)) return [];
  return a.k === 'gmove' ? a.its.map(i => i.e) : a.e ? [a.e] : [];
}

/* ---------- painting one tile with the normal 2D drawing code ---------- */
let scratch = null;
function paintTile(t, f, skip) {
  const canvas = gl ? scratch || (scratch = document.createElement('canvas')) : t.cv || (t.cv = document.createElement('canvas'));
  canvas.width = canvas.height = TS;
  const g = canvas.getContext('2d'), old = ST.ctx, ox = -t.tx * TS, oy = -t.ty * TS;
  ST.ctx = g;
  try {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = bgOf(f.p);
    g.fillRect(0, 0, TS, TS);
    f.sheets.forEach(([pg, o]) => paintSheet(pg, o, f.a4, t.s, ox, oy, TS, TS, f.d, skip));
  } finally {
    ST.ctx = old;
  }
  if (gl) upload(t, canvas);
  t.stale = false;
}

/* ---------- compositor: WebGL with a plain 2D fallback ---------- */
let gl = null, prog = null, loc = null, glcv = null, glFailed = false;
function initGL() {
  if (gl || glFailed) return gl;
  glcv = document.createElement('canvas');
  glcv.id = 'gl';
  glcv.setAttribute('aria-hidden', 'true');
  cv.before(glcv);
  gl = glcv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl) {
    glFailed = true;
    glcv.remove();
    return null;
  }
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, `#version 300 es
    in vec2 a; uniform vec4 r; uniform vec2 v; out vec2 uv;
    void main() { uv = a; vec2 p = (r.xy + a * r.zw) / v * 2.0 - 1.0; gl_Position = vec4(p.x, -p.y, 0.0, 1.0); }`));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `#version 300 es
    precision mediump float; in vec2 uv; uniform sampler2D t; out vec4 o;
    void main() { o = texture(t, uv); }`));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    glFailed = true;
    gl = null;
    glcv.remove();
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  loc = { r: gl.getUniformLocation(prog, 'r'), v: gl.getUniformLocation(prog, 'v') };
  // if the GPU resets, fall back to repainting everything once it comes back
  glcv.addEventListener('webglcontextlost', ev => {
    ev.preventDefault();
    tiles.clear();
  });
  glcv.addEventListener('webglcontextrestored', () => {
    gl = null;
    glcv.remove();
    initGL();
    invalidateAll();
    draw();
  });
  return gl;
}
function upload(t, canvas) {
  if (!t.tex) {
    t.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  } else gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
}
const hexRGB = h => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  const n = m ? parseInt(m[1], 16) : 0xeeeeee;
  return [(n >> 16) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
};
function composite(list, f, W, H) {
  if (gl) {
    if (glcv.width !== W || glcv.height !== H) {
      glcv.width = W;
      glcv.height = H;
    }
    gl.viewport(0, 0, W, H);
    gl.clearColor(...hexRGB(bgOf(f.p)), 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(loc.v, W, H);
    list.forEach(([t, x, y, w]) => {
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.uniform4f(loc.r, x, y, w, w);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });
    return;
  }
  const c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = bgOf(f.p);
  c.fillRect(0, 0, W, H);
  c.imageSmoothingEnabled = true;
  list.forEach(([t, x, y, w]) => c.drawImage(t.cv, x, y, w, w));
}

/* ---------- one frame ---------- */
let curScale = 1;
// Composites the page and returns { live: objects to paint on the overlay, gl: whether the overlay canvas is separate }.
export function sceneFrame(f) {
  const { p, v, d } = f, W = cv.width, H = cv.height, now = performance.now();
  initGL();
  // anything that changes every pixel (page, theme, ink, quality) starts a fresh cache
  const key = p.id + '|' + ST.INK + '|' + bgOf(p) + '|' + css('--panel') + '|' + ST.LT + '|' + p.mode + '|' + (p.spread ? 1 : 0) + '|' + p.pat + '|' + p.bg + '|' + d;
  if (key !== sceneKey) {
    sceneKey = key;
    invalidateAll();
  }
  // while zooming, paint at the nearest power of two (reused from frame to frame); once settled, at the exact scale
  const exact = Math.round(v.z * d * 1000) / 1000;
  if (exact !== lastScale) {
    lastScale = exact;
    lastScaleAt = now;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(draw, SETTLE_MS);
  }
  const zooming = now - lastScaleAt < SETTLE_MS;
  curScale = zooming ? 2 ** Math.round(Math.log2(exact)) : exact;
  const s = curScale, wt = TS / s;
  // changes: live objects leave the tiles while they move, edits repaint only the tiles they touch
  const live = liveSet(), ids = live.map(e => e.id).join(',');
  if (ids !== liveIds) {
    const was = liveIds;
    liveIds = ids;
    live.forEach(e => dirtyRect(rectOf(e, f.sheets.find(([pg]) => pg.els.includes(e))?.[1] || 0)));
    if (was) was.split(',').forEach(id => snap.get(id) && dirtyRect(snap.get(id).r));
  }
  if (!ST.viewOnly && !(ST.act && LIVE.has(ST.act.k))) diffScene(f.sheets);
  ST.viewOnly = false;
  pendingRects.splice(0).forEach(dirtyRect);
  const skip = live.length ? new Set(live) : null;
  // visible tiles at the target scale, nearest to the center first
  const ox = d * v.x, oy = d * v.y, k = d * v.z;
  const tx0 = Math.floor(-ox / k / wt), ty0 = Math.floor(-oy / k / wt), tx1 = Math.floor((W - ox) / k / wt), ty1 = Math.floor((H - oy) / k / wt);
  const want = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) want.push([tx, ty]);
  const cx = (tx0 + tx1) / 2, cy = (ty0 + ty1) / 2;
  want.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
  let spent = 0, more = false;
  const t0 = performance.now();
  want.forEach(([tx, ty]) => {
    const kk = s + '|' + tx + '|' + ty;
    let t = tiles.get(kk);
    // stale tiles repaint now so an edit never flickers; new tiles share a time budget per frame
    if (t && !t.stale) return t.used = now;
    if (!t && spent > BUDGET_MS) return more = true;
    if (!t) tiles.set(kk, t = { s, tx, ty, used: now });
    paintTile(t, f, skip);
    t.used = now;
    spent = performance.now() - t0;
  });
  // composite: other scales first (as stand-ins while new tiles arrive), then the target scale on top
  const vis = [], vx0 = -ox / k, vy0 = -oy / k, vx1 = (W - ox) / k, vy1 = (H - oy) / k;
  tiles.forEach(t => {
    if (!t.tex && !t.cv) return;
    const w = TS / t.s, x = t.tx * w, y = t.ty * w;
    if (x > vx1 || y > vy1 || x + w < vx0 || y + w < vy0) return;
    vis.push(t);
  });
  vis.sort((a, b) => (a.s === s) - (b.s === s) || Math.abs(Math.log2(b.s / s)) - Math.abs(Math.log2(a.s / s)));
  // at the exact scale, snap to whole device pixels so tiles meet without seams
  const snapPx = (val, t) => t.s === exact ? Math.round(val) : val;
  composite(vis.map(t => {
    const w = TS / t.s, sz = w * k;
    return [t, snapPx(ox + t.tx * w * k, t), snapPx(oy + t.ty * w * k, t), t.s === exact ? TS : sz];
  }), f, W, H);
  // forget the least recently used tiles beyond the memory budget
  if (tiles.size > MAX_TILES) [...tiles.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, tiles.size - MAX_TILES).forEach(([kk, t]) => dropTile(kk, t));
  if (more) setTimeout(draw, 0);
  return { live, gl: !!gl };
}
