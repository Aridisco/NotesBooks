import { P, ST } from './state.js';
import { $, cv, esc, uid } from './util.js';
import { doSave, save, saveBtn } from './cloud.js';
import { BG, CC, FF, FSOK, THC, resize } from './env.js';
import { OX, commit, draw, fitA4, spreadOf, tfit, undo } from './render.js';
import { endRename, load, nbOf, render } from './notebooks.js';
import { rendererName, setRenderer } from './scene.js';
import { ALN, ahHTML, align, cur, dssHTML, dupe, fitAll, selIds, union, zord } from './edit.js';
import { togglePal } from './circuit.js';
import { linkEd, tableMenuHTML, tbl } from './objects.js';
import { toggleFS } from './platform.js';
import { togglePanel } from './voice.js';
import { I } from './icons.js';
import { codeFit } from './code.js';
import { LANGS } from './highlight.js';
import { exportPNG } from './edit.js';
import { exportBookPDF, exportPagePDF, openPalette, pageHistory } from './palette.js';

/* ---------- tool definitions ---------- */
const SHAPES = [['rect', 'square', 'Rectangle (R)'], ['diamond', 'diamond', 'Diamond (D)'], ['ellipse', 'circle', 'Ellipse (O)'], ['poly', 'hexagon', 'Polygon (G)'], ['arrow', 'arrowUpRight', 'Arrow (A)'], ['curve', 'arrowCurveRight', 'Curved arrow (C)'], ['line', 'line', 'Line (L)']];
const MORE = [['eraser', 'eraser', 'Eraser (E)'], ['hand', 'handStop', 'Pan (H)'], ['math', 'mathFunction', 'Formula and graph (M)'], ['img', 'photo', 'Image'], ['table', 'table', 'Table']];
const CIRC = [['wire', 'bolt', 'Wire (orthogonal)'], ['cpal', 'bolt', 'Circuit components']];
const SC = ['auto', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#74c0fc', '#c2255c', '#7048e8'];
const FC = ['none', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99'];
const PRESETS = { h1: 48, h2: 36, h3: 28, body: 24 };
const SIZABLE = ['rect', 'diamond', 'ellipse', 'poly', 'img', 'math', 'table', 'comp', 'code', 'graph'];
const KEEP_RATIO = ['img', 'math'];
// Tools on the bottom bar, in order; select and "more" are always shown, the rest can be hidden by the user.
const BAR = [['select', 'pointer', 'Select (V)'], ['free', 'pencil', 'Pen (P)'], ['hl', 'highlight', 'Highlighter (I)'], ['shapes'], ['text', 'typography', 'Text (T)'], ['code', 'code', 'Code block (K)'], ['more']];
// Each drawing tool keeps its own editable colors and sizes, like Notability's per-tool favorites.
const DEF_TB = () => ({
  hidden: [],
  g: {
    pen: { cols: SC.slice(), sizes: [1, 2, 4], c: 'auto', w: 2 },
    hl: { cols: ['#ffd43b', '#69db7c', '#74c0fc', '#f783ac', '#ffa94d'], sizes: [12, 20, 30], c: '#ffd43b', w: 20 },
    shape: { cols: SC.slice(), sizes: [1, 2, 4], c: 'auto', w: 2 },
    text: { cols: ['auto', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#7048e8'], c: 'auto' }
  }
});
let TB = DEF_TB();
try {
  const t = JSON.parse(localStorage.getItem('sketchbooks-toolbar'));
  if (t && t.g) TB = { hidden: t.hidden || [], g: Object.assign(DEF_TB().g, t.g) };
} catch (e) {}
const saveTB = () => {
  try {
    localStorage.setItem('sketchbooks-toolbar', JSON.stringify(TB));
  } catch (e) {}
};
const grp = t => t === 'free' ? 'pen' : t === 'hl' ? 'hl' : t === 'text' ? 'text' : t === 'code' ? 'code' : SHAPES.some(x => x[0] === t) ? 'shape' : null;

ST.shape = ST.shape || 'rect';
ST.sides = ST.sides || 5;
ST.cfs = ST.cfs || 18;
ST.panel = false;
ST.tbEdit = false;
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

/* ---------- bottom tool bar: options row (changes with the tool) + tools row ---------- */
const dot = (w, on, i) => `<button class="wd${on ? ' on' : ''}" data-w="${w}" ${i != null ? `data-wi="${i}"` : ''} aria-label="Size ${w}" aria-pressed="${on}"><i style="width:${Math.min(26, 3 + w * (w > 6 ? .8 : 3))}px;height:${Math.min(26, 3 + w * (w > 6 ? .8 : 3))}px"></i></button>`;
let lastGrp = null;
function optionsRow() {
  const g = grp(ST.tool), top = 'trow top' + (g !== lastGrp ? ' anim' : '');
  lastGrp = g;
  if (!g) return '';
  const G = TB.g[g], ed = ST.tbEdit;
  if (g === 'code') return '<div class="' + top + '"><span class="tl">Code</span><select id="tcl" aria-label="Language">' + Object.keys(LANGS).map(k => `<option value="${k}"${(ST.clang || 'js') === k ? ' selected' : ''}>${LANGS[k][0]}</option>`).join('') + '</select><span class="sep"></span>' +
    [[14, 'S'], [18, 'M'], [24, 'L']].map(x => `<button class="b${ST.cfs === x[0] ? ' on' : ''}" data-cfs="${x[0]}" aria-label="Code size ${x[1]}" aria-pressed="${ST.cfs === x[0]}">${x[1]}</button>`).join('') + '</div>';
  let h = '<div class="' + top + '">';
  // colors: tap to pick, or edit them in place while customizing
  h += G.cols.map((c, i) => ed ? `<label class="sw edit" style="background:${c === 'auto' ? 'var(--ink)' : c}" title="Change color"><input type="color" data-ec="${i}" value="${hex(c, '#1c2230')}" aria-label="Change color ${i + 1}"></label>` : swatch('s', c, G.c)).join('');
  if (!ed) h += customColor('stroke', G.c, 'Custom color');
  if (g === 'text') {
    h += '<span class="sep"></span>' + [['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['body', 'Aa']].map(x => `<button class="b${ST.tfs === PRESETS[x[0]] ? ' on' : ''}" data-ps="${x[0]}" aria-label="Text size ${x[0]}" aria-pressed="${ST.tfs === PRESETS[x[0]]}">${x[1]}</button>`).join('') +
      '<select id="tff" aria-label="Font">' + Object.keys(FF).map(k => `<option value="${k}" ${ST.tff === k ? 'selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('') + '</select>';
  } else {
    h += '<span class="sep"></span>' + G.sizes.map((w, i) => ed ? `<label class="nf sm"><input type="number" data-ew="${i}" value="${w}" min="0.5" max="60" step="0.5" inputmode="decimal" aria-label="Size ${i + 1}"></label>` : dot(w, G.w === w)).join('');
    if (ST.tool === 'poly' && !ed) h += '<span class="sep"></span><span class="step" role="group" aria-label="Polygon sides"><button class="b" data-sd="-1" aria-label="Fewer sides">−</button><b>' + ST.sides + '</b><small>sides</small><button class="b" data-sd="1" aria-label="More sides">+</button></span>';
  }
  h += '<span class="sep"></span>' + (ed ? ib('refresh', 'Reset colors and sizes', 'data-tbr="1"') + ib('check', 'Done customizing', 'data-tbe="1"', true) : ib('palette', 'Customize this bar', 'data-tbe="1"'));
  return h + '</div>';
}
function renderTools() {
  const t = ST.tool, circ = P().circ, ed = ST.tbEdit;
  const shape = SHAPES.find(x => x[0] === ST.shape) || SHAPES[0];
  const isShape = SHAPES.some(x => x[0] === t);
  const isMore = MORE.some(x => x[0] === t) || t === 'wire' || t === 'comp';
  const tools = BAR.map(([k, icon, label]) => {
    if (k === 'more') return ib('dots', circ ? 'More tools and circuits' : 'More tools', 'data-g="more" aria-haspopup="true"', isMore);
    const off = TB.hidden.includes(k);
    if (off && !ed) return '';
    const btn = k === 'shapes' ? ib(shape[1], 'Shapes: ' + shape[2], (ed ? 'data-hide="shapes"' : 'data-g="shapes" aria-haspopup="true"'), isShape && !ed) :
      ib(icon, label, ed && k !== 'select' ? `data-hide="${k}" aria-pressed="${!off}"` : `data-t="${k}" aria-pressed="${t === k}"`, t === k && !ed);
    return off ? btn.replace('class="ib', 'class="ib hid') : btn;
  }).join('');
  $('#tools').innerHTML = optionsRow() + '<div class="trow">' + tools + '</div>' + (ed ? '<div class="trow hint">Tap a color or size to change it · tap a tool to show or hide it</div>' : '');
}
function openPop(g) {
  const pop = $('#toolpop');
  const list = g === 'shapes' ? SHAPES : MORE.concat(P().circ ? CIRC : []);
  const was = pop.dataset.g === g && !pop.hidden;
  closePops();
  if (was) return;
  pop.dataset.g = g;
  pop.innerHTML = list.map(x => ib(x[1], x[2], 'data-t="' + x[0] + '"', x[0] === ST.tool || (x[0] === 'cpal' && ST.tool === 'comp'))).join('');
  pop.style.bottom = $('#main').getBoundingClientRect().bottom - $('#tools').getBoundingClientRect().top + 10 + 'px';
  pop.hidden = false;
}
export function setTool(t) {
  ST.tool = t;
  if (SHAPES.some(x => x[0] === t)) ST.shape = t;
  // each drawing tool brings back its own color and size
  const G = TB.g[grp(t)];
  if (G && G.c) ST.stroke = G.c;
  if (G && G.w) ST.sw = G.w;
  cv.style.cursor = t === 'select' ? 'default' : t === 'hand' ? 'grab' : t === 'text' || t === 'code' ? 'text' : 'crosshair';
  closePops();
  props();
}
function toolClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset, G = TB.g[grp(ST.tool)];
  if (d.tbe) {
    ST.tbEdit = !ST.tbEdit;
    return renderTools();
  }
  if (d.tbr) {
    const def = DEF_TB().g[grp(ST.tool)];
    if (def) TB.g[grp(ST.tool)] = def;
    saveTB();
    return setTool(ST.tool);
  }
  if (d.hide) {
    TB.hidden = TB.hidden.includes(d.hide) ? TB.hidden.filter(x => x !== d.hide) : [...TB.hidden, d.hide];
    saveTB();
    return renderTools();
  }
  if (d.sd) {
    ST.sides = Math.max(3, Math.min(12, ST.sides + +d.sd));
    return renderTools();
  }
  if (d.cfs) {
    ST.cfs = +d.cfs;
    return renderTools();
  }
  if (d.s || d.w) {
    if (G && d.s) G.c = d.s;
    if (G && d.w) G.w = +d.w;
    saveTB();
    return propsClick(e);
  }
  if (d.ps) return propsClick(e);
  if (d.g) return openPop(d.g);
  const t = d.t;
  if (!t) return;
  closePops();
  if (t === 'img') $('#imgf').click();else if (t === 'cpal') togglePal();else setTool(t);
}
$('#tools').onclick = toolClick;
$('#toolpop').onclick = toolClick;
// editing a favorite color or size while customizing, plus the code language and text font pickers
$('#tools').addEventListener('change', e => {
  const t = e.target, G = TB.g[grp(ST.tool)];
  if (t.id === 'tcl') ST.clang = t.value;
  if (t.id === 'tff') ST.tff = t.value;
  if (t.dataset.ec && G) {
    const i = +t.dataset.ec, was = G.cols[i];
    G.cols[i] = t.value;
    if (G.c === was) G.c = ST.stroke = t.value;
    saveTB();
  }
  if (t.dataset.ew && G && +t.value > 0) {
    const i = +t.dataset.ew, was = G.sizes[i];
    G.sizes[i] = +t.value;
    if (G.w === was) G.w = ST.sw = +t.value;
    saveTB();
  }
  if (t.dataset.cs && G) {
    G.c = t.value;
    saveTB();
  }
  renderTools();
});
// Tapping anywhere outside an open menu closes it.
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#pgpop,#toolpop,#bkpop,[aria-haspopup]')) closePops();
}, true);

/* ---------- properties: top bar, contextual bar, panel ---------- */
const swatch = (kind, c, cur_) => {
  const key = kind === 's' ? 'data-s' : 'data-f';
  const bg = c === 'auto' ? 'var(--ink)' : c === 'none' ? 'repeating-linear-gradient(45deg,var(--line) 0 3px,transparent 3px 6px)' : c;
  const name = (kind === 's' ? 'Stroke color ' : 'Fill ') + c;
  return `<button class="sw${cur_ === c ? ' on' : ''}" ${key}="${c}" aria-label="${name}" aria-pressed="${cur_ === c}" style="background:${bg}"></button>`;
};
const customColor = (kind, value, label) => `<label class="cc" title="${label}"><input type="color" data-cs="${kind}" value="${hex(value, '#000000')}" aria-label="${label}"></label>`;
const numField = (k, label, v, min, max, step = 1) => `<label class="nf"><span>${label}</span><input type="number" data-n="${k}" value="${Math.round(v * 100) / 100}" min="${min}" max="${max}" step="${step}" inputmode="decimal"></label>`;

// Page navigation bar: back to the notebook, page title and switcher, then history, view and menus.
function topHTML() {
  const p = P(), n = nbOf(p.id), i = n.pages.indexOf(p);
  const title = ST.ren === p.id ? `<input class="ptitle" data-r="${p.id}" value="${esc(p.name)}" aria-label="Page name">` : `<button class="ptitle" data-a="ren" title="Rename page">${esc(p.name)}</button>`;
  return `<div class="nl"><button class="back" data-a="back" title="Back to ${esc(n.name)}">${I.chevronLeft}<span>${esc(n.name)}</span></button></div>` +
    `<div class="nc">${title}<span class="pager">` + ib('chevronLeft', 'Previous page (Page Up)', 'data-a="pp"' + (i ? '' : ' disabled')) + `<span class="pgn" aria-live="polite">${i + 1} / ${n.pages.length}</span>` + ib('chevronRight', 'Next page (Page Down)', 'data-a="pn"' + (i < n.pages.length - 1 ? '' : ' disabled')) + ib('filePlus', 'New page', 'data-a="np"') + '</span></div>' +
    '<div class="nr">' + ib('arrowBackUp', 'Undo (Ctrl+Z)', 'data-a="u"') + ib('arrowForwardUp', 'Redo (Ctrl+Shift+Z)', 'data-a="r"') +
    '<span class="sep"></span><span class="zoom">' + ib('minus', 'Zoom out', 'data-a="zo"') + '<button id="zoomv" class="zv" data-a="fit" title="Fit to content" aria-label="Zoom level, tap to fit"></button>' + ib('plus', 'Zoom in', 'data-a="zi"') + '</span>' +
    '<span class="sep"></span>' + (ST.cdb ? saveBtn() : '') + ib('share', 'Export and share', 'data-a="m-share" aria-haspopup="true"') + ib('fileSettings', 'Paper: sheet, background, pattern', 'data-a="m-page" aria-haspopup="true"') + ib('dotsVertical', 'More: tools, settings, appearance', 'data-a="m-more" aria-haspopup="true"') + '</div>';
}
function ctxHTML(s) {
  const c = cur();
  const stroke = s ? s.stroke : ST.stroke;
  const one = c.length === 1 ? c[0] : null;
  return (one && one.t === 'table' ? ib('tableOptions', 'Table: rows, columns, cells', 'data-a="m-table" aria-haspopup="true"') + '<span class="sep"></span>' : '') +
    (one && one.t === 'poly' ? numField('n', 'Sides', one.n || 5, 3, 12) + '<span class="sep"></span>' : '') +
    SC.map(x => swatch('s', x, stroke)).join('') + customColor('stroke', stroke, 'Custom stroke color') + '<span class="sep"></span>' +
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
    h += '<div class="pt">Arrange</div><div class="pr">' + ALN() + (c.some(q => q.t === 'comp') ? ib('rotateClockwise', 'Rotate 90°', 'data-a="rot"') : '') + 
      ib('link', 'Add / edit link', 'data-a="link"') + ib(c.every(q => q.lk) ? 'lock' : 'lockOpen', 'Lock / unlock', 'data-a="lock"', c.every(q => q.lk)) +
      ib('copy', 'Duplicate (Ctrl+D)', 'data-a="dup"') + `<button class="b" data-a="fr" aria-label="Bring to front">Front</button><button class="b" data-a="bk" aria-label="Send to back">Back</button>` + ib('trash', 'Delete', 'data-a="del"') + '</div>';
  }
  return h;
}
export function props() {
  const s = P().els.find(e => e.id === ST.sel);
  const c = cur();
  renderTools();
  if (ST.S.view === 'page') {
    $('#topr').innerHTML = topHTML();
    const ri = $('#topr input[data-r]');
    if (ri) {
      ri.focus();
      ri.select();
    }
  }
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
  if (top < 72) top = Math.min(H - 190, y + U.h * v.z + 12);
  el.style.left = left + 'px';
  el.style.top = Math.max(72, top) + 'px';
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
  } else if (k === 'n') {
    const n = Math.round(Math.max(3, Math.min(12, v)));
    ST.sides = n;
    c.forEach(q => q.t === 'poly' && (q.n = n));
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
['#tools', '#ctx', '#panel', '#pgpop'].forEach(s => {
  $(s).addEventListener('input', live);
  $(s).addEventListener('change', settle);
});

/* ---------- appearance: two skins (paper, minimal), each light + dark ---------- */
const isDark = () => {
  const m = document.documentElement.dataset.theme;
  return m ? m === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};
export function setAppearance(k, v) {
  const r = document.documentElement.dataset;
  if (k === 'skin') v === 'paper' ? delete r.skin : r.skin = v;
  else v === 'auto' ? delete r.theme : r.theme = v;
  try {
    localStorage.setItem('sketchbooks-theme', JSON.stringify({ skin: r.skin, mode: r.theme }));
  } catch (e) {}
  for (const c in CC) delete CC[c];
  THC.clear();
  if (ST.S.view === 'page') draw();else render();
}
export function toggleTheme() {
  setAppearance('mode', isDark() ? 'light' : 'dark');
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
  if (d.a && d.a.startsWith('m-')) {
    pgpop(d.a.slice(2), b);
    return;
  }
  if (d.a === 'back') {
    closePops();
    ST.S.view = 'book';
    ST.S.book = nbOf(ST.S.cur).id;
    render();
    return;
  }
  if (d.a === 'ren') {
    ST.ren = P().id;
    props();
    return;
  }
  if (d.a === 'pp' || d.a === 'pn') return goPage(d.a === 'pn' ? 1 : -1);
  if (d.a === 'np') {
    const n = nbOf(P().id), p = { id: uid(), name: 'Page ' + (n.pages.length + 1), els: [], v: { x: 0, y: 0, z: 1 }, mode: P().mode, pat: P().pat, bg: P().bg };
    n.pages.splice(n.pages.indexOf(P()) + 1, 0, p);
    ST.S.cur = p.id;
    save();
    return load();
  }
  if (d.a === 'bak' || d.a === 'imp') {
    closePops();
    $('#' + d.a).click();
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
    h.innerHTML = (n.books || []).map(b => `<button class="b" data-bk="${b.id}">${I.book}${esc(b.title)}</button>`).join('') || '<small>No linked books on this notebook yet.</small>';
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
$('#topr').addEventListener('focusout', e => {
  if (e.target.dataset.r && ST.ren) endRename(e.target);
});
$('#topr').addEventListener('keydown', e => {
  if (!e.target.dataset.r) return;
  if (e.key === 'Enter') endRename(e.target);
  if (e.key === 'Escape') {
    ST.ren = null;
    props();
  }
});
export function goPage(dir) {
  const n = nbOf(P().id), p = n.pages[n.pages.indexOf(P()) + dir];
  if (!p) return;
  ST.S.cur = p.id;
  save();
  load();
}

/* ---------- page and app menu ---------- */
const mb = (label, attrs, on) => `<button class="b${on ? ' on' : ''}" ${attrs} aria-pressed="${!!on}">${label}</button>`;
const mi = (icon, label, attrs) => `<button class="mi" ${attrs}>${I[icon]}<span>${label}</span></button>`;
const seg = (title, items) => `<b>${title}</b><div class="seg">${items}</div>`;
function appearanceHTML() {
  const r = document.documentElement.dataset;
  return seg('Theme', [['paper', 'Warm paper'], ['minimal', 'Minimal']].map(x => mb(x[1], 'data-sk="' + x[0] + '"', (r.skin || 'paper') === x[0])).join('')) +
    seg('Appearance', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(x => mb(x[1], 'data-md="' + x[0] + '"', (r.theme || 'auto') === x[0])).join(''));
}
function menuHTML(m) {
  const p = P();
  if (m === 'table') return tableMenuHTML();
  if (m === 'share') return '<b>Export</b>' + mi('photo', 'Page as image (PNG)', 'data-a="png"') + mi('fileTypePdf', 'Page as PDF', 'data-a="pdf"') + mi('fileExport', 'Whole notebook as PDF', 'data-a="pdfbook"');
  if (m === 'page') return seg('Sheet', [['inf', 'Infinite'], ['a4', 'A4'], ['a4x2', 'Two A4']].map(x => mb(x[1], 'data-pm="' + x[0] + '"', x[0] === 'a4x2' ? !!spreadOf(p) : !spreadOf(p) && (p.mode || 'inf') === x[0])).join('')) +
    seg('Pattern', [['none', 'Blank'], ['dots', 'Dots'], ['lines', 'Lines'], ['squares', 'Grid']].map(x => mb(x[1], 'data-pp="' + x[0] + '"', (p.pat || 'dots') === x[0])).join('')) +
    '<b>Background</b><div class="seg sws">' + BG.map(c => `<button class="sw ${(p.bg || 'auto') === c ? 'on' : ''}" data-pb="${c}" aria-label="Page background ${c === 'auto' ? 'theme default' : c}" aria-pressed="${(p.bg || 'auto') === c}" style="background:${c === 'auto' ? 'var(--bg)' : c}"></button>`).join('') + customColor('bg', p.bg, 'Custom page background') + '</div>' +
    seg('Circuit tools', [['0', 'Off'], ['1', 'On']].map(x => mb(x[1], 'data-pc="' + x[0] + '"', (p.circ ? '1' : '0') === x[0])).join(''));
  if (m === 'lib') return mi('download', 'Download backup', 'data-a="bak"') + mi('upload', 'Import backup', 'data-a="imp"') + '<hr>' + appearanceHTML();
  const books = (nbOf(p.id).books || []).length;
  return mi('command', 'Commands <kbd>Ctrl K</kbd>', 'data-a="palette"') + mi('history', 'Page history', 'data-a="hist"') + mi('microphone', 'Voice notes', 'data-a="rec"') + (books ? mi('book', 'Linked books', 'data-a="books"') : '') + (FSOK ? mi('arrowsMaximize', 'Full screen', 'data-a="fs"') : '') +
    '<hr>' + seg('Snapping', mb('Off', 'data-sn="0"', !ST.snap) + mb('On', 'data-sn="1"', ST.snap)) + seg('Performance', [['', 'Auto'], ['1', 'Lite'], ['0', 'Full']].map(x => mb(x[1], 'data-pf="' + x[0] + '"', ST.PERF === x[0])).join('')) + seg('Renderer', [['gpu', 'GPU tiles'], ['classic', 'Classic']].map(x => mb(x[1], 'data-rd="' + x[0] + '"', rendererName() === x[0])).join('')) + '<hr>' + appearanceHTML();
}
let popMode = '';
// Menus open under the button that opened them; `toggle` closes the menu when its button is pressed again.
export function pgpop(mode, toggle) {
  const h = $('#pgpop'), same = !h.hidden && popMode === mode;
  closePops();
  if (same && toggle) return;
  popMode = mode;
  h.dataset.m = mode;
  h.innerHTML = menuHTML(mode);
  h.hidden = false;
  const a = document.querySelector(mode === 'lib' ? '[data-a="lmore"]' : `[data-a="m-${mode}"]`);
  const r = a ? a.getBoundingClientRect() : { top: 56, bottom: 64, left: innerWidth - 48, right: innerWidth - 8 };
  // open below the button, lined up with whichever of its edges keeps the menu on screen; flip above when there is more room there
  h.style.left = h.style.right = h.style.top = h.style.bottom = '';
  if (r.left + r.right > innerWidth) h.style.right = Math.max(8, innerWidth - r.right - 4) + 'px';else h.style.left = Math.max(8, r.left - 4) + 'px';
  const below = innerHeight - r.bottom - 16, above = r.top - 16, up = h.offsetHeight > below && above > below;
  if (up) h.style.bottom = innerHeight - r.top + 8 + 'px';else h.style.top = r.bottom + 8 + 'px';
  h.style.maxHeight = (up ? above : below) + 'px';
  h.style.transformOrigin = (up ? 'bottom ' : 'top ') + (h.style.right ? 'right' : 'left');
}
$('#pgpop').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.tb) {
    tbl(b.dataset.tb);
    return pgpop('table');
  }
  if (b.dataset.sk || b.dataset.md) {
    setAppearance(b.dataset.sk ? 'skin' : 'mode', b.dataset.sk || b.dataset.md);
    return pgpop(popMode);
  }
  if (b.dataset.a) {
    propsClick(e);
    if (['png', 'pdf', 'pdfbook'].includes(b.dataset.a)) closePops();
    return;
  }
  if (b.dataset.rd) {
    setRenderer(b.dataset.rd);
    draw();
    return pgpop(popMode);
  }
  if (b.dataset.sn) {
    ST.snap = b.dataset.sn === '1';
    return pgpop(popMode);
  }
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
  pgpop(popMode);
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
  if ((e.key === 'PageDown' || e.key === 'PageUp') && ST.S.view === 'page') {
    e.preventDefault();
    goPage(e.key === 'PageDown' ? 1 : -1);
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
    h: 'hand',
    g: 'poly',
    i: 'hl'
  }[k];
  if (m && !mk) {
    e.preventDefault();
    setTool(m);
  }
});
addEventListener('keyup', e => {
  if (e.code === 'Space') ST.space = false;
});
