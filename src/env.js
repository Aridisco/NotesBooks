import { P, ST } from './state.js';
import { $, cv } from './util.js';
import { draw, tfit } from './render.js';
import { report } from './report.js';

export function resize() {
  const r = $('#main').getBoundingClientRect(),
    d = dpr();
  cv.width = r.width * d;
  cv.height = r.height * d;
  cv.style.width = r.width + 'px';
  cv.style.height = r.height + 'px';
  draw();
}
addEventListener('resize', resize);
export const rng = s => () => {
  s |= 0;
  s = s + 0x6D2B79F5 | 0;
  let t = Math.imul(s ^ s >>> 15, 1 | s);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
export function rl(c, x1, y1, x2, y2, r) {
  const R = r.R == null ? 1 : r.R;
  if (R === 0) {
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    return;
  }
  const L = Math.hypot(x2 - x1, y2 - y1),
    o = Math.min(1.1 * R, (L / 24 + .2) * R);
  for (let k = 0; k < (ST.LT ? 1 : 2); k++) {
    const a = () => (r() - .5) * o * 2;
    c.moveTo(x1 + a(), y1 + a());
    c.quadraticCurveTo((x1 + x2) / 2 + a() * 1.6, (y1 + y2) / 2 + a() * 1.6, x2 + a(), y2 + a());
  }
}
ST.snap = true;
ST.guide = null;
ST.tfs = 24;
ST.rough = 1;
ST.msel = [];
ST.tff = 'hand';
ST.tds = 'solid';
ST.tah = 'arrow';
ST.ck = 'resistor';
export const FF = {
  hand: 'Caveat,cursive',
  sans: 'Figtree,system-ui,sans-serif',
  serif: 'Lora,Georgia,serif',
  mono: '"JetBrains Mono",monospace',
  marker: '"Permanent Marker",cursive'
};
export const G = 14;
export const BG = ['auto', '#fffdf2', '#e8f1fb', '#e9f6ec', '#fbe9ee', '#2b2f3a'];
export const CC = {};
export const css = n => CC[n] || (CC[n] = getComputedStyle(document.documentElement).getPropertyValue(n).trim());
ST.PERF = '';
try {
  ST.PERF = localStorage.getItem('sketchbooks-lite') || '';
} catch (e) {}
ST.BATLOW = false;
export const COARSE = matchMedia('(pointer:coarse)').matches;
export const FSOK = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
export const LITE = () => ST.PERF === '1' || ST.PERF !== '0' && (ST.BATLOW || navigator.hardwareConcurrency <= 4 || navigator.deviceMemory <= 2);
export const dpr = () => LITE() ? 1 : Math.min(devicePixelRatio || 1, 2);
ST.LT = LITE();
ST.rq = 0;
export const BBC = new WeakMap();
export const VER = new WeakMap();
export const THC = new Map();
export function loadScript(u) {
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = u;
    s.onload = ok;
    s.onerror = no;
    document.head.appendChild(s);
  });
}
let mjP = null;
let ndP = null;
ST.nerdTried = false;
let xl = 0;
export function loadMJ() {
  if (!mjP) mjP = loadScript('https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js').catch(e => {
    report(e, 'MathJax failed to load', { quiet: true });
    mjP = null;
  });
  return mjP;
}
export function loadNerd() {
  if (!ndP) {
    const b = 'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/';
    ndP = ['nerdamer.core.js', 'Algebra.js', 'Calculus.js', 'Solve.js'].reduce((p, f) => p.then(() => loadScript(b + f)), Promise.resolve()).catch(e => {
      report(e, 'Nerdamer failed to load', { quiet: true });
      ndP = null;
      throw e;
    });
  }
  return ndP;
}
export function needX() {
  if (xl) return;
  xl = 1;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Lora:wght@500&family=JetBrains+Mono:wght@500&family=Permanent+Marker&display=swap';
  l.onload = () => setTimeout(() => {
    P().els.forEach(e => e.t === 'text' && tfit(e));
    draw();
  }, 300);
  document.head.appendChild(l);
}
ST.lt = 0;
let lswWarned = 0;
export function lsw() {
  try {
    localStorage.setItem('sketchbooks1', JSON.stringify(ST.S));
    lswWarned = 0;
  } catch (e) {
    if (!lswWarned) {
      lswWarned = 1;
      alert('Local storage is full: recent changes are NOT saved on this device. Use Backup or save to the cloud, then delete some pages.');
    }
  }
}
addEventListener('pagehide', lsw);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) lsw();
});
const lum = h => {
  const n = parseInt(h.slice(1), 16);
  return (.299 * (n >> 16) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255;
};
export const custom = p => p.bg && p.bg !== 'auto';
export const inkFor = p => custom(p) ? lum(p.bg) > .5 ? '#1c2230' : '#e6e9ef' : css('--ink');
export const rot = (x, y, cx, cy, a) => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
};
export const col = c => c === 'auto' ? ST.INK : c;
