import { ST, P } from './state.js';
import { $, esc, uid } from './util.js';
import { report } from './report.js';
import { save } from './cloud.js';
import { THC, VER, css, custom, inkFor } from './env.js';
import { bb, describePage, draw, drawR, fitA4 } from './render.js';
import { normUrl, openLink } from './objects.js';
import { bkHTML, hostOf, openReader } from './reader.js';
import { setTool } from './toolbar.js';
import { endRename, side } from './sidebar.js';

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
  side();
}
function binView() {
  const h = $('#home');
  ST.INK = css('--ink');
  h.innerHTML = '<div class="hd"><button class="b" data-a="shelf">← Notebooks</button><h2>Bin</h2><span style="color:var(--mut);font-size:12px">Local only · kept 30 days</span>' + (BIN.length ? '<button class="b" data-a="empty">' + (cfm ? 'Click again to empty' : 'Empty bin') + '</button>' : '') + '</div>' + (BIN.length ? '<div class="binlist">' + BIN.map(b => `<div class="binrow"><span class="bi">${b.kind === 'nb' ? '📓' : '📄'}</span><div class="nm"><b>${esc(b.name)}</b><small>${b.kind === 'nb' ? b.nb.pages.length + ' page' + (b.nb.pages.length > 1 ? 's' : '') : 'from ' + esc(b.fromName || '')} · deleted ${new Date(b.ts).toLocaleDateString()}</small></div><button class="b" data-a="rs" data-id="${b.id}">Restore</button><button class="b" data-a="pd" data-id="${b.id}">Delete forever</button></div>`).join('') + '</div>' : '<p style="padding:8px 32px;color:var(--mut)">The bin is empty.</p>');
}
export function load() {
  ST.msel = [];
  if (!P().circ && (ST.tool === 'comp' || ST.tool === 'wire')) ST.tool = 'select';
  if (P().mode === 'a4') fitA4(P());
  ST.hist = [JSON.stringify(P().els)];
  ST.hi = 0;
  ST.sel = null;
  $('#pgname').textContent = P().name;
  describePage();
  if (!ST.boot) {
    ST.S.view = 'page';
    ST.S.book = nbOf(ST.S.cur).id;
  }
  side();
  render();
  draw();
  setTool(ST.tool);
}
export function render() {
  ST.S.view = ST.S.view || 'shelf';
  $('#home').hidden = ST.S.view === 'page';
  if (ST.S.view !== 'page') home();
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
export function home() {
  const h = $('#home');
  ST.INK = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  if (ST.S.view === 'bin') return binView();
  if (ST.S.view === 'shelf') {
    h.innerHTML = '<div class="hd"><h2>Your notebooks</h2><span class="cloudst" style="color:var(--mut)">' + ST.cstat + '</span><span class="acct">' + ST.acctHTML + '</span><button class="b" data-a="bin">🗑 Bin (' + BIN.length + ')</button></div><div class="shelf">' + ST.S.nbs.map((n, i) => `<div class="book" role="button" tabindex="0" data-a="ob" data-id="${n.id}"><div class="cover" style="--c:${cc(n, i)}"><div class="ttl">${esc(n.name)}</div><small>${n.pages.length} page${n.pages.length > 1 ? 's' : ''}</small></div></div>`).join('') + '<div class="book" role="button" tabindex="0" aria-label="New notebook" data-a="nb"><div class="cover new">+<small>New notebook</small></div></div></div>';
    return;
  }
  const n = ST.S.nbs.find(x => x.id === ST.S.book);
  if (!n) {
    ST.S.view = 'shelf';
    return home();
  }
  h.innerHTML = `<div class="hd"><button class="b" data-a="shelf">← Notebooks</button><input data-bn value="${esc(n.name)}" aria-label="Notebook name"><span>${COV.map(c => `<button class="sw ${cc(n, ST.S.nbs.indexOf(n)) === c ? 'on' : ''}" data-a="c" data-id="${c}" aria-label="Cover color ${c}" style="background:${c}"></button>`).join('')}</span><button class="b" data-a="bkadd">📚 Add book (PDF)</button><button class="b" data-a="bklink">🔗 Add book (link)</button>${ST.S.nbs.length > 1 ? `<button class="b" data-a="dn">${cfm ? 'Click again to delete' : 'Delete notebook'}</button>` : ''}</div>${bkHTML(n)}<div class="grid">` + n.pages.map(p => `<div class="card" role="button" tabindex="0" data-a="op" data-id="${p.id}"><canvas width="320" height="210" data-th="${p.id}"></canvas><div class="cn">${ST.ren === p.id ? `<input data-r="${p.id}" value="${esc(p.name)}">` : `<span class="nm" data-rn="${p.id}" title="Double-click to rename">${esc(p.name)}</span>`}<button class="x" data-a="dpg" data-id="${p.id}" title="Duplicate page" aria-label="Duplicate page">⧉</button>${n.pages.length > 1 ? `<button class="x" data-a="dp" data-id="${p.id}" title="Delete page" aria-label="Delete page">×</button>` : ''}</div></div>`).join('') + '<div class="card new" role="button" tabindex="0" data-a="np">+ New page</div></div>';
  n.pages.forEach(p => thumb(p, h.querySelector(`[data-th="${p.id}"]`)));
  const i = h.querySelector('input[data-r]');
  if (i) {
    i.focus();
    i.select();
  }
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
      alert('Enter a valid web address, for example https://…');
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
  } else if (a === 'nb') {
    const p = {
        id: uid(),
        name: 'Page 1',
        els: [],
        v: {
          x: 0,
          y: 0,
          z: 1
        }
      },
      nn = {
        id: uid(),
        name: 'Notebook ' + (ST.S.nbs.length + 1),
        open: true,
        pages: [p],
        color: COV[ST.S.nbs.length % COV.length]
      };
    ST.S.nbs.push(nn);
    ST.S.book = nn.id;
    ST.S.view = 'book';
  } else if (a === 'c') n.color = id;else if (a === 'dn') {
    if (!cfm) {
      cfm = true;
    } else {
      cfm = false;
      binNb(n.id);
      ST.S.nbs = ST.S.nbs.filter(x => x !== n);
      ST.S.view = 'shelf';
      if (!P()) ST.S.cur = ST.S.nbs[0].pages[0].id;
      side();
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
    n.pages = n.pages.filter(p => p.id !== id);
    if (!P()) ST.S.cur = n.pages[0].id;
    side();
  }
  render();
};
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
    side();
  }
});
$('#back').onclick = () => {
  ST.S.view = 'book';
  ST.S.book = nbOf(ST.S.cur).id;
  render();
};
