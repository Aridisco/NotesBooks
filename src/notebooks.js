import { ST, P } from './state.js';
import { $, cname, esc, uid } from './util.js';
import { report, toast } from './report.js';
import { save } from './cloud.js';
import { THC, VER, css, custom, inkFor } from './env.js';
import { bb, describePage, draw, drawR, fitA4, openHist } from './render.js';
import { normUrl, openLink } from './objects.js';
import { bkHTML, hostOf, openReader } from './reader.js';
import { pgpop, props, setTool } from './toolbar.js';
import { I } from './icons.js';

ST.boot = true;
const COV = ['#d9534f', '#e8913a', '#d8b02e', '#3fa56f', '#3b82c4', '#7c5cc4', '#c4527a', '#3d4a5c'];
export const nbOf = id => ST.S.nbs.find(n => n.pages.some(p => p.id === id));
const cc = (n, i) => n.color || COV[i % COV.length];
let cfm = false;
let BIN = [];
try {
  BIN = (JSON.parse(localStorage.getItem('sketchbooks-bin')) || []).filter(b => b.ts > Date.now() - 2592e6);
} catch (e) {
  report(e, 'Bin could not be read');
}
const saveBin = () => {
  try {
    localStorage.setItem('sketchbooks-bin', JSON.stringify(BIN));
  } catch (e) {
    report(e, 'Bin could not be saved');
  }
};
export function binNb(id) {
  const n = ST.S.nbs.find(x => x.id === id);
  if (n) {
    BIN.unshift({
      id: uid(),
      kind: 'nb',
      name: n.name,
      ts: Date.now(),
      nb: n
    });
    saveBin();
  }
}
export function binPg(n, id) {
  const p = n.pages.find(x => x.id === id);
  if (p) {
    BIN.unshift({
      id: uid(),
      kind: 'pg',
      name: p.name,
      ts: Date.now(),
      pg: p,
      from: n.id,
      fromName: n.name
    });
    saveBin();
  }
}
function restore(id) {
  const it = BIN.find(b => b.id === id);
  if (!it) return;
  if (it.kind === 'nb') ST.S.nbs.push(it.nb);else {
    let n = ST.S.nbs.find(x => x.id === it.from);
    if (!n) {
      n = {
        id: uid(),
        name: it.fromName || 'Restored',
        open: true,
        pages: []
      };
      ST.S.nbs.push(n);
    }
    n.pages.push(it.pg);
  }
  BIN = BIN.filter(b => b !== it);
  saveBin();
  save();
}
const ICB = (icon, label, attrs = '', cls = 'ib') => `<button class="${cls}" ${attrs} title="${label}" aria-label="${label}">${I[icon]}</button>`;
const backBtn = label => `<button class="back" data-a="shelf">${I.chevronLeft}<span>${label}</span></button>`;
function binView() {
  const h = $('#home');
  ST.INK = css('--ink');
  h.innerHTML = '<header class="lhd"><div class="lrow">' + backBtn('Notebooks') + '<span class="grow"></span>' + (BIN.length ? `<button class="pill danger" data-a="empty">${cfm ? 'Tap again to empty' : 'Empty bin'}</button>` : '') + '</div><h1 class="lt">Bin</h1><p class="lsub">Kept on this device for 30 days.</p></header>' +
    (BIN.length ? '<div class="binlist">' + BIN.map(b => `<div class="binrow"><span class="bi">${b.kind === 'nb' ? I.notebook : I.file}</span><div class="nm"><b>${esc(b.name)}</b><small>${b.kind === 'nb' ? b.nb.pages.length + ' page' + (b.nb.pages.length > 1 ? 's' : '') : 'from ' + esc(b.fromName || '')} · deleted ${new Date(b.ts).toLocaleDateString()}</small></div><button class="pill" data-a="rs" data-id="${b.id}">Restore</button>${ICB('trash', 'Delete forever', `data-a="pd" data-id="${b.id}"`, 'ib danger')}</div>`).join('') + '</div>' : '<p class="empty">The bin is empty.</p>');
}
export function load() {
  ST.msel = [];
  if (!P().circ && (ST.tool === 'comp' || ST.tool === 'wire')) ST.tool = 'select';
  if (P().mode === 'a4') fitA4(P());
  openHist();
  ST.sel = null;
  describePage();
  if (!ST.boot) {
    ST.S.view = 'page';
    ST.S.book = nbOf(ST.S.cur).id;
  }
  render();
  draw();
  setTool(ST.tool);
}
// Make another page the active one without refitting the view (used when tapping the other sheet of a spread).
export function switchPage(id) {
  ST.S.cur = id;
  ST.msel = [];
  ST.sel = null;
  openHist();
  describePage();
  save();
  props();
  draw();
}
let lastView = '';
// Plays a short entrance on the screen that just became visible (library, notebook, bin or editor).
function enter(el) {
  el.classList.remove('enter');
  void el.offsetWidth;
  el.classList.add('enter');
}
export function render() {
  ST.S.view = ST.S.view || 'shelf';
  if (ST.S.view !== lastView && lastView) enter(ST.S.view === 'page' ? $('#main') : $('#home'));
  lastView = ST.S.view;
  $('#home').hidden = ST.S.view === 'page';
  // Editor controls stay mounted under the library: keep them out of Tab order and assistive tech.
  for (const id of ['tools', 'topr', 'ctx', 'panel']) $('#' + id).inert = ST.S.view !== 'page';
  if (ST.S.view !== 'page') home();else props();
  save();
}
function thumb(p, c) {
  const g = c.getContext('2d'),
    W = c.width,
    H = c.height,
    tk = p.id + '|' + (VER.get(p) || 0) + '|' + p.els.length + '|' + p.bg + '|' + p.mode + '|' + css('--panel') + css('--ink'),
    th = THC.get(p.id);
  if (th && th.k === tk) {
    g.drawImage(th.c, 0, 0);
    return;
  }
  g.fillStyle = custom(p) ? p.bg : css('--panel');
  g.fillRect(0, 0, W, H);
  ST.INK = inkFor(p);
  if (!p.els.length) return;
  let a = 1e9,
    b = 1e9,
    x2 = -1e9,
    y2 = -1e9;
  p.els.forEach(e => {
    const q = bb(e);
    a = Math.min(a, q.x);
    b = Math.min(b, q.y);
    x2 = Math.max(x2, q.x + q.w);
    y2 = Math.max(y2, q.y + q.h);
  });
  const k = Math.min((W - 30) / Math.max(x2 - a, 1), (H - 30) / Math.max(y2 - b, 1), 1.2),
    old = ST.ctx;
  ST.ctx = g;
  g.setTransform(k, 0, 0, k, (W - (x2 - a) * k) / 2 - a * k, (H - (y2 - b) * k) / 2 - b * k);
  p.els.forEach(drawR);
  ST.ctx = old;
  if (!p.els.some(e => e.t === 'img' || e.t === 'math')) {
    const cc = document.createElement('canvas');
    cc.width = W;
    cc.height = H;
    cc.getContext('2d').drawImage(c, 0, 0);
    THC.set(p.id, {
      k: tk,
      c: cc
    });
  }
}
// Search results across every notebook: page names, notebook names, text, formulas, code and table cells.
function results(q) {
  const R = [];
  ST.S.nbs.forEach(n => n.pages.forEach(p => {
    let sn = null;
    const nm = (n.name + ' ' + p.name).toLowerCase().includes(q);
    for (const e of p.els) {
      const t = e.t === 'text' || e.t === 'code' ? e.text : e.t === 'math' ? e.tex : e.t === 'table' ? (e.cells || []).flat().filter(Boolean).join(' · ') : '';
      const at = t ? t.toLowerCase().indexOf(q) : -1;
      if (at >= 0) {
        sn = t.slice(Math.max(0, at - 20)).replace(/\s+/g, ' ');
        break;
      }
    }
    if (nm || sn) R.push(`<button class="res" data-a="op" data-id="${p.id}">${I.file}<span class="nm"><b>${esc(p.name)}</b><small>${esc(n.name)}${sn ? ' · ' + esc(sn.slice(0, 80)) : ''}</small></span>${I.chevronRight}</button>`);
  }));
  return R.length ? '<div class="reslist">' + R.join('') + '</div>' : '<p class="empty">No pages match “' + esc(q) + '”.</p>';
}
function shelfBody() {
  const q = (ST.q || '').trim().toLowerCase();
  if (q) return results(q);
  return '<div class="shelf">' + ST.S.nbs.map((n, i) => `<div class="book" role="button" tabindex="0" data-a="ob" data-id="${n.id}" aria-label="${esc(n.name)}, ${n.pages.length} page${n.pages.length > 1 ? 's' : ''}"><div class="cover" style="--c:${cc(n, i)}"><div class="ttl">${esc(n.name)}</div></div><div class="bmeta"><b>${esc(n.name)}</b><small>${n.pages.length} page${n.pages.length > 1 ? 's' : ''}</small></div></div>`).join('') +
    `<div class="book" role="button" tabindex="0" aria-label="New notebook" data-a="nb"><div class="cover new">${I.plus}</div><div class="bmeta"><b>New notebook</b></div></div></div>`;
}
export function home() {
  const h = $('#home');
  ST.INK = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  if (ST.S.view === 'bin') return binView();
  if (ST.S.view === 'shelf') {
    h.innerHTML = '<header class="lhd"><div class="lrow"><h1 class="lt">Notebooks</h1><span class="grow"></span><span class="cloudst chip">' + esc(ST.cstat) + '</span>' +
      `<button class="ib" data-a="bin" title="Bin" aria-label="Bin, ${BIN.length} item${BIN.length === 1 ? '' : 's'}">${I.trash}${BIN.length ? `<span class="badge" aria-hidden="true">${BIN.length}</span>` : ''}</button>` +
      ICB('dotsVertical', 'Library menu: backup, import, theme', 'data-a="lmore" aria-haspopup="true"') + '</div>' +
      `<div class="lrow wrap"><label class="srch">${I.search}<input id="srch" type="search" placeholder="Search pages and text" aria-label="Search pages and text" value="${esc(ST.q || '')}" autocomplete="off"></label><span class="acct">${ST.acctHTML}</span></div></header><div id="lbody">${shelfBody()}</div>`;
    return;
  }
  const n = ST.S.nbs.find(x => x.id === ST.S.book);
  if (!n) {
    ST.S.view = 'shelf';
    return home();
  }
  const idx = ST.S.nbs.indexOf(n);
  h.innerHTML = '<header class="lhd"><div class="lrow">' + backBtn('Notebooks') + '<span class="grow"></span>' +
    ICB('books', 'Add book (PDF)', 'data-a="bkadd"') + ICB('link', 'Add book (link)', 'data-a="bklink"', 'ib' + (ST.bkForm ? ' on' : '')) +
    (ST.S.nbs.length > 1 ? (cfm ? '<button class="pill danger" data-a="dn">Tap again to delete</button>' : ICB('trash', 'Delete notebook', 'data-a="dn"', 'ib danger')) : '') + '</div>' +
    `<input class="lt" data-bn value="${esc(n.name)}" aria-label="Notebook name"><div class="covers" role="group" aria-label="Cover color">${COV.map(c => `<button class="sw${cc(n, idx) === c ? ' on' : ''}" data-a="c" data-id="${c}" aria-label="Cover color ${cname(c)}" aria-pressed="${cc(n, idx) === c}" style="background:${c}"></button>`).join('')}</div></header>` +
    bkHTML(n) + '<div class="grid">' + n.pages.map(p => `<div class="card" role="button" tabindex="0" data-a="op" data-id="${p.id}" aria-label="Open ${esc(p.name)}"><canvas width="320" height="210" data-th="${p.id}"></canvas><div class="cn">${ST.ren === p.id ? `<input data-r="${p.id}" value="${esc(p.name)}" aria-label="Page name">` : `<span class="nm" data-rn="${p.id}">${esc(p.name)}</span>`}` +
    ICB('pencil', 'Rename page', `data-a="ren" data-id="${p.id}"`, 'ib sm') + ICB('copy', 'Duplicate page', `data-a="dpg" data-id="${p.id}"`, 'ib sm') + (n.pages.length > 1 ? ICB('trash', 'Delete page', `data-a="dp" data-id="${p.id}"`, 'ib sm') : '') + '</div></div>').join('') +
    `<div class="card new" role="button" tabindex="0" data-a="np">${I.filePlus}<span>New page</span></div></div>`;
  n.pages.forEach(p => thumb(p, h.querySelector(`[data-th="${p.id}"]`)));
  const i = h.querySelector('input[data-r]');
  if (i) {
    i.focus();
    i.select();
  }
}
export function endRename(i) {
  const id = i.dataset.r,
    v = i.value.trim();
  ST.ren = null;
  for (const n of ST.S.nbs) {
    if (n.id === id && v) n.name = v;
    for (const p of n.pages) if (p.id === id && v) p.name = v;
  }
  save();
  ST.S.view === 'page' ? props() : home();
}
export function newNotebook() {
  const p = { id: uid(), name: 'Page 1', els: [], v: { x: 0, y: 0, z: 1 } },
    nn = { id: uid(), name: 'Notebook ' + (ST.S.nbs.length + 1), open: true, pages: [p], color: COV[ST.S.nbs.length % COV.length] };
  ST.S.nbs.push(nn);
  ST.S.book = nn.id;
  ST.S.view = 'book';
  render();
}
$('#home').onclick = e => {
  const t = e.target;
  if (t.closest('input')) return;
  const el = t.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a,
    id = el.dataset.id,
    n = ST.S.nbs.find(x => x.id === ST.S.book);
  if (a !== 'dn' && a !== 'empty') cfm = false;
  if (a === 'lmore') return pgpop('lib', el);
  if (a === 'ren') {
    ST.ren = id;
    return home();
  }
  if (a === 'ob') {
    ST.S.view = 'book';
    ST.S.book = id;
  } else if (a === 'shelf') ST.S.view = 'shelf';else if (a === 'bkadd') {
    $('#bkf').click();
    return;
  } else if (a === 'bklink') ST.bkForm = !ST.bkForm;else if (a === 'bkok') {
    const t = $('#home').querySelector('#bkt').value.trim(),
      u = normUrl($('#home').querySelector('#bku').value);
    if (!u || u.startsWith('mailto:')) {
      toast('Enter a valid web address, for example https://…');
      return;
    }
    n.books = n.books || [];
    n.books.push({
      id: uid(),
      title: t || hostOf(u),
      url: u
    });
    ST.bkForm = false;
  } else if (a === 'bkopen') {
    const b = (n.books || []).find(x => x.id === id);
    if (b) openLink(b.url);
    return;
  } else if (a === 'bkside') {
    const b = (n.books || []).find(x => x.id === id);
    if (b && n.pages.length) {
      openReader(b);
      ST.S.cur = n.pages[0].id;
      return load();
    }
    return;
  } else if (a === 'bkdel') n.books = (n.books || []).filter(x => x.id !== id);else if (a === 'bin') ST.S.view = 'bin';else if (a === 'rs') restore(id);else if (a === 'pd') {
    BIN = BIN.filter(b => b.id !== id);
    saveBin();
  } else if (a === 'empty') {
    if (!cfm) cfm = true;else {
      cfm = false;
      BIN = [];
      saveBin();
    }
  } else if (a === 'nb') return newNotebook();
  else if (a === 'c') n.color = id;else if (a === 'dn') {
    if (!cfm) {
      cfm = true;
    } else {
      cfm = false;
      binNb(n.id);
      toast('“' + n.name + '” moved to the Bin. Restore it from the Bin for 30 days.');
      ST.S.nbs = ST.S.nbs.filter(x => x !== n);
      ST.S.view = 'shelf';
      if (!P()) ST.S.cur = ST.S.nbs[0].pages[0].id;
    }
  } else if (a === 'np') {
    const p = {
      id: uid(),
      name: 'Page ' + (n.pages.length + 1),
      els: [],
      v: {
        x: 0,
        y: 0,
        z: 1
      }
    };
    n.pages.push(p);
    ST.S.cur = p.id;
    return load();
  } else if (a === 'op') {
    ST.S.cur = id;
    return load();
  } else if (a === 'dpg') {
    const p = n.pages.find(q => q.id === id);
    if (p) {
      const c = JSON.parse(JSON.stringify(p));
      c.id = uid();
      c.name = p.name + ' copy';
      n.pages.splice(n.pages.indexOf(p) + 1, 0, c);
    }
  } else if (a === 'dp') {
    binPg(n, id);
    toast('Page moved to the Bin. Restore it from the Bin for 30 days.');
    n.pages = n.pages.filter(p => p.id !== id);
    if (!P()) ST.S.cur = n.pages[0].id;
  }
  render();
};
$('#home').addEventListener('input', e => {
  if (e.target.id !== 'srch') return;
  ST.q = e.target.value;
  $('#lbody').innerHTML = shelfBody();
});
$('#home').ondblclick = e => {
  const id = e.target.dataset.rn;
  if (id) {
    ST.ren = id;
    home();
  }
};
$('#home').addEventListener('focusout', e => {
  if (e.target.dataset.r && ST.ren) endRename(e.target);
});
$('#home').addEventListener('keydown', e => {
  if (e.target.dataset.r && (e.key === 'Enter' || e.key === 'Escape')) e.key === 'Enter' ? endRename(e.target) : (ST.ren = null, home());
});
$('#home').addEventListener('change', e => {
  if ('bn' in e.target.dataset) {
    const n = ST.S.nbs.find(x => x.id === ST.S.book),
      v = e.target.value.trim();
    if (v) n.name = v;
    save();
  }
});
