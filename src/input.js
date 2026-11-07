import { P, ST } from './state.js';
import { $, cv, esc, uid } from './util.js';
import { save } from './cloud.js';
import { FF, G, col, needX, rot } from './env.js';
import { A4H, A4W, GAP, OX, bb, cl, commit, cpts, draw, drawView, hdl, polyPts, spreadOf, tfit } from './render.js';
import { cur, selIds, union } from './edit.js';
import { compPlace, openLabel, wpts } from './circuit.js';
import { TCOL, THL, badgePos, cellAt, linkOf, openCell, openLink, tablePlace, tgeo } from './objects.js';
import { openMath } from './math.js';
import { closePops, props, setTool } from './toolbar.js';
import { CODE_H, CODE_W, codeFit, openCode } from './code.js';
import { switchPage } from './notebooks.js';
import { segInRect } from './geom.js';

const w2 = (px, py) => {
  const v = P().v;
  return [(px - v.x) / v.z - OX(), (py - v.y) / v.z];
};
// Moves a new object's origin so a w×h object stays fully visible, clear of the top bar and the tool palette.
const inView = (q, w, h) => {
  const v = P().v,
    x0 = (8 - v.x) / v.z - OX(),
    x1 = (cv.clientWidth - 8 - v.x) / v.z - OX(),
    y0 = (68 - v.y) / v.z,
    y1 = (cv.clientHeight - 150 - v.y) / v.z;
  return [Math.max(x0, Math.min(q[0], x1 - w)), Math.max(y0, Math.min(q[1], y1 - h))];
};
function dseg(px, py, x1, y1, x2, y2) {
  const l = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  let t = l ? ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - x1 - t * (x2 - x1), py - y1 - t * (y2 - y1));
}
function hit(x0, y0) {
  const tol = 8 / P().v.z,
    els = P().els;
  for (let i = els.length - 1; i >= 0; i--) {
    const e = els[i],
      b = bb(e);
    let x = x0,
      y = y0;
    if (e.r) {
      const q = rot(x0, y0, b.x + b.w / 2, b.y + b.h / 2, -e.r);
      x = q[0];
      y = q[1];
    }
    if (e.t === 'wire') {
      const q = wpts(e);
      for (let j = 0; j < q.length - 1; j++) if (dseg(x, y, q[j][0], q[j][1], q[j + 1][0], q[j + 1][1]) < tol) return e;
    } else if (e.t === 'curve') {
      const q = cpts(e);
      for (let j = 0; j < q.length - 1; j++) if (dseg(x, y, q[j][0], q[j][1], q[j + 1][0], q[j + 1][1]) < tol) return e;
    } else if (e.t === 'line' || e.t === 'arrow') {
      if (dseg(x, y, e.x, e.y, e.x + e.w, e.y + e.h) < tol) return e;
    } else if (e.t === 'poly' && e.fill === 'none') {
      const q = polyPts(b, e.n || 5);
      for (let j = 0; j < q.length; j++) if (dseg(x, y, ...q[j], ...q[(j + 1) % q.length]) < tol) return e;
    } else if (e.t === 'free') {
      // test the segments, not just the sampled points: a straight or fast stroke has few vertices
      const q = e.pts, r = tol + e.sw;
      if (q.length === 1 && Math.hypot(x - e.x - q[0][0], y - e.y - q[0][1]) < r) return e;
      for (let j = 0; j < q.length - 1; j++) if (dseg(x, y, e.x + q[j][0], e.y + q[j][1], e.x + q[j + 1][0], e.y + q[j + 1][1]) < r) return e;
    } else if (e.t === 'text' || e.t === 'code' || e.t === 'math' || e.t === 'img' || e.t === 'comp' || e.t === 'table' || e.t === 'graph' || e.fill !== 'none') {
      if (x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol) return e;
    } else {
      const inside = x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol,
        core = x > b.x + tol && x < b.x + b.w - tol && y > b.y + tol && y < b.y + b.h - tol;
      if (inside && !core) return e;
    }
  }
  return null;
}
// Selection box rule: an object is picked as soon as the box touches it, it does not have to be enclosed.
// Lines and pen strokes are tested along their path, so a box in the empty corner of a diagonal line misses it.
function touches(e, x1, y1, x2, y2) {
  let q = null;
  if (e.t === 'wire') q = wpts(e);
  else if (e.t === 'curve') q = cpts(e);
  else if (e.t === 'line' || e.t === 'arrow') q = [[e.x, e.y], [e.x + e.w, e.y + e.h]];
  else if (e.t === 'free') q = e.pts.map(p => [e.x + p[0], e.y + p[1]]);
  if (q) {
    const m = (e.sw || 2) / 2 + 1;
    if (q.length === 1) q = [q[0], q[0]];
    return q.some((p, i) => i && segInRect(q[i - 1][0], q[i - 1][1], p[0], p[1], x1 - m, y1 - m, x2 + m, y2 + m));
  }
  const b = bb(e);
  return b.x <= x2 && b.x + b.w >= x1 && b.y <= y2 && b.y + b.h >= y1;
}
function ax(vs, ts, t) {
  let b = null;
  vs.forEach(v => ts.forEach(q => {
    const d = q - v;
    if (Math.abs(d) < t && (!b || Math.abs(d) < Math.abs(b[0]))) b = [d, q];
  }));
  return b;
}
function tg(skip, i) {
  const o = [];
  P().els.forEach(e => {
    if (e === skip || skip && skip.has && skip.has(e)) return;
    const b = bb(e);
    o.push(...(i ? [b.y, b.y + b.h / 2, b.y + b.h] : [b.x, b.x + b.w / 2, b.x + b.w]));
  });
  return o;
}
export function snp(x, y, skip) {
  if (!ST.snap) {
    ST.guide = null;
    return cl([x, y]);
  }
  const t = 8 / P().v.z,
    a = ax([x], tg(skip, 0), t),
    b = ax([y], tg(skip, 1), t);
  ST.guide = {
    x: a ? a[1] : null,
    y: b ? b[1] : null
  };
  return cl([a ? x + a[0] : Math.round(x / G) * G, b ? y + b[0] : Math.round(y / G) * G]);
}
function snpMove(e, b, dx, dy) {
  let q = snpMove0(e, b, dx, dy);
  if (P().mode === 'a4') q = [Math.max(-b.x, Math.min(A4W - b.x - b.w, q[0])), Math.max(-b.y, Math.min(A4H - b.y - b.h, q[1]))];
  return q;
}
function snpMove0(e, b, dx, dy) {
  if (!ST.snap) {
    ST.guide = null;
    return [dx, dy];
  }
  const t = 8 / P().v.z,
    X = b.x + dx,
    Y = b.y + dy,
    a = ax([X, X + b.w / 2, X + b.w], tg(e, 0), t),
    c = ax([Y, Y + b.h / 2, Y + b.h], tg(e, 1), t);
  ST.guide = {
    x: a ? a[1] : null,
    y: c ? c[1] : null
  };
  return [dx + (a ? a[0] : Math.round(X / G) * G - X), dy + (c ? c[0] : Math.round(Y / G) * G - Y)];
}
function openText(x, y, e0) {
  const v = P().v,
    t = document.createElement('textarea'),
    fs = e0 && e0.fs || ST.tfs,
    ff = e0 && e0.ff || ST.tff;
  if (ff !== 'hand' && ff !== 'sans') needX();
  let runs = e0 && e0.runs ? JSON.parse(JSON.stringify(e0.runs)) : [],
    pl = e0 ? e0.text.length : 0,
    man = !!(e0 && e0.bw),
    aw = 0;
  t.value = e0 ? e0.text : '';
  t.style.cssText = `left:${x * v.z + v.x + OX() * v.z}px;top:${y * v.z + v.y}px;font-size:${fs * v.z}px;line-height:1.2;font-family:${FF[ff]};color:${col(e0 ? e0.stroke : ST.stroke)};resize:both;overflow:hidden;white-space:${man ? 'pre-wrap' : 'pre'};min-width:40px;min-height:${fs * v.z * 1.2 + 4}px`;
  if (man) t.style.width = e0.bw * v.z + 'px';
  $('#main').appendChild(t);
  ST.ed = t;
  const bar = document.createElement('div');
  bar.id = 'tcol';
  bar.innerHTML = TCOL.map(c => `<button class="sw" data-c="${c}" style="background:${c}" title="Text color" aria-label="Text color ${c}"></button>`).join('') + '<span class="sep"></span>' + THL.map(c => `<button class="sw" data-h="${c}" style="background:${c}" title="Highlight" aria-label="Highlight ${c}"></button>`).join('') + '<button class="b" data-x="1">Clear</button><div id="tprev"></div>';
  bar.hidden = true;
  bar.style.left = t.style.left;
  bar.style.top = Math.max(56, parseFloat(t.style.top) - 64) + 'px';
  $('#main').appendChild(bar);
  const prev = () => {
    const v2 = t.value,
      pts = new Set([0, v2.length]);
    runs.forEach(r => {
      pts.add(Math.min(r.a, v2.length));
      pts.add(Math.min(r.b, v2.length));
    });
    const A = [...pts].sort((a, b) => a - b);
    let h = '';
    for (let i = 0; i < A.length - 1; i++) {
      const a = A[i],
        b = A[i + 1];
      if (a === b) continue;
      const r = [...runs].reverse().find(q => q.a <= a && q.b >= b);
      h += `<span style="${r ? (r.c ? 'color:' + r.c + ';' : '') + (r.h ? 'background:' + r.h + ';' : '') : ''}">${esc(v2.slice(a, b))}</span>`;
    }
    bar.querySelector('#tprev').innerHTML = h || '&nbsp;';
  };
  const adj = () => {
    const d = t.value.length - pl;
    if (d) {
      const p = d > 0 ? t.selectionStart - d : t.selectionStart;
      runs.forEach(r => {
        if (r.a >= p + (d < 0 ? -d : 0)) {
          r.a += d;
          r.b += d;
        } else if (r.b > p) r.b = Math.max(r.a, r.b + d);
      });
      runs = runs.filter(r => r.b > r.a);
    }
    pl = t.value.length;
  };
  bar.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    const b = ev.target.closest('button');
    if (!b) return;
    const a = t.selectionStart,
      z = t.selectionEnd;
    if (a === z) return;
    if (b.dataset.x) runs = runs.filter(r => r.b <= a || r.a >= z);else runs.push(b.dataset.c ? {
      a,
      b: z,
      c: b.dataset.c
    } : {
      a,
      b: z,
      h: b.dataset.h
    });
    prev();
  });
  prev();
  const fit = () => {
    if (man) {
      t.style.height = 'auto';
      t.style.height = t.scrollHeight + 'px';
      return;
    }
    const L = t.value.split('\n');
    ST.ctx.font = `500 ${fs * v.z}px ${FF[ff]}`;
    t.style.width = Math.max(...L.map(l => ST.ctx.measureText(l).width), 20) + 26 + 'px';
    t.style.height = L.length * fs * v.z * 1.2 + 6 + 'px';
    aw = t.offsetWidth;
  };
  fit();
  setTimeout(() => {
    t.focus();
    t.selectionStart = t.selectionEnd = t.value.length;
  }, 0);
  t.addEventListener('pointerup', () => {
    if (!man && Math.abs(t.offsetWidth - aw) > 4) {
      man = true;
      t.style.whiteSpace = 'pre-wrap';
      fit();
    }
  });
  const done = () => {
    if (ST.ed !== t) return;
    ST.ed = null;
    const s = t.value,
      bw = man ? Math.round(t.offsetWidth / v.z) : 0;
    t.remove();
    bar.remove();
    if (e0) {
      delete e0.hide;
      if (s.trim()) {
        e0.text = s;
        e0.bw = bw || undefined;
        e0.fs = fs;
        e0.ff = ff;
        e0.runs = runs.length ? runs : undefined;
        tfit(e0);
      } else {
        P().els = P().els.filter(q => q !== e0);
        ST.sel = null;
      }
      commit();
      props();
    } else if (s.trim()) {
      const e = {
        id: uid(),
        t: 'text',
        x,
        y,
        w: 0,
        h: 0,
        stroke: ST.stroke,
        fill: 'none',
        sw: ST.sw,
        seed: 1,
        text: s,
        fs,
        ff,
        runs: runs.length ? runs : undefined,
        bw: bw || undefined
      };
      tfit(e);
      P().els.push(e);
      ST.sel = e.id;
      commit();
      props();
    }
  };
  const syncBar = () => {
    bar.hidden = t.selectionStart === t.selectionEnd;
  };
  ['select', 'keyup', 'pointerup', 'input', 'touchend'].forEach(n => t.addEventListener(n, syncBar));
  t.addEventListener('blur', done);
  t.addEventListener('keydown', k => {
    if (k.key === 'Escape') t.blur();
    k.stopPropagation();
  });
  t.addEventListener('input', () => {
    adj();
    fit();
    prev();
  });
}
const ptrs = new Map();
let pinch = null;
const pos = ev => {
  const r = cv.getBoundingClientRect();
  return [ev.clientX - r.left, ev.clientY - r.top];
};
cv.addEventListener('pointerdown', ev => {
  if (ST.ed) {
    ST.ed.blur();
    return;
  }
  if (ev.pointerType === 'pen') ST.penSeen = true;
  // Once a pen has been used, fingers only pan and zoom, and a resting palm never interrupts a stroke.
  const fingerPan = ev.pointerType === 'touch' && ST.penSeen;
  if (fingerPan && ST.act && ST.act.k === 'draw') return;
  if (!(ST.space || ST.tool === 'hand' || fingerPan) && ptrs.size === 0) {
    // In a two-page spread, pressing the other sheet makes it the active page.
    const cp = P(), sp = spreadOf(cp);
    if (sp) {
      const want = (pos(ev)[0] - cp.v.x) / cp.v.z > A4W + GAP / 2 ? sp.R : sp.L;
      if (want !== cp) switchPage(want.id);
    }
  }
  cv.setPointerCapture(ev.pointerId);
  const [px, py] = pos(ev),
    p = P();
  ptrs.set(ev.pointerId, [px, py]);
  closePops();
  if (ptrs.size === 2) {
    if (ST.act && ST.act.k === 'draw' && p.els[p.els.length - 1] === ST.act.e) p.els.pop();
    ST.act = null;
    const [a, b] = [...ptrs.values()];
    pinch = {
      d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1,
      cx: (a[0] + b[0]) / 2,
      cy: (a[1] + b[1]) / 2,
      v: {
        ...p.v
      }
    };
    draw();
    return;
  }
  if (ptrs.size > 2) return;
  let [x, y] = w2(px, py);
  if (ST.space || ev.button === 1 || ST.tool === 'hand' || fingerPan) {
    ST.act = {
      k: 'pan',
      px,
      py,
      v: {
        ...p.v
      }
    };
    return;
  }
  if (ST.tool === 'select') {
    const bh = p.els.find(e => {
      if (!linkOf(e)) return false;
      const q = badgePos(e);
      return Math.hypot(q[0] - x, q[1] - y) < (ev.pointerType === 'touch' ? 16 : 11) / p.v.z;
    });
    if (bh) {
      openLink(linkOf(bh));
      return;
    }
    const s = p.els.find(e => e.id === ST.sel);
    if (s && !s.lk && s.t === 'table' && !s.r) {
      // dragging an inner grid line of the selected table resizes that row or column
      const g = tgeo(s), tl = (ev.pointerType === 'touch' ? 14 : 6) / p.v.z;
      const inY = y > s.y && y < s.y + s.h, inX = x > s.x && x < s.x + s.w;
      const j = inY ? g.xs.slice(1, -1).findIndex(v => Math.abs(v - x) < tl) : -1;
      const i = j < 0 && inX ? g.ys.slice(1, -1).findIndex(v => Math.abs(v - y) < tl) : -1;
      if (j >= 0 || i >= 0) {
        ST.act = { k: 'tgrid', e: s, j, i, x, y, cw: g.cw.slice(), rh: g.rh.slice(), w: s.w, h: s.h };
        return;
      }
    }
    if (s && !s.lk) {
      const tol = (ev.pointerType === 'touch' ? 26 : 12) / p.v.z;
      for (const h of hdl(s)) if (Math.hypot(h.x - x, h.y - y) < tol) {
        ST.act = {
          k: 'rs',
          h: h.k,
          e: s,
          o: JSON.parse(JSON.stringify(s)),
          b0: bb(s)
        };
        return;
      }
    }
    const h = hit(x, y);
    if ((ev.ctrlKey || ev.metaKey) && h && linkOf(h)) {
      openLink(linkOf(h));
      return;
    }
    if (h && ST.msel.includes(h.id)) {
      const its = cur().filter(e => !e.lk);
      if (its.length) ST.act = {
        k: 'gmove',
        x,
        y,
        its: its.map(e => ({
          e,
          ox: e.x,
          oy: e.y
        })),
        b0: union(its),
        set: new Set(its)
      };
      return;
    }
    ST.msel = [];
    ST.sel = h ? h.id : null;
    if (h && h.t === 'table') ST.tc = { id: h.id, ...cellAt(h, x, y) };
    if (h) {
      if (!h.lk) ST.act = {
        k: 'move',
        x,
        y,
        ox: h.x,
        oy: h.y,
        e: h,
        b0: bb(h)
      };
    } else ST.act = {
      k: 'box',
      x,
      y,
      x2: x,
      y2: y
    };
    draw();
    props();
    return;
  }
  if (ST.tool === 'eraser') {
    ST.act = {
      k: 'erase',
      lx: x,
      ly: y
    };
    const h = hit(x, y);
    if (h) {
      p.els = p.els.filter(e => e !== h);
      draw();
    }
    return;
  }
  if (ST.tool === 'text') {
    const h = hit(x, y);
    if (h && h.t === 'text') {
      ST.sel = h.id;
      h.hide = true;
      draw();
      openText(h.x, h.y, h);
    } else openText(...cl([x, y]));
    props();
    return;
  }
  if (ST.tool === 'code') {
    const h = hit(x, y);
    if (h && h.t === 'code') {
      ST.sel = h.id;
      h.hide = true;
      draw();
      openCode(h.x, h.y, h);
    } else openCode(...inView(cl([x, y]), CODE_W, CODE_H));
    props();
    return;
  }
  if (ST.tool === 'math') {
    openMath(...cl([x, y]));
    setTool('select');
    return;
  }
  if (ST.tool === 'comp') {
    compPlace(x, y);
    return;
  }
  if (ST.tool === 'table') {
    tablePlace(...inView([x, y], 360, 132));
    setTool('select');
    return;
  }
  [x, y] = snp(x, y);
  const e = {
    id: uid(),
    t: ST.tool === 'hl' ? 'free' : ST.tool,
    x,
    y,
    w: 0,
    h: 0,
    stroke: ST.stroke,
    fill: ST.fill,
    sw: ST.sw,
    seed: Math.floor(Math.random() * 1e6),
    rg: ST.rough,
    ds: ST.tds,
    ah: ST.tah
  };
  if (ST.tool === 'free' || ST.tool === 'hl') e.pts = [[0, 0]];
  if (ST.tool === 'hl') e.hl = 1;
  if (ST.tool === 'poly') e.n = ST.sides;
  p.els.push(e);
  ST.act = {
    k: 'draw',
    e
  };
});
cv.addEventListener('pointermove', ev => {
  if (!ptrs.has(ev.pointerId)) return;
  const [px, py] = pos(ev),
    p = P();
  ptrs.set(ev.pointerId, [px, py]);
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()],
      d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1,
      cx = (a[0] + b[0]) / 2,
      cy = (a[1] + b[1]) / 2,
      o = pinch.v,
      z = Math.max(.2, Math.min(4, o.z * d / pinch.d));
    p.v.z = z;
    p.v.x = cx - (pinch.cx - o.x) * z / o.z;
    p.v.y = cy - (pinch.cy - o.y) * z / o.z;
    drawView();
    return;
  }
  if (!ST.act) return;
  const [x, y] = w2(px, py);
  if (ST.act.k === 'pan') {
    p.v.x = ST.act.v.x + px - ST.act.px;
    p.v.y = ST.act.v.y + py - ST.act.py;
    return drawView();
  } else if (ST.act.k === 'move') {
    const q = snpMove(ST.act.e, ST.act.b0, x - ST.act.x, y - ST.act.y);
    ST.act.e.x = ST.act.ox + q[0];
    ST.act.e.y = ST.act.oy + q[1];
    ST.act.m = 1;
  } else if (ST.act.k === 'gmove') {
    const q = snpMove(ST.act.set, ST.act.b0, x - ST.act.x, y - ST.act.y);
    ST.act.its.forEach(i => {
      i.e.x = i.ox + q[0];
      i.e.y = i.oy + q[1];
    });
    ST.act.m = 1;
  } else if (ST.act.k === 'tgrid') {
    const a = ST.act, e = a.e;
    if (a.j >= 0) {
      const nv = Math.max(24, a.cw[a.j] + x - a.x);
      e.cw = a.cw.slice();
      e.cw[a.j] = nv;
      e.w = a.w + nv - a.cw[a.j];
    } else {
      const nv = Math.max(20, a.rh[a.i] + y - a.y);
      e.rh = a.rh.slice();
      e.rh[a.i] = nv;
      e.h = a.h + nv - a.rh[a.i];
    }
    a.m = 1;
  } else if (ST.act.k === 'box') {
    ST.act.x2 = x;
    ST.act.y2 = y;
  } else if (ST.act.k === 'erase') {
    // sample the path since the last event so a quick swipe can't jump over a thin stroke
    const a = ST.act, lx = a.lx ?? x, ly = a.ly ?? y, n = Math.max(1, Math.ceil(Math.hypot(x - lx, y - ly) * p.v.z / 6));
    for (let k = 1; k <= n; k++) {
      const h = hit(lx + (x - lx) * k / n, ly + (y - ly) * k / n);
      if (h) {
        p.els = p.els.filter(e => e !== h);
        a.m = 1;
      }
    }
    a.lx = x;
    a.ly = y;
  } else if (ST.act.k === 'rs') {
    const e = ST.act.e,
      o = ST.act.o,
      b = ST.act.b0;
    ST.act.m = 1;
    if (ST.act.h === 'c') {
      e.qx = 2 * x - .5 * (2 * e.x + e.w) - e.x;
      e.qy = 2 * y - .5 * (2 * e.y + e.h) - e.y;
    } else if (ST.act.h === 's' || ST.act.h === 'e') {
      const q = snp(x, y, e);
      if (ST.act.h === 's') {
        e.x = q[0];
        e.y = q[1];
        e.w = o.x + o.w - q[0];
        e.h = o.y + o.h - q[1];
        if (e.t === 'curve') {
          e.qx = o.x + o.qx - e.x;
          e.qy = o.y + o.qy - e.y;
        }
      } else {
        e.w = q[0] - e.x;
        e.h = q[1] - e.y;
      }
    } else if (ST.act.h === 'rot') {
      const cx = b.x + b.w / 2,
        cy = b.y + b.h / 2;
      let a = Math.atan2(y - cy, x - cx) + Math.PI / 2;
      if (ST.snap) {
        const q = Math.round(a / (Math.PI / 12)) * Math.PI / 12;
        if (Math.abs(q - a) < .07) a = q;
      }
      e.r = a;
    } else {
      const r = o.r || 0,
        c0 = [b.x + b.w / 2, b.y + b.h / 2],
        cs = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]],
        op = cs[(ST.act.h + 2) % 4],
        ow = rot(op[0], op[1], c0[0], c0[1], r),
        pt = r ? [x, y] : snp(x, y, e),
        c1 = [(ow[0] + pt[0]) / 2, (ow[1] + pt[1]) / 2],
        q = rot(pt[0], pt[1], c1[0], c1[1], -r),
        oq = rot(ow[0], ow[1], c1[0], c1[1], -r),
        nx = Math.min(q[0], oq[0]),
        ny = Math.min(q[1], oq[1]),
        nw = Math.max(4, Math.abs(q[0] - oq[0])),
        nh = Math.max(4, Math.abs(q[1] - oq[1]));
      if (e.t === 'free') {
        const sx = nw / (b.w || 1),
          sy = nh / (b.h || 1);
        e.x = nx;
        e.y = ny;
        e.pts = o.pts.map(p => [(o.x + p[0] - b.x) * sx, (o.y + p[1] - b.y) * sy]);
      } else if (e.t === 'text' || e.t === 'math' || e.t === 'img') {
        const k = Math.max(nw / (b.w || 1), nh / (b.h || 1));
        e.x = nx;
        e.y = ny;
        e.fs = (o.fs || 24) * k;
        if (o.bw) e.bw = o.bw * k;
        e.w = o.w * k;
        e.h = o.h * k;
      } else {
        e.x = nx;
        e.y = ny;
        e.w = nw;
        e.h = nh;
      }
    }
  } else {
    const e = ST.act.e;
    if (e.t === 'free') {
      const q = cl([x, y]),
        l = e.pts[e.pts.length - 1];
      if (Math.hypot(q[0] - e.x - l[0], q[1] - e.y - l[1]) > 2 / p.v.z) e.pts.push([q[0] - e.x, q[1] - e.y]);
    } else {
      const q = snp(x, y, e);
      e.w = q[0] - e.x;
      e.h = q[1] - e.y;
      if (e.t === 'curve') {
        e.qx = e.w / 2 - e.h * .25;
        e.qy = e.h / 2 + e.w * .25;
      }
      if (ev.shiftKey && e.t !== 'line' && e.t !== 'arrow') {
        const m = Math.max(Math.abs(e.w), Math.abs(e.h));
        e.w = Math.sign(e.w || 1) * m;
        e.h = Math.sign(e.h || 1) * m;
      }
    }
  }
  draw();
});
const up = ev => {
  ptrs.delete(ev.pointerId);
  if (pinch) {
    if (ptrs.size < 2) pinch = null;
    save();
    return;
  }
  if (!ST.act) return;
  const a = ST.act;
  ST.act = null;
  ST.guide = null;
  if (a.k === 'pan') {
    save();
    return;
  }
  if (a.k === 'box') {
    const x1 = Math.min(a.x, a.x2),
      y1 = Math.min(a.y, a.y2),
      x2 = Math.max(a.x, a.x2),
      y2 = Math.max(a.y, a.y2),
      ids = Math.hypot(a.x2 - a.x, a.y2 - a.y) < 4 ? [] : P().els.filter(e => touches(e, x1, y1, x2, y2)).map(e => e.id);
    selIds(ids);
    draw();
    props();
    return;
  }
  if (a.k === 'move' || a.k === 'gmove' || a.k === 'erase' || a.k === 'rs' || a.k === 'tgrid') {
    if (a.k === 'rs' && a.e.t === 'code') codeFit(a.e);
    if (a.m) commit();else draw();
    return;
  }
  const e = a.e;
  if (e.t !== 'free' && Math.abs(e.w) < 4 && Math.abs(e.h) < 4) {
    P().els.pop();
    draw();
    return;
  }
  // finished pen and highlighter strokes are not selected (no box in the way of the next stroke); the Select tool picks them later
  ST.sel = e.t === 'free' ? null : e.id;
  commit();
  if (!['free', 'hl', 'wire'].includes(ST.tool)) setTool('select');
  props();
};
addEventListener('pointerup', up);
addEventListener('pointercancel', up);
cv.addEventListener('dblclick', ev => {
  if (ST.ed) return;
  const [px, py] = pos(ev),
    q = w2(px, py),
    h = hit(q[0], q[1]);
  if (h && (h.t === 'math' || h.t === 'graph')) {
    ST.sel = h.id;
    openMath(h.x, h.y, h);
  } else if (h && h.t === 'table') {
    ST.sel = h.id;
    const c = cellAt(h, q[0], q[1]);
    openCell(h, c.i, c.j);
  } else if (h && h.t === 'code') {
    ST.sel = h.id;
    h.hide = true;
    draw();
    openCode(h.x, h.y, h);
  } else if (h && h.t === 'comp') {
    ST.sel = h.id;
    openLabel(h);
  } else if (h && h.t === 'text') {
    ST.sel = h.id;
    h.hide = true;
    draw();
    openText(h.x, h.y, h);
  } else if (!h && ST.tool === 'select') openText(...cl(q));
});
