// Math panel: a visual formula editor (MathLive), a solver (nerdamer), statistics, and live function graphs.
import { P, ST } from './state.js';
import { $, cv, uid } from './util.js';
import { save } from './cloud.js';
import { loadMJ, loadNerd } from './env.js';
import { cl, commit, draw } from './render.js';
import { props } from './toolbar.js';
import { report } from './report.js';
import { I } from './icons.js';
import { drawGraph, l2p } from './graph.js';
import { gcd2, nums, stats } from './stats.js';

let mpos = null;
let medit = null;
let mresTex = null;
let tab = 'f';
let mf = null;

/* ---------- editor: MathLive when available, plain LaTeX box as the offline fallback ---------- */
async function ensureField() {
  if (mf) return mf;
  try {
    const { MathfieldElement } = await import('mathlive');
    MathfieldElement.fontsDirectory = 'https://cdn.jsdelivr.net/npm/mathlive@0.111.1/fonts/';
    MathfieldElement.soundsDirectory = null;
    mf = new MathfieldElement();
    mf.id = 'mf';
    mf.setAttribute('aria-label', 'Formula');
    mf.mathVirtualKeyboardPolicy = 'manual';
    mf.smartFence = true;
    mf.addEventListener('input', changed);
    mf.addEventListener('keydown', keys);
    $('#mfw').append(mf);
    $('#mtex').hidden = true;
  } catch (e) {
    report(e, 'Visual math editor could not load', { quiet: true });
    $('#mtex').hidden = false;
  }
  return mf;
}
const getTex = () => (mf ? mf.value : $('#mtex').value).replace(/\\placeholder\{\}/g, '').trim();
const setTex = t => mf ? mf.value = t : $('#mtex').value = t;
function keys(e) {
  e.stopPropagation();
  if (e.key === 'Escape') mclose();
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    mok();
  }
}
$('#mtex').addEventListener('input', changed);
$('#mtex').addEventListener('keydown', keys);

