import { P, ST } from './state.js';
import { $, esc, uid } from './util.js';
import { save } from './cloud.js';
import { resize } from './env.js';
import { binNb, binPg, home, load, render } from './notebooks.js';

export /* sidebar */
function side() {
  $('#tree').innerHTML = ST.S.nbs.map(n => `<div class="nb" role="button" tabindex="0" aria-expanded="${!!n.open}" data-n="${n.id}"><span>${n.open ? '▾' : '▸'}</span>${ST.ren === n.id ? `<input data-r="${n.id}" value="${esc(n.name)}">` : `<span class="nm" data-rn="${n.id}">${esc(n.name)}</span>`}<button class="add" data-ap="${n.id}" title="New page" aria-label="New page">+</button>${ST.S.nbs.length > 1 ? `<button class="x" data-dn="${n.id}" title="Delete notebook" aria-label="Delete notebook">×</button>` : ''}</div>` + (n.open ? n.pages.map(p => `<div class="pg ${p.id === ST.S.cur ? 'on' : ''}" role="button" tabindex="0" aria-current="${p.id === ST.S.cur}" data-p="${p.id}">${ST.ren === p.id ? `<input data-r="${p.id}" value="${esc(p.name)}">` : `<span class="nm" data-rn="${p.id}">${esc(p.name)}</span>`}${n.pages.length > 1 ? `<button class="x" data-dp="${p.id}" title="Delete page" aria-label="Delete page">×</button>` : ''}</div>`).join('') : '')).join('');
  const i = $('#tree input');
  if (i) {
    i.focus();
    i.select();
  }
}
$('#tree').onclick = e => {
  const t = e.target,
    d = t.closest('[data-dn],[data-dp],[data-ap]');
  if (t.closest('input')) return;
  if (t.dataset.ap) {
    const n = ST.S.nbs.find(x => x.id === t.dataset.ap),
      p = {
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
    n.open = true;
    ST.S.cur = p.id;
    save();
    return load();
  }
  if (t.dataset.dn) {
    binNb(t.dataset.dn);
    ST.S.nbs = ST.S.nbs.filter(n => n.id !== t.dataset.dn);
    if (!P()) {
      ST.S.cur = ST.S.nbs[0].pages[0].id;
    }
    save();
    return load();
  }
  if (t.dataset.dp) {
    const n = ST.S.nbs.find(n => n.pages.some(p => p.id === t.dataset.dp));
    binPg(n, t.dataset.dp);
    n.pages = n.pages.filter(p => p.id !== t.dataset.dp);
    if (!P()) ST.S.cur = n.pages[0].id;
    save();
    return load();
  }
  const pg = t.closest('[data-p]');
  if (pg) {
    ST.S.cur = pg.dataset.p;
    save();
    return load();
  }
  const nb = t.closest('[data-n]');
  if (nb) {
    const n = ST.S.nbs.find(x => x.id === nb.dataset.n);
    n.open = !n.open;
    save();
    side();
  }
};
$('#tree').ondblclick = e => {
  const id = e.target.dataset.rn;
  if (id) {
    ST.ren = id;
    side();
  }
};
export function endRename(i) {
  const id = i.dataset.r,
    v = i.value.trim();
  ST.ren = null;
  for (const n of ST.S.nbs) {
    if (n.id === id && v) n.name = v;
    for (const p of n.pages) if (p.id === id && v) p.name = v;
  }
  save();
  $('#pgname').textContent = P().name;
  side();
  if (ST.S.view !== 'page') home();
}
$('#tree').addEventListener('focusout', e => {
  if (e.target.dataset.r && ST.ren) endRename(e.target);
});
$('#tree').addEventListener('keydown', e => {
  if (e.target.dataset.r && (e.key === 'Enter' || e.key === 'Escape')) e.key === 'Enter' ? endRename(e.target) : (ST.ren = null, side());
});
$('#newnb').onclick = () => {
  const p = {
    id: uid(),
    name: 'Page 1',
    els: [],
    v: {
      x: 0,
      y: 0,
      z: 1
    }
  };
  ST.S.nbs.push({
    id: uid(),
    name: 'Notebook ' + (ST.S.nbs.length + 1),
    open: true,
    pages: [p]
  });
  ST.S.cur = p.id;
  save();
  load();
};
$('#srch').addEventListener('input', () => {
  const q = $('#srch').value.trim().toLowerCase();
  if (!q) {
    side();
    return;
  }
  const R = [];
  ST.S.nbs.forEach(n => n.pages.forEach(p => {
    let sn = null;
    const nm = (n.name + ' ' + p.name).toLowerCase().includes(q);
    for (const e of p.els) {
      const t = e.t === 'text' ? e.text : e.t === 'math' ? e.tex : '';
      if (t && t.toLowerCase().includes(q)) {
        sn = t;
        break;
      }
    }
    if (nm || sn) R.push(`<div class="pg" role="button" tabindex="0" data-p="${p.id}" style="padding-left:10px"><span class="nm"><b>${esc(p.name)}</b> · ${esc(n.name)}${sn ? '<br><small>' + esc(sn.slice(0, 60)) + '</small>' : ''}</span></div>`);
  }));
  $('#tree').innerHTML = R.join('') || '<div style="padding:8px;color:var(--mut)">No matches</div>';
});
$('#tree').addEventListener('click', e => {
  if (e.target.closest('[data-p]')) $('#srch').value = '';
});
$('#binbtn').onclick = () => {
  ST.S.view = 'bin';
  render();
};
$('#toggle').onclick = () => {
  $('#side').classList.toggle('hide');
  setTimeout(resize, 0);
};
if (innerWidth <= 700) $('#side').classList.add('hide');
