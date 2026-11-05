import { P, ST } from './state.js';
import { $, cv, esc, uid } from './util.js';
import { doSave, save, saveBtn } from './cloud.js';
import { BG, CC, FF, FSOK, resize } from './env.js';
import { OX, commit, draw, fitA4, spreadOf, tfit, undo } from './render.js';
import { nbOf } from './notebooks.js';
import { ALN, ahHTML, align, cur, dssHTML, dupe, fitAll, selIds, union, zord } from './edit.js';
import { togglePal } from './circuit.js';
import { TBB, linkEd, tbl } from './objects.js';
import { toggleFS } from './platform.js';
import { togglePanel } from './voice.js';
import { I } from './icons.js';
import { codeFit } from './code.js';
import { LANGS } from './highlight.js';
import { side } from './sidebar.js';
import { exportPNG } from './edit.js';
import { exportBookPDF, exportPagePDF, openPalette, pageHistory } from './palette.js';

/* ---------- tool definitions ---------- */
const SHAPES = [['rect', 'square', 'Rectangle (R)'], ['diamond', 'diamond', 'Diamond (D)'], ['ellipse', 'circle', 'Ellipse (O)'], ['arrow', 'arrowUpRight', 'Arrow (A)'], ['curve', 'arrowCurveRight', 'Curved arrow (C)'], ['line', 'line', 'Line (L)']];
const MORE = [['eraser', 'eraser', 'Eraser (E)'], ['hand', 'handStop', 'Pan (H)'], ['math', 'mathFunction', 'Formula (M)'], ['img', 'photo', 'Image'], ['table', 'table', 'Table']];
const CIRC = [['wire', 'bolt', 'Wire (orthogonal)'], ['cpal', 'bolt', 'Circuit components']];
const SC = ['auto', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];
const FC = ['none', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99'];
const PRESETS = { h1: 48, h2: 36, h3: 28, body: 24 };
const SIZABLE = ['rect', 'diamond', 'ellipse', 'img', 'math', 'table', 'comp'];
const KEEP_RATIO = ['img', 'math'];

ST.shape = ST.shape || 'rect';
ST.panel = false;
try {
  ST.recent = JSON.parse(localStorage.getItem('sketchbooks-recent')) || [];
} catch (e) {
  ST.recent = [];
}

const ib = (icon, label, attrs = '', on = false) => `<button class="ib${on ? ' on' : ''}" ${attrs} title="${label}" aria-label="${label}">${I[icon]}</button>`;
const hex = (c, d) => /^#[0-9a-f]{6}$/i.test(c || '') ? c : d;

export function closePops() {
  ['#toolpop', '#pgpop', '#bkpop'].forEach(s => $(s).hidden = true);
}

/* ---------- bottom tool bar ---------- */
function renderTools() {
  const t = ST.tool, circ = P().circ;
  const shape = SHAPES.find(x => x[0] === ST.shape) || SHAPES[0];
  const isShape = SHAPES.some(x => x[0] === t);
  const isMore = MORE.some(x => x[0] === t) || t === 'wire' || t === 'comp';
  $('#tools').innerHTML =
    ib('pointer', 'Select (V)', 'data-t="select" aria-pressed="' + (t === 'select') + '"', t === 'select') +
    ib('pencil', 'Draw (P)', 'data-t="free" aria-pressed="' + (t === 'free') + '"', t === 'free') +
    ib(shape[1], 'Shapes: ' + shape[2], 'data-g="shapes" aria-haspopup="true"', isShape) +
    ib('typography', 'Text (T)', 'data-t="text" aria-pressed="' + (t === 'text') + '"', t === 'text') +
    ib('code', 'Code block (K)', 'data-t="code" aria-pressed="' + (t === 'code') + '"', t === 'code') +
    ib('dots', circ ? 'More tools and circuits' : 'More tools', 'data-g="more" aria-haspopup="true"', isMore);
}
function openPop(g) {
  const pop = $('#toolpop');
  const list = g === 'shapes' ? SHAPES : MORE.concat(P().circ ? CIRC : []);
  const was = pop.dataset.g === g && !pop.hidden;
  closePops();
  if (was) return;
  pop.dataset.g = g;
  pop.innerHTML = list.map(x => ib(x[1], x[2], 'data-t="' + x[0] + '"', x[0] === ST.tool || (x[0] === 'cpal' && ST.tool === 'comp'))).join('');
  pop.hidden = false;
}
export function setTool(t) {
  ST.tool = t;
  if (SHAPES.some(x => x[0] === t)) ST.shape = t;
  cv.style.cursor = t === 'select' ? 'default' : t === 'hand' ? 'grab' : t === 'text' || t === 'code' ? 'text' : 'crosshair';
  closePops();
  renderTools();
  props();
}
function toolClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.g) return openPop(b.dataset.g);
  const t = b.dataset.t;
  if (!t) return;
  closePops();
  if (t === 'img') $('#imgf').click();else if (t === 'cpal') togglePal();else setTool(t);
}
$('#tools').onclick = toolClick;
$('#toolpop').onclick = toolClick;