/* ---------- formula results ---------- */
function ntex(v) {
  let t = nerdamer(v).toTeX();
  try {
    const d = Number(nerdamer(v).evaluate().text('decimals'));
    if (isFinite(d) && !Number.isInteger(d) && t.includes('\\')) t += '\\approx ' + +d.toFixed(4);
  } catch (e) {}
  return t;
}
const num = v => +Number(v).toPrecision(10);
// Operations that only need plain JavaScript run immediately; the rest load the solver first.
function compute(op) {
  const tex = getTex(), out = $('#mres');
  mresTex = null;
  $('#madd').hidden = true;
  if (!tex) return out.textContent = 'Type a formula first';
  const pl = l2p(tex);
  if (op === 'stats' || op === 'gcd') {
    const a = nums(pl);
    if (a.length < (op === 'gcd' ? 2 : 1)) return out.textContent = op === 'gcd' ? 'Type two or more whole numbers, e.g. 12, 18, 30' : 'Type a list of numbers, e.g. 3, 5, 5, 8, 10';
    if (op === 'gcd' && !a.every(Number.isInteger)) return out.textContent = 'GCD and LCM need whole numbers';
    const g = a.reduce(gcd2), l = a.reduce((x, y) => Math.abs(x * y) / gcd2(x, y));
    return show(op === 'stats' ? stats(a) : `\\gcd(${a.join(', ')}) = ${g},\\quad \\operatorname{lcm}(${a.join(', ')}) = ${l}`);
  }
  if (!window.nerdamer || !nerdamer.solveEquations) {
    if (ST.nerdTried) return out.textContent = 'Solver unavailable (offline?)';
    ST.nerdTried = true;
    out.textContent = 'Loading solver…';
    loadNerd().then(() => compute(op)).catch(() => {
      ST.nerdTried = false;
      out.textContent = 'Could not load the solver (offline?)';
    });
    return;
  }
  try {
    const sd = q => q.includes('=') ? q.replace('=', '-(') + ')' : q;
    const vs = [...new Set(pl.split(';').flatMap(q => nerdamer(sd(q)).variables()))].filter(x => x !== 'i'),
      v = vs.includes('x') ? 'x' : vs[0] || 'x';
    let T;
    if (op === 'solve') {
      const eqs = pl.split(';').map(q => q.trim()).filter(Boolean);
      if (!vs.length) return out.textContent = 'No unknown to solve for';
      const res = eqs.length === 1 ? nerdamer.solveEquations(eqs[0].includes('=') ? eqs[0] : eqs[0] + '=0', v).map(r => Array.isArray(r) ? [String(r[0]), String(r[1])] : [v, String(r)]) : nerdamer.solveEquations(eqs).map(r => [String(r[0]), String(r[1])]);
      if (!res.length) return out.textContent = 'No solution found';
      T = tex + '\\;\\Rightarrow\\;' + res.map(r => r[0] + '=' + ntex(r[1])).join(',\\; ');
    } else {
      if (pl.includes('=')) return out.textContent = 'Remove the "=" for this operation (or use Solve)';
      if (op === 'eval') {
        const r = nerdamer(pl).evaluate(), n = num(r.text('decimals'));
        T = tex + '=' + (isFinite(n) ? n : r.toTeX());
      } else if (op === 'cplx') {
        const z = nerdamer('expand(' + pl + ')').evaluate().toString(), f = q => num(nerdamer(q + '(' + z + ')').evaluate().text('decimals'));
        const re = f('realpart'), im = f('imagpart');
        T = tex + '=' + re + (im < 0 ? '-' : '+') + Math.abs(im) + 'i,\\quad |z|=' + num(Math.hypot(re, im)) + ',\\quad \\arg z=' + num(Math.atan2(im, re));
      } else if (op === 'diff') T = '\\frac{d}{d' + v + '}\\left(' + tex + '\\right)=' + nerdamer('diff(' + pl + ',' + v + ')').toTeX();
      else if (op === 'int') T = '\\int ' + tex + '\\,d' + v + '=' + nerdamer('integrate(' + pl + ',' + v + ')').toTeX() + '+C';
      else T = tex + '=' + nerdamer(op + '(' + pl + ')').toTeX();
    }
    show(T);
  } catch (er) {
    out.textContent = 'Cannot compute this one. Try a simpler form, e.g. x^2-4=0';
  }
}
function show(T) {
  const r = mj(T), out = $('#mres');
  if (!r) return out.textContent = window.MathJax && MathJax.tex2svg ? 'Computed, but the result could not be drawn' : 'Loading math engine…';
  out.innerHTML = r.svg;
  // the SVG is sized for the page; show it at reading size in the panel
  const sv = out.querySelector('svg');
  if (sv) {
    sv.style.width = r.w * .6 + 'px';
    sv.style.height = r.h * .6 + 'px';
  }
  mresTex = T;
  $('#madd').hidden = false;
}
const OPS = [['Algebra', [['solve', 'Solve'], ['simplify', 'Simplify'], ['expand', 'Expand'], ['factor', 'Factor']]], ['Calculus', [['diff', 'd/dx'], ['int', '∫ dx'], ['eval', 'Evaluate']]], ['Numbers', [['cplx', 'Complex a+bi'], ['gcd', 'GCD · LCM'], ['stats', 'Statistics']]]];
$('#msv').innerHTML = OPS.map(([g, L]) => `<div class="mg"><b>${g}</b><div class="mrow">${L.map(x => `<button class="pill" data-o="${x[0]}">${x[1]}</button>`).join('')}</div></div>`).join('');
$('#msv').onclick = e => {
  const b = e.target.closest('button');
  if (b) compute(b.dataset.o);
};
$('#madd').onclick = () => {
  if (!mresTex) return;
  const r = mj(mresTex);
  if (!r) return;
  const q = medit && medit.t === 'math' ? cl([medit.x, medit.y + medit.h + 14]) : mpos;
  addMath(q, mresTex, r);
  mclose();
};
function addMath(q, tex, r) {
  const id = uid();
  P().els.push({ id, t: 'math', x: q[0], y: q[1], w: r.w, h: r.h, stroke: ST.stroke, fill: 'none', sw: ST.sw, seed: 1, tex, svg: r.svg });
  ST.sel = id;
  commit();
  props();
}
function mj(tex) {
  if (!window.MathJax || !MathJax.tex2svg) return null;
  try {
    const c = MathJax.tex2svg(tex, { display: false }),
      sv = c.querySelector('svg');
    if (!sv || c.querySelector('[data-mml-node="merror"]')) return null;
    const k = 14,
      w = parseFloat(sv.getAttribute('width')) * k,
      h = parseFloat(sv.getAttribute('height')) * k;
    sv.setAttribute('width', w);
    sv.setAttribute('height', h);
    sv.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    sv.removeAttribute('style');
    return { svg: new XMLSerializer().serializeToString(sv), w, h };
  } catch (e) {
    return null;
  }
}

