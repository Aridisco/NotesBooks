import { P, ST } from './state.js';
import { $, cv, esc } from './util.js';
import { doSave, save, saveBtn } from './cloud.js';
import { BG, CC, FF, FSOK, resize } from './env.js';
import { commit, draw, fitA4, tfit, undo } from './render.js';
import { nbOf } from './notebooks.js';
import { ALN, ahHTML, align, cur, dssHTML, dupe, fitAll, selIds, zord } from './edit.js';
import { togglePal } from './circuit.js';
import { TBB, linkEd, tbl } from './objects.js';
import { toggleFS } from './platform.js';
import { recBtn, togglePanel } from './voice.js';
import { booksBtn } from './reader.js';

const TOOLS = [['select', '↖', 'Select (V)'], ['rect', '▭', 'Rectangle (R)'], ['diamond', '◇', 'Diamond (D)'], ['ellipse', '○', 'Ellipse (O)'], ['arrow', '→', 'Arrow (A)'], ['curve', '↷', 'Curved arrow (C)'], ['line', '╱', 'Line (L)'], ['free', '✎', 'Draw (P)'], ['text', 'T', 'Text (T)'], ['math', '∑', 'Formula (M)'], ['img', '🖼', 'Image'], ['table', '⊞', 'Table'], ['eraser', '⌫', 'Eraser (E)'], ['hand', '✋', 'Pan (H)']];
export function setTool(t) {
  ST.tool = t;
  cv.style.cursor = t === 'select' ? 'default' : t === 'hand' ? 'grab' : t === 'text' ? 'text' : 'crosshair';
  $('#tools').innerHTML = (P().circ ? TOOLS.concat([['wire', '⌐', 'Wire (orthogonal)'], ['cpal', '⚡', 'Circuit components']]) : TOOLS).map(x => `<button data-t="${x[0]}" class="${x[0] === t || x[0] === 'cpal' && t === 'comp' ? 'on' : ''}" title="${x[2]}" aria-label="${x[2]}">${x[1]}</button>`).join('');
  props();
}
$('#tools').onclick = e => {
  const b = e.target.closest('button');
  if (b) {
    if (b.dataset.t === 'img') $('#imgf').click();else if (b.dataset.t === 'cpal') togglePal();else setTool(b.dataset.t);
  }
};
const SC = ['auto', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];
const FC = ['none', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99'];
export function props() {
  const s = P().els.find(e => e.id === ST.sel);
  const sc = c => `<button class="sw ${(s ? s.stroke : ST.stroke) === c ? 'on' : ''}" data-s="${c}" aria-label="Stroke color ${c}" aria-pressed="${(s ? s.stroke : ST.stroke) === c}" style="background:${c === 'auto' ? 'var(--ink)' : c}"></button>`,
    fc = c => `<button class="sw ${(s ? s.fill : ST.fill) === c ? 'on' : ''}" data-f="${c}" aria-label="Fill ${c}" aria-pressed="${(s ? s.fill : ST.fill) === c}" style="background:${c === 'none' ? 'repeating-linear-gradient(45deg,var(--line) 0 3px,transparent 3px 6px)' : c}"></button>`;
  $('#props').innerHTML = SC.map(sc).join('') + '<span class="sep"></span>' + FC.map(fc).join('') + '<span class="sep"></span>' + [1, 2, 4].map(w => `<button class="wb ${(s ? s.sw : ST.sw) === w ? 'on' : ''}" data-w="${w}" aria-label="Line width ${w}">${w === 1 ? '─' : w === 2 ? '━' : '▬'}</button>`).join('') + '<span class="sep"></span><label class="rgl" title="Sketchiness: 0 = clean, 3 = very messy">✎<input type="range" id="rgs" min="0" max="3" step="0.5" value="' + (s && s.rg != null ? s.rg : ST.rough) + '"></label>' + dssHTML(s) + (s && (s.t === 'arrow' || s.t === 'curve') || ST.tool === 'arrow' || ST.tool === 'curve' ? ahHTML(s) : '') + '<span class="sep"></span>' + [['S', 18], ['M', 24], ['L', 36], ['XL', 52]].map(x => `<button class="wb ${(s && s.t === 'text' ? s.fs || 24 : ST.tfs) === x[1] ? 'on' : ''}" data-fs="${x[1]}" title="Text size" aria-label="Text size ${x[0]}">${x[0]}</button>`).join('') + '<select id="ffs" title="Font">' + Object.keys(FF).map(k => `<option value="${k}" ${((s && s.t === 'text' ? s.ff : ST.tff) || 'hand') === k ? 'selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('') + '</select><span class="sep"></span><button class="wb" data-a="u" title="Undo (Ctrl+Z)" aria-label="Undo (Ctrl+Z)">↶</button><button class="wb" data-a="r" title="Redo" aria-label="Redo">↷</button>' + ALN() + (cur().some(q => q.t === 'comp') ? '<button class="wb" data-a="rot" title="Rotate 90°" aria-label="Rotate 90°">⟳</button>' : '') + (cur().some(q => q.t === 'table') ? TBB : '') + (cur().length ? '<button class="wb" data-a="link" title="Add / edit link" aria-label="Add / edit link">🔗</button>' : '') + '<button class="wb ' + (cur().length && cur().every(q => q.lk) ? 'on' : '') + '" data-a="lock" title="Lock / unlock" aria-label="Lock / unlock">🔒</button><button class="wb" data-a="dup" title="Duplicate (Ctrl+D)" aria-label="Duplicate (Ctrl+D)">⧉</button><button class="wb" data-a="fr" title="Bring to front (])" aria-label="Bring to front (])">⤒</button><button class="wb" data-a="bk" title="Send to back ([)" aria-label="Send to back ([)">⤓</button><button class="wb" data-a="del" title="Delete" aria-label="Delete">🗑</button><span class="sep"></span>' + booksBtn() + recBtn() + saveBtn() + (FSOK ? '<button class="wb" data-a="fs" title="Full screen" aria-label="Full screen">⛶</button>' : '') + '<button class="wb" data-a="fit" title="Fit to content" aria-label="Fit to content">⤢</button><button class="wb" data-a="zo" aria-label="Zoom out" title="Zoom out">−</button><span id="zoomv" style="min-width:42px;text-align:center"></span><button class="wb" data-a="zi" aria-label="Zoom in" title="Zoom in">+</button><button class="wb ' + (ST.snap ? 'on' : '') + '" data-a="sn" title="Snapping" aria-label="Snapping">🧲</button><button class="wb" data-a="pg" title="Page style" aria-label="Page style">▦</button><button class="wb" data-a="th" title="Light / dark" aria-label="Light / dark">◐</button>';
  draw();
}
$('#props').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset,
    s = P().els.find(x => x.id === ST.sel),
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
  if (d.a === 'th') {
    const r = document.documentElement,
      dk = getComputedStyle(r).getPropertyValue('--bg').trim() === '#14171d';
    r.dataset.theme = dk ? 'light' : 'dark';
    for (const k in CC) delete CC[k];
  }
  if (d.a === 'sn') ST.snap = !ST.snap;
  if (d.a === 'pg') {
    pgpop();
    return;
  }
  if (d.a === 'books') {
    const n = nbOf(ST.S.cur),
      h = $('#bkpop');
    h.hidden = !h.hidden;
    if (!h.hidden) h.innerHTML = (n.books || []).map(b => `<button class="b" data-bk="${b.id}">📖 ${esc(b.title)}</button>`).join('');
    return;
  }
  if (d.a === 'fs') {
    toggleFS();
    return;
  }
  if (d.a === 'rec') {
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
      v = !c.every(q => q.lk);
    c.forEach(q => q.lk = v || undefined);
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
  if (d.fs) {
    ST.tfs = +d.fs;
    cur().forEach(q => {
      if (q.t === 'text') {
        q.fs = ST.tfs;
        tfit(q);
      }
    });
  }
  if (d.s || d.f || d.w || d.fs) commit();
  props();
};
$('#props').addEventListener('input', e => {
  if (e.target.id !== 'rgs') return;
  ST.rough = +e.target.value;
  const s = P().els.find(q => q.id === ST.sel);
  if (s && !['text', 'math', 'free'].includes(s.t)) {
    s.rg = ST.rough;
    draw();
  }
});
$('#props').addEventListener('change', e => {
  if (e.target.id === 'rgs' && P().els.find(q => q.id === ST.sel)) commit();
});
function pgpop() {
  const p = P(),
    h = $('#pgpop');
  h.hidden = !h.hidden;
  if (h.hidden) return;
  h.innerHTML = '<b>Circuit tools</b><div>' + [['0', 'Off'], ['1', 'On']].map(x => `<button class="b ${(p.circ ? '1' : '0') === x[0] ? 'on' : ''}" data-pc="${x[0]}">${x[1]}</button>`).join('') + '</div><b>Sheet</b><div>' + [['inf', 'Infinite'], ['a4', 'A4 vertical']].map(x => `<button class="b ${(p.mode || 'inf') === x[0] ? 'on' : ''}" data-pm="${x[0]}">${x[1]}</button>`).join('') + '</div><b>Background</b><div>' + BG.map(c => `<button class="sw ${(p.bg || 'auto') === c ? 'on' : ''}" data-pb="${c}" aria-label="Page background ${c}" style="background:${c === 'auto' ? 'var(--bg)' : c}"></button>`).join('') + '</div><b>Pattern</b><div>' + [['none', 'Blank'], ['dots', 'Dots'], ['lines', 'Lines'], ['squares', 'Squares']].map(x => `<button class="b ${(p.pat || 'dots') === x[0] ? 'on' : ''}" data-pp="${x[0]}">${x[1]}</button>`).join('') + '</div><b>Performance</b><div>' + [['', 'Auto'], ['1', 'Lite'], ['0', 'Full']].map(x => `<button class="b ${ST.PERF === x[0] ? 'on' : ''}" data-pf="${x[0]}">${x[1]}</button>`).join('') + '</div>';
}
$('#pgpop').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
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
  if (b.dataset.pm) {
    p.mode = b.dataset.pm;
    if (p.mode === 'a4') fitA4(p);
  }
  if (b.dataset.pb) p.bg = b.dataset.pb;
  if (b.dataset.pp) p.pat = b.dataset.pp;
  save();
  $('#pgpop').hidden = true;
  pgpop();
  draw();
  props();
};
function del() {
  const ids = ST.msel.length ? ST.msel : ST.sel ? [ST.sel] : [];
  if (!ids.length) return;
  P().els = P().els.filter(e => !ids.includes(e.id));
  ST.sel = null;
  ST.msel = [];
  commit();
  props();
}
addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
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
    m: 'math',
    c: 'curve',
    e: 'eraser',
    h: 'hand'
  }[e.key.toLowerCase()];
  if (m && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    setTool(m);
  }
});
addEventListener('keyup', e => {
  if (e.code === 'Space') ST.space = false;
});
/* sidebar */
