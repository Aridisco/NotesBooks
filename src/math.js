import { P, ST } from './state.js';
import { $, cv, uid } from './util.js';
import { save } from './cloud.js';
import { loadMJ, loadNerd } from './env.js';
import { cl, commit, draw } from './render.js';
import { props } from './toolbar.js';

/* math */
let mpos = null;
let medit = null;
let mresTex = null;
function l2p(t) {
  t = t.replace(/\\left|\\right|\\[,;!:]|\\quad/g, '').replace(/\\cdot|\\times/g, '*').replace(/\\div/g, '/').replace(/\\pi/g, 'pi').replace(/\\(sin|cos|tan|ln|log|exp|arcsin|arccos|arctan|sinh|cosh|tanh)/g, '$1');
  let p;
  do {
    p = t;
    t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))').replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, '(($2)^(1/($1)))').replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)').replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/_\{([^{}]*)\}/g, '');
  } while (p !== t);
  return t.replace(/\{/g, '(').replace(/\}/g, ')').replace(/\s+/g, '');
}
function ntex(v) {
  let t = nerdamer(v).toTeX();
  try {
    const d = Number(nerdamer(v).evaluate().text('decimals'));
    if (isFinite(d) && !Number.isInteger(d) && t.includes('\\')) t += '\\approx ' + +d.toFixed(4);
  } catch (e) {}
  return t;
}
function msolve(op) {
  const tex = $('#mtex').value.trim(),
    out = $('#mres');
  mresTex = null;
  $('#madd').hidden = true;
  if (!tex) {
    out.textContent = 'Type a formula first';
    return;
  }
  if (!window.nerdamer || !nerdamer.solveEquations) {
    if (ST.nerdTried) {
      out.textContent = 'Solver unavailable (offline?)';
      return;
    }
    ST.nerdTried = true;
    out.textContent = 'Loading solver…';
    loadNerd().then(() => msolve(op)).catch(() => {
      ST.nerdTried = false;
      out.textContent = 'Could not load the solver (offline?)';
    });
    return;
  }
  try {
    const pl = l2p(tex),
      sd = q => q.includes('=') ? q.replace('=', '-(') + ')' : q;
    let T;
    const vs = [...new Set(pl.split(';').flatMap(q => nerdamer(sd(q)).variables()))],
      v = vs.includes('x') ? 'x' : vs[0] || 'x';
    if (op === 'solve') {
      const eqs = pl.split(';').map(q => q.trim()).filter(Boolean);
      if (!vs.length) {
        out.textContent = 'No unknown to solve for';
        return;
      }
      const res = eqs.length === 1 ? nerdamer.solveEquations(eqs[0].includes('=') ? eqs[0] : eqs[0] + '=0', v).map(r => Array.isArray(r) ? [String(r[0]), String(r[1])] : [v, String(r)]) : nerdamer.solveEquations(eqs).map(r => [String(r[0]), String(r[1])]);
      if (!res.length) {
        out.textContent = 'No solution found';
        return;
      }
      T = tex + '\\;\\Rightarrow\\;' + res.map(r => r[0] + '=' + ntex(r[1])).join(',\\; ');
    } else {
      if (pl.includes('=')) {
        out.textContent = 'Remove the "=" for this operation (or use Solve)';
        return;
      }
      if (op === 'eval') {
        const r = nerdamer(pl).evaluate(),
          n = +Number(r.text('decimals')).toPrecision(10);
        T = tex + '=' + (isFinite(n) ? n : r.toTeX());
      } else if (op === 'diff') T = '\\frac{d}{d' + v + '}\\left(' + tex + '\\right)=' + nerdamer('diff(' + pl + ',' + v + ')').toTeX();else if (op === 'int') T = '\\int ' + tex + '\\,d' + v + '=' + nerdamer('integrate(' + pl + ',' + v + ')').toTeX() + '+C';else T = tex + '=' + nerdamer(op + '(' + pl + ')').toTeX();
    }
    const r = mj(T);
    if (!r) {
      out.textContent = 'Computed, but the result could not be drawn';
      return;
    }
    out.innerHTML = r.svg;
    mresTex = T;
    $('#madd').hidden = false;
  } catch (er) {
    out.textContent = 'Cannot compute this one. Try a simpler form, e.g. x^2-4=0';
  }
}
$('#msv').innerHTML = [['solve', 'Solve'], ['simplify', 'Simplify'], ['expand', 'Expand'], ['factor', 'Factor'], ['diff', 'd/dx'], ['int', '∫dx'], ['eval', 'Evaluate']].map(x => `<button class="b" data-o="${x[0]}">${x[1]}</button>`).join('');
$('#msv').onclick = e => {
  const b = e.target.closest('button');
  if (b) msolve(b.dataset.o);
};
$('#madd').onclick = () => {
  if (!mresTex) return;
  const r = mj(mresTex);
  if (!r) return;
  const q = medit ? cl([medit.x, medit.y + medit.h + 14]) : mpos,
    id = uid();
  P().els.push({
    id,
    t: 'math',
    x: q[0],
    y: q[1],
    w: r.w,
    h: r.h,
    stroke: ST.stroke,
    fill: 'none',
    sw: ST.sw,
    seed: 1,
    tex: mresTex,
    svg: r.svg
  });
  ST.sel = id;
  mclose();
  commit();
  props();
};
function mj(tex) {
  if (!window.MathJax || !MathJax.tex2svg) return null;
  try {
    const c = MathJax.tex2svg(tex, {
        display: false
      }),
      sv = c.querySelector('svg');
    if (!sv || c.querySelector('[data-mml-node="merror"]')) return null;
    const k = 14,
      w = parseFloat(sv.getAttribute('width')) * k,
      h = parseFloat(sv.getAttribute('height')) * k;
    sv.setAttribute('width', w);
    sv.setAttribute('height', h);
    sv.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    sv.removeAttribute('style');
    return {
      svg: new XMLSerializer().serializeToString(sv),
      w,
      h
    };
  } catch (e) {
    return null;
  }
}
function mupd() {
  const t = $('#mtex').value.trim(),
    pv = $('#mprev');
  pv.innerHTML = '';
  if (!t) return pv.textContent = 'Type LaTeX above';
  const r = mj(t);
  if (r) pv.innerHTML = r.svg;else {
    pv.textContent = window.MathJax && MathJax.tex2svg ? 'Invalid formula' : 'Loading math engine…';
    if (!(window.MathJax && MathJax.tex2svg) && !$('#mbox').hidden) setTimeout(mupd, 700);
  }
}
export function openMath(x, y, e) {
  loadMJ();
  $('#mres').innerHTML = '';
  $('#madd').hidden = true;
  mresTex = null;
  mpos = [x, y];
  medit = e || null;
  $('#mtex').value = e ? e.tex : '';
  $('#mbox').hidden = false;
  mupd();
  setTimeout(() => $('#mtex').focus(), 0);
}
function mclose() {
  $('#mbox').hidden = true;
  medit = null;
}
function mok() {
  const t = $('#mtex').value.trim(),
    r = t && mj(t);
  if (!r) return;
  if (medit) {
    Object.assign(medit, {
      tex: t,
      svg: r.svg,
      w: r.w,
      h: r.h
    });
    ST.sel = medit.id;
  } else {
    const id = uid();
    P().els.push({
      id,
      t: 'math',
      x: mpos[0],
      y: mpos[1],
      w: r.w,
      h: r.h,
      stroke: ST.stroke,
      fill: 'none',
      sw: ST.sw,
      seed: 1,
      tex: t,
      svg: r.svg
    });
    ST.sel = id;
  }
  mclose();
  commit();
  props();
}
$('#mtex').addEventListener('input', mupd);
$('#mok').onclick = mok;
$('#mno').onclick = mclose;
$('#mtex').addEventListener('keydown', e => {
  if (e.key === 'Escape') mclose();
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    mok();
  }
});
const SN = [['a/b', '\\frac{}{}'], ['√', '\\sqrt{}'], ['xⁿ', '^{}'], ['xₙ', '_{}'], ['∑', '\\sum_{i=1}^{n}'], ['∫', '\\int_{a}^{b}'], ['lim', '\\lim_{x\\to 0}'], ['π', '\\pi'], ['∞', '\\infty'], ['≤', '\\leq'], ['±', '\\pm'], ['α', '\\alpha'], ['θ', '\\theta'], ['→', '\\to']];
$('#msn').innerHTML = SN.map((x, i) => `<button class="b" data-i="${i}">${x[0]}</button>`).join('');
$('#msn').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  const t = $('#mtex'),
    sn = SN[b.dataset.i][1],
    a = t.selectionStart,
    z = t.selectionEnd;
  t.value = t.value.slice(0, a) + sn + t.value.slice(z);
  const o = sn.indexOf('{');
  t.focus();
  t.selectionStart = t.selectionEnd = a + (o >= 0 ? o + 1 : sn.length);
  mupd();
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