/* ---------- graph tab ---------- */
const rng = id => {
  const v = $(id).value.trim();
  return v === '' || !isFinite(+v) ? null : +v;
};
function graphOpts() {
  const x0 = rng('#gx0') ?? -10, x1 = rng('#gx1') ?? 10;
  return { fx: getTex(), x0: Math.min(x0, x1 - 1e-6), x1: Math.max(x1, x0 + 1e-6), y0: rng('#gy0'), y1: rng('#gy1') };
}
function preview() {
  if (tab !== 'g') return;
  const c = $('#gprev'), r = c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
  c.width = r.width * d;
  c.height = r.height * d;
  const g = c.getContext('2d'), old = ST.ctx;
  g.setTransform(d, 0, 0, d, 0, 0);
  ST.ctx = g;
  drawGraph({ x: 0, y: 0, w: r.width, h: r.height, stroke: medit && medit.t === 'graph' ? medit.stroke : 'auto', sw: 2, ...graphOpts() });
  ST.ctx = old;
}
['#gx0', '#gx1', '#gy0', '#gy1'].forEach(s => $(s).addEventListener('input', preview));
// graphs that were still waiting for the solver redraw once it arrives
const prevSoon = () => setTimeout(preview, 0);

/* ---------- panel ---------- */
function changed() {
  if (tab === 'g') prevSoon();
  else {
    $('#mres').innerHTML = '';
    $('#madd').hidden = true;
    mresTex = null;
  }
}
function setTab(t) {
  tab = t;
  $('#mtab').querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.mt === t);
    b.setAttribute('aria-selected', b.dataset.mt === t);
  });
  $('#mpf').hidden = t !== 'f';
  $('#mpg').hidden = t !== 'g';
  $('#mok').textContent = t === 'g' ? (medit && medit.t === 'graph' ? 'Update graph' : 'Insert graph') : (medit && medit.t === 'math' ? 'Update formula' : 'Insert formula');
  if (t === 'g') {
    if (!window.nerdamer) loadNerd().then(prevSoon).catch(() => {});
    prevSoon();
  }
}
$('#mtab').onclick = e => {
  const b = e.target.closest('[data-mt]');
  if (b) setTab(b.dataset.mt);
};
export async function openMath(x, y, e) {
  loadMJ();
  $('#mres').innerHTML = '';
  $('#madd').hidden = true;
  mresTex = null;
  mpos = [x, y];
  medit = e || null;
  $('#mbox').hidden = false;
  await ensureField();
  const g = e && e.t === 'graph';
  setTex(e ? (g ? e.fx : e.tex) : '');
  $('#gx0').value = g ? e.x0 ?? -10 : -10;
  $('#gx1').value = g ? e.x1 ?? 10 : 10;
  $('#gy0').value = g && e.y0 != null ? e.y0 : '';
  $('#gy1').value = g && e.y1 != null ? e.y1 : '';
  setTab(g ? 'g' : 'f');
  setTimeout(() => (mf || $('#mtex')).focus(), 0);
}
function mclose() {
  $('#mbox').hidden = true;
  if (mf && window.mathVirtualKeyboard) mathVirtualKeyboard.hide();
  medit = null;
}
function mok() {
  const t = getTex();
  if (!t) return;
  if (tab === 'g') {
    const o = graphOpts();
    if (medit && medit.t === 'graph') Object.assign(medit, o);
    else {
      const id = uid();
      P().els.push({ id, t: 'graph', x: mpos[0], y: mpos[1], w: 420, h: 300, stroke: 'auto', fill: 'none', sw: 2, seed: 1, ...o });
      ST.sel = id;
    }
    mclose();
    commit();
    props();
    return;
  }
  const r = mj(t);
  if (!r) return $('#mres').textContent = window.MathJax && MathJax.tex2svg ? 'This formula cannot be drawn. Check for a missing bracket.' : 'Loading math engine…';
  if (medit && medit.t === 'math') {
    Object.assign(medit, { tex: t, svg: r.svg, w: r.w, h: r.h });
    ST.sel = medit.id;
    mclose();
    commit();
    props();
  } else {
    mclose();
    addMath(mpos, t, r);
  }
}
$('#mok').onclick = mok;
$('#mno').onclick = mclose;
$('#mno').innerHTML = I.x;
$('#mcancel').onclick = mclose;
$('#mkb').innerHTML = I.keyboard;
$('#mkb').onclick = () => {
  if (!mf || !window.mathVirtualKeyboard) return;
  mf.focus();
  mathVirtualKeyboard.visible ? mathVirtualKeyboard.hide() : mathVirtualKeyboard.show();
};

cv.addEventListener('wheel', ev => {
  ev.preventDefault();
  const v = P().v,
    r = cv.getBoundingClientRect(),
    px = ev.clientX - r.left,
    py = ev.clientY - r.top;
  if (ev.ctrlKey || ev.metaKey) {
    const z = Math.max(.2, Math.min(4, v.z * Math.exp(-ev.deltaY * .01)));
    v.x = px - (px - v.x) * z / v.z;
    v.y = py - (py - v.y) * z / v.z;
    v.z = z;
  } else {
    v.x -= ev.deltaX;
    v.y -= ev.deltaY;
  }
  save();
  draw();
}, {
  passive: false
});