/* ---------- properties: top bar, contextual bar, panel ---------- */
const swatch = (kind, c, cur_) => {
  const key = kind === 's' ? 'data-s' : 'data-f';
  const bg = c === 'auto' ? 'var(--ink)' : c === 'none' ? 'repeating-linear-gradient(45deg,var(--line) 0 3px,transparent 3px 6px)' : c;
  const name = (kind === 's' ? 'Stroke color ' : 'Fill ') + c;
  return `<button class="sw${cur_ === c ? ' on' : ''}" ${key}="${c}" aria-label="${name}" aria-pressed="${cur_ === c}" style="background:${bg}"></button>`;
};
const customColor = (kind, value, label) => `<label class="cc" title="${label}"><input type="color" data-cs="${kind}" value="${hex(value, '#000000')}" aria-label="${label}"></label>`;
const numField = (k, label, v, min, max, step = 1) => `<label class="nf"><span>${label}</span><input type="number" data-n="${k}" value="${Math.round(v * 100) / 100}" min="${min}" max="${max}" step="${step}" inputmode="decimal"></label>`;

function topHTML() {
  return ib('arrowBackUp', 'Undo (Ctrl+Z)', 'data-a="u"') + ib('arrowForwardUp', 'Redo', 'data-a="r"') +
    '<span class="sep"></span>' + ib('minus', 'Zoom out', 'data-a="zo"') + '<span id="zoomv" class="zv"></span>' + ib('plus', 'Zoom in', 'data-a="zi"') + ib('arrowsMaximize', 'Fit to content', 'data-a="fit"') +
    '<span class="sep"></span>' + saveBtn() + ib('settings', 'Page and app menu', 'data-a="menu" aria-haspopup="true"');
}
function ctxHTML(s) {
  const c = cur();
  const stroke = s ? s.stroke : ST.stroke;
  return SC.map(x => swatch('s', x, stroke)).join('') + customColor('stroke', stroke, 'Custom stroke color') + '<span class="sep"></span>' +
    ib('copy', 'Duplicate (Ctrl+D)', 'data-a="dup"') + ib(c.every(q => q.lk) ? 'lock' : 'lockOpen', 'Lock / unlock', 'data-a="lock"', c.every(q => q.lk)) + ib('trash', 'Delete', 'data-a="del"') +
    '<span class="sep"></span>' + ib('adjustments', 'All properties', 'data-a="panel"', ST.panel);
}
function recentRow(kind) {
  const key = kind === 's' ? 'data-s' : 'data-f';
  return ST.recent.length ? '<div class="rc">' + ST.recent.map(c => `<button class="sw" ${key}="${c}" aria-label="Recent color ${c}" style="background:${c}"></button>`).join('') + '</div>' : '';
}
function panelHTML(s) {
  const c = cur();
  const isText = s ? s.t === 'text' : ST.tool === 'text';
  const isCode = s ? s.t === 'code' : ST.tool === 'code';
  const sizable = s && SIZABLE.includes(s.t) && c.length === 1;
  const lineLike = s && ['arrow', 'curve', 'line', 'free', 'wire'].includes(s.t);
  const stroke = s ? s.stroke : ST.stroke, fill = s ? s.fill : ST.fill;
  const fs = s && s.t === 'text' ? s.fs || 24 : ST.tfs;
  let h = '<div class="ph"><b>' + (s ? s.t[0].toUpperCase() + s.t.slice(1) : 'Defaults for new objects') + '</b>' + ib('x', 'Close panel', 'data-a="panel"') + '</div>';
  if (sizable) h += '<div class="pr">' + numField('w', 'W', Math.abs(s.w), 2, 5000) + numField('h', 'H', Math.abs(s.h), 2, 5000) + '</div>';
  h += '<div class="pt">Stroke</div><div class="pr">' + SC.map(x => swatch('s', x, stroke)).join('') + customColor('stroke', stroke, 'Custom stroke color') + '</div>' + recentRow('s') +
    '<div class="pr">' + numField('sw', 'Width', s ? s.sw : ST.sw, 1, 40, 0.5) + [1, 2, 4].map(w => `<button class="b${(s ? s.sw : ST.sw) === w ? ' on' : ''}" data-w="${w}" aria-label="Line width ${w}">${w}</button>`).join('') + '</div>';
  if (!isText && !isCode && !(s && ['math', 'img'].includes(s.t))) {
    h += '<div class="pt">Fill</div><div class="pr">' + FC.map(x => swatch('f', x, fill)).join('') + customColor('fill', fill, 'Custom fill color') + '</div>' + recentRow('f');
  }
  if (!isText && !isCode && !(s && ['math', 'img', 'table', 'comp'].includes(s.t))) {
    h += '<div class="pt">Style</div><div class="pr"><label class="rgl" title="Sketchiness: 0 = clean, 3 = very messy">✎<input type="range" id="rgs" min="0" max="3" step="0.5" value="' + (s && s.rg != null ? s.rg : ST.rough) + '" aria-label="Sketchiness"></label>' + dssHTML(s) +
      ((s && (s.t === 'arrow' || s.t === 'curve')) || ST.tool === 'arrow' || ST.tool === 'curve' ? ahHTML(s) : '') + '</div>';
  }
  if (isCode) {
    h += '<div class="pt">Code</div><div class="pr">' + numField('fs', 'Size px', s ? s.fs || 18 : 18, 8, 120) + '<select id="cls" title="Language" aria-label="Language">' + Object.keys(LANGS).map(k => `<option value="${k}" ${((s && s.lang) || ST.clang) === k ? 'selected' : ''}>${LANGS[k][0]}</option>`).join('') + '</select></div>' +
      (s ? `<div class="pr"><label class="nf"><input type="checkbox" id="cln"${s.nums !== false ? ' checked' : ''}><span>Line numbers</span></label></div>` : '');
  }
  if (!isCode && (isText || !s)) {
    h += '<div class="pt">Text</div><div class="pr">' + [['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['body', 'Body']].map(x => `<button class="b${fs === PRESETS[x[0]] ? ' on' : ''}" data-ps="${x[0]}" aria-label="Text style ${x[1]}">${x[1]}</button>`).join('') + '</div>' +
      '<div class="pr">' + numField('fs', 'Size px', fs, 8, 300) + '<select id="ffs" title="Font" aria-label="Font">' + Object.keys(FF).map(k => `<option value="${k}" ${((s && s.t === 'text' ? s.ff : ST.tff) || 'hand') === k ? 'selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('') + '</select></div>';
  }
  if (c.length) {
    h += '<div class="pt">Arrange</div><div class="pr">' + ALN() + (c.some(q => q.t === 'comp') ? ib('rotateClockwise', 'Rotate 90°', 'data-a="rot"') : '') + (c.some(q => q.t === 'table') ? TBB : '') +
      ib('link', 'Add / edit link', 'data-a="link"') + ib(c.every(q => q.lk) ? 'lock' : 'lockOpen', 'Lock / unlock', 'data-a="lock"', c.every(q => q.lk)) +
      ib('copy', 'Duplicate (Ctrl+D)', 'data-a="dup"') + `<button class="b" data-a="fr" aria-label="Bring to front">Front</button><button class="b" data-a="bk" aria-label="Send to back">Back</button>` + ib('trash', 'Delete', 'data-a="del"') + '</div>';
  }
  return h;
}
export function props() {
  const s = P().els.find(e => e.id === ST.sel);
  const c = cur();
  $('#topr').innerHTML = topHTML();
  const ctx = $('#ctx');
  ctx.innerHTML = c.length ? ctxHTML(s) : '';
  ctx.dataset.on = c.length ? '1' : '';
  ctxW = 0;
  const pn = $('#panel');
  pn.hidden = !ST.panel;
  if (ST.panel) pn.innerHTML = panelHTML(s);
  placeCtx();
  draw();
}

// Keeps the contextual bar next to the selection (called on every redraw, so it must stay cheap).
let ctxW = 0;
export function placeCtx() {
  const el = $('#ctx'), c = el.dataset.on ? cur() : [];
  const busy = ST.act && ['move', 'gmove', 'rs', 'box', 'draw', 'pan', 'erase'].includes(ST.act.k);
  if (!c.length || ST.tool !== 'select' || ST.ed || busy) {
    el.hidden = true;
    return;
  }
  const v = P().v, U = union(c);
  el.hidden = false;
  if (!ctxW) ctxW = el.offsetWidth;
  const x = U.x * v.z + v.x + OX() * v.z, y = U.y * v.z + v.y;
  const W = cv.clientWidth, H = cv.clientHeight;
  const left = Math.max(8, Math.min(W - ctxW - 8, x + U.w * v.z / 2 - ctxW / 2));
  let top = y - 68;
  if (top < 64) top = Math.min(H - 130, y + U.h * v.z + 12);
  el.style.left = left + 'px';
  el.style.top = Math.max(64, top) + 'px';
}

/* numbers and colors typed or picked in the bar/panel */
function remember(c) {
  ST.recent = [c, ...ST.recent.filter(x => x !== c)].slice(0, 8);
  try {
    localStorage.setItem('sketchbooks-recent', JSON.stringify(ST.recent));
  } catch (e) {}
}
function setColor(kind, v) {
  if (kind === 'stroke') {
    ST.stroke = v;
    cur().forEach(q => q.stroke = v);
  } else if (kind === 'fill') {
    ST.fill = v;
    cur().forEach(q => q.fill = v);
  } else if (kind === 'bg') P().bg = v;
  draw();
}
function setNum(k, v) {
  if (!(v > 0)) return false;
  const c = cur();
  if (k === 'sw') {
    ST.sw = v;
    c.forEach(q => q.sw = v);
  } else if (k === 'fs') {
    ST.tfs = v;
    c.forEach(q => {
      if (q.t === 'text') {
        q.fs = v;
        tfit(q);
      } else if (q.t === 'code') {
        q.fs = v;
        codeFit(q);
      }
    });
  } else if (k === 'w' || k === 'h') {
    const q = c[0];
    if (!q || c.length !== 1) return false;
    if (KEEP_RATIO.includes(q.t) && q.w && q.h) {
      const r = Math.abs(q.h / q.w);
      if (k === 'w') {
        q.w = Math.sign(q.w) * v;
        q.h = Math.sign(q.h) * v * r;
      } else {
        q.h = Math.sign(q.h) * v;
        q.w = Math.sign(q.w) * v / r;
      }
    } else q[k] = (Math.sign(q[k]) || 1) * v;
  }
  draw();
  return c.length > 0;
}
const live = e => {
  const t = e.target;
  if (t.dataset.cs) setColor(t.dataset.cs, t.value);
  else if (t.dataset.n) setNum(t.dataset.n, +t.value);
  else if (t.id === 'rgs') {
    ST.rough = +t.value;
    const s = P().els.find(q => q.id === ST.sel);
    if (s && !['text', 'math', 'free'].includes(s.t)) {
      s.rg = ST.rough;
      draw();
    }
  }
};
const settle = e => {
  const t = e.target;
  if (t.dataset.cs) {
    remember(t.value);
    if (t.dataset.cs === 'bg') save();else if (cur().length) commit();
    props();
  } else if (t.dataset.n) {
    if (setNum(t.dataset.n, +t.value)) commit();
    props();
  } else if (t.id === 'rgs' && P().els.find(q => q.id === ST.sel)) commit();
};
['#ctx', '#panel', '#pgpop'].forEach(s => {
  $(s).addEventListener('input', live);
  $(s).addEventListener('change', settle);
});

export function toggleTheme() {
  const r = document.documentElement,
    dk = getComputedStyle(r).getPropertyValue('--bg').trim() === '#14171d';
  r.dataset.theme = dk ? 'light' : 'dark';
  for (const k in CC) delete CC[k];
}
function propsClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset,
    v = P().v;
  if (d.s) {
    ST.stroke = d.s;
    cur().forEach(q => q.stroke = d.s);
  }
  if (d.f) {
    ST.fill = d.f;
    cur().forEach(q => q.fill = d.f);
  }
  if (d.w) {
    ST.sw = +d.w;
    cur().forEach(q => q.sw = ST.sw);
  }
  if (d.ps) {
    setNum('fs', PRESETS[d.ps]);
    if (cur().length) commit();
    props();
    return;
  }
  if (d.a === 'panel') {
    ST.panel = !ST.panel;
    closePops();
    props();
    return;
  }
  if (d.a === 'menu') {
    pgpop();
    return;
  }
  if (d.a === 'u') undo(-1);
  if (d.a === 'r') undo(1);
  if (d.a === 'del') del();
  if (d.a === 'zi' || d.a === 'zo') {
    const z = Math.max(.2, Math.min(4, v.z * (d.a === 'zi' ? 1.2 : 1 / 1.2))),
      cx = cv.clientWidth / 2,
      cy = cv.clientHeight / 2;
    v.x = cx - (cx - v.x) * z / v.z;
    v.y = cy - (cy - v.y) * z / v.z;
    v.z = z;
    save();
  }
  if (d.a === 'th') toggleTheme();
  if (d.a === 'palette') {
    closePops();
    openPalette();
    return;
  }
  if (d.a === 'png') exportPNG();
  if (d.a === 'pdf') exportPagePDF();
  if (d.a === 'pdfbook') exportBookPDF();
  if (d.a === 'hist') {
    closePops();
    pageHistory();
    return;
  }
  if (d.a === 'sn') ST.snap = !ST.snap;
  if (d.a === 'books') {
    const n = nbOf(ST.S.cur),
      h = $('#bkpop');
    closePops();
    h.innerHTML = (n.books || []).map(b => `<button class="b" data-bk="${b.id}">📖 ${esc(b.title)}</button>`).join('') || '<small>No linked books on this notebook yet.</small>';
    h.hidden = false;
    return;
  }
  if (d.a === 'fs') {
    toggleFS();
    return;
  }
  if (d.a === 'rec') {
    closePops();
    togglePanel();
    return;
  }
  if (d.tb) {
    tbl(d.tb);
    return;
  }
  if (d.a === 'link') {
    linkEd();
    return;
  }
  if (d.a === 'save') {
    doSave();
    return;
  }
  if (d.a === 'rot') {
    cur().forEach(q => {
      if (q.t === 'comp') q.r = ((q.r || 0) + Math.PI / 2) % (Math.PI * 2);
    });
    commit();
    props();
    return;
  }
  if (d.al) {
    align(d.al);
    return;
  }
  if (d.a === 'lock') {
    const c = cur(),
      lk = !c.every(q => q.lk);
    c.forEach(q => q.lk = lk || undefined);
    commit();
    props();
    return;
  }
  if (d.a === 'fit') {
    fitAll();
    props();
    return;
  }
  if (d.a === 'dup') {
    dupe();
    return;
  }
  if (d.a === 'fr' || d.a === 'bk') {
    zord(d.a === 'fr' ? 1 : -1);
    return;
  }
  if ((d.s || d.f || d.w) && cur().length) commit();
  if (d.s && d.s !== 'auto') remember(d.s);
  if (d.f && d.f !== 'none') remember(d.f);
  props();
}
['#topr', '#ctx', '#panel'].forEach(s => $(s).onclick = propsClick);

/* ---------- page and app menu ---------- */
const mb = (label, attrs, on) => `<button class="b${on ? ' on' : ''}" ${attrs}>${label}</button>`;
function pgpop() {
  const p = P(),
    h = $('#pgpop'),
    was = !h.hidden;
  closePops();
  if (was) return;
  h.innerHTML = '<b>Page</b><div>' + mb('Commands (Ctrl+K)', 'data-a="palette"') + mb('Page history', 'data-a="hist"') + mb('Export PNG', 'data-a="png"') + mb('Export PDF', 'data-a="pdf"') + mb('Notebook PDF', 'data-a="pdfbook"') + '</div><b>App</b><div>' + mb('Snapping', 'data-a="sn"', ST.snap) + mb('Light / dark', 'data-a="th"') + (FSOK ? mb('Full screen', 'data-a="fs"') : '') + mb('Linked books', 'data-a="books"') + mb('Voice notes', 'data-a="rec"') +
    '</div><b>Circuit tools</b><div>' + [['0', 'Off'], ['1', 'On']].map(x => mb(x[1], 'data-pc="' + x[0] + '"', (p.circ ? '1' : '0') === x[0])).join('') +
    '</div><b>Sheet</b><div>' + [['inf', 'Infinite'], ['a4', 'A4 vertical'], ['a4x2', 'Two A4 pages']].map(x => mb(x[1], 'data-pm="' + x[0] + '"', x[0] === 'a4x2' ? !!spreadOf(p) : !spreadOf(p) && (p.mode || 'inf') === x[0])).join('') +
    '</div><b>Background</b><div>' + BG.map(c => `<button class="sw ${(p.bg || 'auto') === c ? 'on' : ''}" data-pb="${c}" aria-label="Page background ${c}" style="background:${c === 'auto' ? 'var(--bg)' : c}"></button>`).join('') + customColor('bg', p.bg, 'Custom page background') +
    '</div><b>Pattern</b><div>' + [['none', 'Blank'], ['dots', 'Dots'], ['lines', 'Lines'], ['squares', 'Squares']].map(x => mb(x[1], 'data-pp="' + x[0] + '"', (p.pat || 'dots') === x[0])).join('') +
    '</div><b>Performance</b><div>' + [['', 'Auto'], ['1', 'Lite'], ['0', 'Full']].map(x => mb(x[1], 'data-pf="' + x[0] + '"', ST.PERF === x[0])).join('') + '</div>';
  h.hidden = false;
}
$('#pgpop').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.a) return propsClick(e);
  const p = P();
  if (b.dataset.pf !== undefined) {
    ST.PERF = b.dataset.pf;
    try {
      ST.PERF ? localStorage.setItem('sketchbooks-lite', ST.PERF) : localStorage.removeItem('sketchbooks-lite');
    } catch (e) {}
    resize();
  }
  if (b.dataset.pc !== undefined) {
    p.circ = b.dataset.pc === '1' || undefined;
    if (!p.circ && (ST.tool === 'comp' || ST.tool === 'wire')) ST.tool = 'select';
    $('#cpal').hidden = true;
    setTool(ST.tool);
  }
  if (b.dataset.pm === 'a4x2') enableSpread(p);else if (b.dataset.pm) {
    p.mode = b.dataset.pm;
    p.spread = false;
    if (p.mode === 'a4') fitA4(p);
  }
  if (b.dataset.pb) p.bg = b.dataset.pb;
  if (b.dataset.pp) p.pat = b.dataset.pp;
  save();
  pgpop();
  pgpop();
  draw();
  props();
};
// Shows this page next to the following one; a blank A4 page is inserted when there is none to pair with.
function enableSpread(p) {
  if (spreadOf(p)) return;
  const nb = nbOf(p.id), i = nb.pages.indexOf(p);
  let nx = nb.pages[i + 1];
  p.mode = 'a4';
  if (!nx || nx.mode !== 'a4') {
    nx = { id: uid(), name: 'Page ' + (nb.pages.length + 1), els: [], v: p.v, mode: 'a4', pat: p.pat, bg: p.bg };
    nb.pages.splice(i + 1, 0, nx);
  }
  p.spread = true;
  fitA4(p);
  side();
}
function del() {
  const ids = ST.msel.length ? ST.msel : ST.sel ? [ST.sel] : [];
  if (!ids.length) return;
  P().els = P().els.filter(e => !ids.includes(e.id));
  ST.sel = null;
  ST.msel = [];
  commit();
  props();
}

/* ---------- keyboard ---------- */
addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.code === 'Space') {
    ST.space = true;
    e.preventDefault();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo(e.shiftKey ? 1 : -1);
    return;
  }
  const mk = e.ctrlKey || e.metaKey,
    k = e.key.toLowerCase();
  if (mk && k === 'a') {
    e.preventDefault();
    selIds(P().els.map(q => q.id));
    draw();
    props();
    return;
  }
  if (mk && (k === 'c' || k === 'x' || k === 'd')) {
    e.preventDefault();
    const c = cur();
    if (!c.length) return;
    if (k === 'd') {
      dupe();
      return;
    }
    window._clip = JSON.stringify(c);
    if (k === 'x') del();
    return;
  }
  if (e.key === 'Escape') {
    $('#cpal').hidden = true;
    closePops();
    if (ST.panel) ST.panel = false;
    ST.sel = null;
    ST.msel = [];
    if (ST.tool === 'comp' || ST.tool === 'wire') setTool('select');else {
      draw();
      props();
    }
    return;
  }
  if (e.key === ']' || e.key === '[') {
    zord(e.key === ']' ? 1 : -1);
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    del();
    return;
  }
  const m = {
    v: 'select',
    r: 'rect',
    d: 'diamond',
    o: 'ellipse',
    a: 'arrow',
    l: 'line',
    p: 'free',
    t: 'text',
    k: 'code',
    m: 'math',
    c: 'curve',
    e: 'eraser',
    h: 'hand'
  }[k];
  if (m && !mk) {
    e.preventDefault();
    setTool(m);
  }
});
addEventListener('keyup', e => {
  if (e.code === 'Space') ST.space = false;
});
