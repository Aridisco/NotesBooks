import { P, ST } from './state.js';
import { $, uid } from './util.js';
import { css } from './env.js';
import { OX, cl, commit } from './render.js';
import { snp } from './input.js';
import { selIds } from './edit.js';
import { props, setTool } from './toolbar.js';

const CK = {
  resistor: ['Resistor', 'R', 84, 42],
  capacitor: ['Capacitor', 'C', 84, 42],
  inductor: ['Inductor', 'L', 84, 42],
  battery: ['DC source', 'V', 84, 42],
  ac: ['AC source', 'V', 84, 42],
  isrc: ['Current src', 'I', 84, 42],
  ground: ['Ground', '', 42, 56],
  diode: ['Diode', 'D', 84, 42],
  led: ['LED', 'D', 84, 42],
  switch: ['Switch', 'S', 84, 42],
  lamp: ['Lamp', '', 84, 42],
  ammeter: ['Ammeter', '', 84, 42],
  voltmeter: ['Voltmeter', '', 84, 42],
  npn: ['NPN', 'Q', 56, 56],
  opamp: ['Op-amp', 'U', 84, 84],
  dot: ['Junction', '', 14, 14]
};
export function wpts(e) {
  const x2 = e.x + e.w,
    y2 = e.y + e.h;
  return Math.abs(e.w) >= Math.abs(e.h) ? [[e.x, e.y], [x2, e.y], [x2, y2]] : [[e.x, e.y], [e.x, y2], [x2, y2]];
}
export function compDraw(k, w, h) {
  const m = h / 2,
    c = ST.ctx,
    ln = (a, b, d, e) => {
      c.moveTo(a, b);
      c.lineTo(d, e);
    },
    ci = (x, y, r) => {
      c.moveTo(x + r, y);
      c.arc(x, y, r, 0, 7);
    },
    r = .38 * h;
  c.beginPath();
  let tx = '';
  if (k === 'dot') {
    c.arc(w / 2, m, Math.min(w, h) / 2, 0, 7);
    c.fill();
    return;
  }
  if (k === 'resistor') {
    ln(0, m, .2 * w, m);
    for (let i = 0; i <= 6; i++) c.lineTo(.2 * w + i * .1 * w, i % 6 ? m + (i % 2 ? -1 : 1) * .34 * h : m);
    ln(.8 * w, m, w, m);
  } else if (k === 'capacitor') {
    ln(0, m, .42 * w, m);
    ln(.58 * w, m, w, m);
    ln(.42 * w, .12 * h, .42 * w, .88 * h);
    ln(.58 * w, .12 * h, .58 * w, .88 * h);
  } else if (k === 'inductor') {
    ln(0, m, .2 * w, m);
    for (let i = 0; i < 4; i++) {
      const q = .075 * w,
        x = .2 * w + (i * 2 + 1) * q;
      c.moveTo(x - q, m);
      c.arc(x, m, q, Math.PI, 0);
    }
    ln(.8 * w, m, w, m);
  } else if (k === 'battery') {
    ln(0, m, .45 * w, m);
    ln(.55 * w, m, w, m);
    ln(.45 * w, .08 * h, .45 * w, .92 * h);
    ln(.55 * w, .3 * h, .55 * w, .7 * h);
  } else if (k === 'ac' || k === 'isrc' || k === 'lamp' || k === 'ammeter' || k === 'voltmeter') {
    ln(0, m, w / 2 - r, m);
    ln(w / 2 + r, m, w, m);
    ci(w / 2, m, r);
    if (k === 'ac') {
      c.moveTo(w / 2 - .6 * r, m);
      c.quadraticCurveTo(w / 2 - .3 * r, m - .9 * r, w / 2, m);
      c.quadraticCurveTo(w / 2 + .3 * r, m + .9 * r, w / 2 + .6 * r, m);
    }
    if (k === 'isrc') {
      ln(w / 2 - .5 * r, m, w / 2 + .5 * r, m);
      ln(w / 2 + .5 * r, m, w / 2 + .1 * r, m - .3 * r);
      ln(w / 2 + .5 * r, m, w / 2 + .1 * r, m + .3 * r);
    }
    if (k === 'lamp') {
      const d = .7 * r;
      ln(w / 2 - d, m - d, w / 2 + d, m + d);
      ln(w / 2 - d, m + d, w / 2 + d, m - d);
    }
    tx = k === 'ammeter' ? 'A' : k === 'voltmeter' ? 'V' : '';
  } else if (k === 'ground') {
    ln(w / 2, 0, w / 2, .45 * h);
    ln(w / 2 - .22 * w, .45 * h, w / 2 + .22 * w, .45 * h);
    ln(w / 2 - .14 * w, .68 * h, w / 2 + .14 * w, .68 * h);
    ln(w / 2 - .06 * w, .9 * h, w / 2 + .06 * w, .9 * h);
  } else if (k === 'diode' || k === 'led') {
    ln(0, m, .35 * w, m);
    ln(.65 * w, m, w, m);
    c.moveTo(.35 * w, m - .3 * h);
    c.lineTo(.35 * w, m + .3 * h);
    c.lineTo(.65 * w, m);
    c.closePath();
    ln(.65 * w, m - .3 * h, .65 * w, m + .3 * h);
    if (k === 'led') {
      ln(.45 * w, .12 * h, .6 * w, -.1 * h);
      ln(.55 * w, .2 * h, .7 * w, -.02 * h);
    }
  } else if (k === 'switch') {
    ln(0, m, .3 * w, m);
    ln(.7 * w, m, w, m);
    ci(.3 * w, m, 2.5);
    ci(.7 * w, m, 2.5);
    ln(.3 * w, m, .66 * w, m - .38 * h);
  } else if (k === 'npn') {
    ci(.5 * w, m, .46 * w);
    ln(0, m, .36 * w, m);
    ln(.36 * w, .25 * h, .36 * w, .75 * h);
    ln(.36 * w, .4 * h, .75 * w, .15 * h);
    ln(.75 * w, .15 * h, .75 * w, 0);
    ln(.36 * w, .6 * h, .75 * w, .85 * h);
    ln(.75 * w, .85 * h, .75 * w, h);
    ln(.75 * w, .85 * h, .61 * w, .83 * h);
    ln(.75 * w, .85 * h, .67 * w, .72 * h);
  } else if (k === 'opamp') {
    ln(.15 * w, .05 * h, .15 * w, .95 * h);
    ln(.15 * w, .05 * h, .85 * w, m);
    ln(.15 * w, .95 * h, .85 * w, m);
    ln(0, 14, .15 * w, 14);
    ln(0, h - 14, .15 * w, h - 14);
    ln(.85 * w, m, w, m);
    tx = 'op';
  }
  c.stroke();
  if (tx === 'A' || tx === 'V') {
    c.save();
    c.fillStyle = c.strokeStyle;
    c.font = '600 ' + r * 1.1 + 'px Figtree,sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(tx, w / 2, m + 1);
    c.restore();
  }
  if (tx === 'op') {
    c.save();
    c.fillStyle = c.strokeStyle;
    c.font = '600 12px Figtree,sans-serif';
    c.textBaseline = 'middle';
    c.fillText('+', .19 * w, 14);
    c.fillText('−', .19 * w, h - 14);
    c.restore();
  }
}
export function compPlace(x, y) {
  const d = CK[ST.ck],
    c = snp(x, y),
    n = P().els.filter(q => q.t === 'comp' && q.k === ST.ck).length + 1,
    w = d[2],
    h = d[3],
    id = uid(),
    q = cl([c[0] - w / 2, c[1] - h / 2]);
  P().els.push({
    id,
    t: 'comp',
    k: ST.ck,
    x: q[0],
    y: q[1],
    w,
    h,
    stroke: ST.stroke,
    fill: 'none',
    sw: ST.sw,
    seed: 1,
    lbl: d[1] ? d[1] + n : ''
  });
  selIds([id]);
  commit();
  props();
}
export function openLabel(e) {
  const v = P().v,
    i = document.createElement('input');
  i.value = e.lbl || '';
  i.placeholder = 'R1 10kΩ';
  i.style.cssText = `position:absolute;left:${(e.x + e.w / 2) * v.z + v.x + OX() * v.z - 60}px;top:${e.y * v.z + v.y - 36}px;width:120px;text-align:center;font:600 14px Figtree,sans-serif;background:var(--panel);color:var(--ink);border:1px solid var(--acc);border-radius:6px;padding:3px;z-index:6`;
  $('#main').appendChild(i);
  ST.ed = i;
  setTimeout(() => {
    i.focus();
    i.select();
  }, 0);
  const done = () => {
    if (ST.ed !== i) return;
    ST.ed = null;
    e.lbl = i.value.trim();
    i.remove();
    commit();
    props();
  };
  i.addEventListener('blur', done);
  i.addEventListener('keydown', k => {
    if (k.key === 'Enter' || k.key === 'Escape') i.blur();
    k.stopPropagation();
  });
}
export function togglePal() {
  const h = $('#cpal');
  h.hidden = !h.hidden;
  if (h.hidden) return;
  ST.INK = css('--ink');
  h.innerHTML = Object.keys(CK).map(k => `<button data-ck="${k}" title="${CK[k][0]}" aria-label="${CK[k][0]}"><canvas width="128" height="76"></canvas><small>${CK[k][0]}</small></button>`).join('');
  [...h.querySelectorAll('button')].forEach(b => {
    const k = b.dataset.ck,
      w = CK[k][2],
      hh = CK[k][3],
      g = b.firstChild.getContext('2d'),
      s = Math.min(108 / w, 56 / hh),
      old = ST.ctx;
    ST.ctx = g;
    g.setTransform(s, 0, 0, s, (128 - w * s) / 2, (66 - hh * s) / 2);
    g.lineWidth = 2.4 / s;
    g.strokeStyle = g.fillStyle = ST.INK;
    g.lineCap = g.lineJoin = 'round';
    compDraw(k, w, hh);
    ST.ctx = old;
  });
}
$('#cpal').onclick = e => {
  const b = e.target.closest('[data-ck]');
  if (!b) return;
  ST.ck = b.dataset.ck;
  $('#cpal').hidden = true;
  setTool('comp');
};
