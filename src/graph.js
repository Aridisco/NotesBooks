// Function graphs: a live page object that keeps its formula, so editing f(x) redraws the curve.
import { ST } from './state.js';
import { col, css, loadNerd } from './env.js';
import { draw } from './render.js';

// LaTeX (typed in the math field) to the plain syntax the solver understands.
export function l2p(t) {
  t = t.replace(/\\placeholder\{\}/g, '').replace(/\\operatorname\{(\w+)\}/g, '$1').replace(/\\mathrm\{(\w+)\}/g, '$1').replace(/\\exponentialE/g, 'e').replace(/\\imaginaryI/g, 'i').replace(/\\differentialD/g, 'd')
    .replace(/\\left|\\right|\\[,;!:]|\\quad|\\displaystyle/g, '').replace(/\\cdot|\\times/g, '*').replace(/\\div/g, '/').replace(/\\pi/g, 'pi').replace(/\\(arcsin|arccos|arctan|sinh|cosh|tanh|sin|cos|tan|ln|log|exp)/g, '$1').replace(/\{,\}/g, '.');
  let p;
  do {
    p = t;
    t = t.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))').replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, '(($2)^(1/($1)))').replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)').replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/_\{([^{}]*)\}/g, '');
  } while (p !== t);
  return t.replace(/\{/g, '(').replace(/\}/g, ')').replace(/\s+/g, '');
}

const FN = new Map();
const GC = ['#1971c2', '#e03131', '#2f9e44', '#f08c00', '#7048e8'];
// Compiled functions for "f1; f2; …", or null while the solver library is still loading.
export function graphFns(fx) {
  if (!window.nerdamer) {
    loadNerd().then(draw).catch(() => {});
    return null;
  }
  let f = FN.get(fx);
  if (!f) {
    f = l2p(fx || '').split(';').filter(Boolean).map(q => {
      try {
        return nerdamer(q.replace(/^([a-z]\(x\)|y)=/, '')).buildFunction(['x']);
      } catch (e) {
        return null;
      }
    });
    FN.set(fx, f);
  }
  return f;
}
function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}
const fmt = (v, st) => String(+v.toFixed(Math.max(0, -Math.floor(Math.log10(st)))));

export function drawGraph(e) {
  const c = ST.ctx, X = Math.min(e.x, e.x + e.w), Y = Math.min(e.y, e.y + e.h), W = Math.abs(e.w), H = Math.abs(e.h);
  const x0 = e.x0 ?? -10, x1 = e.x1 ?? 10, ink = ST.INK;
  c.save();
  c.setLineDash([]);
  c.fillStyle = css('--panel');
  c.strokeStyle = css('--line');
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(X, Y, W, H, 8);
  c.fill();
  c.stroke();
  c.clip();
  const fns = graphFns(e.fx), N = Math.max(120, Math.min(800, Math.round(W)));
  c.font = '500 12px Figtree,system-ui,sans-serif';
  if (!fns) {
    c.fillStyle = ink;
    c.textAlign = 'center';
    c.fillText('Loading graph…', X + W / 2, Y + H / 2);
    c.restore();
    return;
  }
  const S = fns.map(f => {
    const o = [];
    for (let k = 0; k <= N; k++) {
      const x = x0 + (x1 - x0) * k / N;
      let y = NaN;
      try {
        y = f ? +f(x) : NaN;
      } catch (er) {}
      o.push(isFinite(y) ? y : NaN);
    }
    return o;
  });
  let y0 = e.y0, y1 = e.y1;
  if (y0 == null || y1 == null) {
    // automatic range ignores the extreme 2% so asymptotes do not flatten the curve
    const all = S.flat().filter(isFinite).sort((a, b) => a - b);
    let lo = all.length ? all[Math.floor(all.length * .02)] : -10, hi = all.length ? all[Math.ceil(all.length * .98) - 1] : 10;
    if (hi - lo < 1e-9) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * .1;
    if (y0 == null) y0 = lo - pad;
    if (y1 == null) y1 = hi + pad;
  }
  const px = x => X + (x - x0) / (x1 - x0) * W, py = y => Y + H - (y - y0) / (y1 - y0) * H;
  // grid and axes
  const sx = niceStep((x1 - x0) / 8), sy = niceStep((y1 - y0) / 6);
  c.strokeStyle = ink;
  c.globalAlpha = .08;
  c.beginPath();
  for (let v = Math.ceil(x0 / sx) * sx; v <= x1; v += sx) {
    c.moveTo(px(v), Y);
    c.lineTo(px(v), Y + H);
  }
  for (let v = Math.ceil(y0 / sy) * sy; v <= y1; v += sy) {
    c.moveTo(X, py(v));
    c.lineTo(X + W, py(v));
  }
  c.stroke();
  c.globalAlpha = .55;
  const ax = Math.max(X, Math.min(X + W, px(0))), ay = Math.max(Y, Math.min(Y + H, py(0)));
  c.beginPath();
  c.moveTo(X, ay);
  c.lineTo(X + W, ay);
  c.moveTo(ax, Y);
  c.lineTo(ax, Y + H);
  c.stroke();
  c.globalAlpha = .7;
  c.fillStyle = ink;
  c.textAlign = 'center';
  c.textBaseline = 'top';
  for (let v = Math.ceil(x0 / sx) * sx; v <= x1; v += sx) if (Math.abs(v) > sx / 2 && px(v) > X + 14 && px(v) < X + W - 14) c.fillText(fmt(v, sx), px(v), Math.min(ay + 4, Y + H - 16));
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  for (let v = Math.ceil(y0 / sy) * sy; v <= y1; v += sy) if (Math.abs(v) > sy / 2 && py(v) > Y + 10 && py(v) < Y + H - 10) c.fillText(fmt(v, sy), Math.min(ax + 5, X + W - 30), py(v));
  c.globalAlpha = 1;
  // curves: break the line where the function jumps or is undefined
  const jump = (y1 - y0) * 2;
  S.forEach((o, k) => {
    c.strokeStyle = k === 0 && e.stroke !== 'auto' ? col(e.stroke) : GC[k % GC.length];
    c.lineWidth = Math.max(1.5, e.sw || 2);
    c.lineJoin = c.lineCap = 'round';
    c.beginPath();
    let on = false;
    o.forEach((y, i) => {
      if (!isFinite(y) || (i && Math.abs(y - o[i - 1]) > jump)) {
        on = false;
        if (!isFinite(y)) return;
      }
      const X_ = px(x0 + (x1 - x0) * i / N), Y_ = py(y);
      on ? c.lineTo(X_, Y_) : c.moveTo(X_, Y_);
      on = true;
    });
    c.stroke();
  });
  // legend
  // readable legend: drop the extra brackets the LaTeX conversion adds around fractions and powers
  const tidy = q => {
    let p;
    do {
      p = q;
      q = q.replace(/\(\(([^()]*)\)\/\(([^()]*)\)\)/g, '$1/$2').replace(/\^\(([^()]+)\)/g, (m, a) => /^[\w.]+$/.test(a) ? '^' + a : m).replace(/\(\(([^()]*)\)\)/g, '($1)');
    } while (p !== q);
    return q;
  };
  const names = l2p(e.fx || '').split(';').filter(Boolean).map(tidy);
  c.textBaseline = 'top';
  names.forEach((n, k) => {
    c.fillStyle = k === 0 && e.stroke !== 'auto' ? col(e.stroke) : GC[k % GC.length];
    c.fillText((/=/.test(n) ? '' : 'y = ') + n.slice(0, 40), X + 10, Y + 8 + k * 16);
  });
  c.restore();
}
