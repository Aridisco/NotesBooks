import { ST, P, dirty } from './state.js';
import { $, esc, uid } from './util.js';
import { chunks, planBatches, syncAction } from './syncLogic.js';
import { report } from './report.js';
import { askChoice } from './dialog.js';
import { I } from './icons.js';
import { FB_CONFIG } from './config.js';
import { THC, lsw } from './env.js';
import { draw } from './render.js';
import { render } from './notebooks.js';

ST.acctHTML = '';
const setAcct = h => {
  ST.acctHTML = h;
  document.querySelectorAll('.acct').forEach(e => e.innerHTML = h);
};
const unsaved = () => !!ST.cdb && (ST.S.ts || 0) > (ST.S.syncTs || 0);
export const setStat = t => {
  ST.cstat = t;
  document.querySelectorAll('.cloudst').forEach(e => e.textContent = t);
  document.querySelectorAll('[data-a="save"],[data-sv]').forEach(b => b.classList.toggle('on', unsaved()));
};
const metaOf = ts => ({
  ts: ts ? ST.S.ts || 0 : undefined,
  nbs: ST.S.nbs.map(n => ({
    id: n.id,
    name: n.name,
    color: n.color,
    books: n.books,
    pages: n.pages.map(p => ({
      id: p.id,
      name: p.name,
      bg: p.bg,
      pat: p.pat,
      mode: p.mode,
      spread: p.spread,
      circ: p.circ,
      bk: p.bk
    }))
  }))
});
export const save = () => {
  if (ST.ready && !ST.pulling) {
    const m = JSON.stringify(metaOf(0));
    if (m !== ST.curMeta || dirty.size) {
      ST.curMeta = m;
      ST.S.ts = Date.now();
      if (ST.cdb) setStat('☁ unsaved changes · Ctrl+S to save');
    }
  }
  clearTimeout(ST.lt);
  ST.lt = setTimeout(lsw, 500);
};
async function flush(all) {
  if (!ST.cdb) return;
  try {
    if (all && !ST.S.ts) ST.S.ts = Date.now();
    const ids = new Set(),
      dd = new Set(dirty),
      ops = [],
      counts = new Map(),
      doc = (id, i) => ST.cdb.doc('p_' + id + '_' + i);
    for (const n of ST.S.nbs) for (const p of n.pages) {
      ids.add(p.id);
      if (all || dd.has(p.id) || !ST.known.has(p.id)) {
        const c = chunks(JSON.stringify({ els: p.els }));
        c.forEach((d, i) => ops.push({ ref: doc(p.id, i), data: { d } }));
        for (let i = c.length; i < (ST.known.get(p.id) || 0); i++) ops.push({ ref: doc(p.id, i) });
        counts.set(p.id, c.length);
      }
    }
    for (const [id, k] of ST.known) if (!ids.has(id)) {
      for (let i = 0; i < k; i++) ops.push({ ref: doc(id, i) });
      counts.set(id, null);
    }
    const mm = metaOf(1);
    lastWrite = mm.ts;
    const meta = { ref: ST.cdb.doc('meta'), data: { d: JSON.stringify(mm) } };
    // Page chunks and the meta document are committed together (meta last), so an interrupted
    // save leaves the previous cloud version intact instead of a mix of old and new pages.
    for (const group of planBatches(ops, meta)) {
      const b = ST.cdb.firestore.batch();
      group.forEach(o => o.data ? b.set(o.ref, o.data) : b.delete(o.ref));
      await b.commit();
    }
    counts.forEach((k, id) => k === null ? ST.known.delete(id) : ST.known.set(id, k));
    dd.forEach(i => dirty.delete(i));
    ST.S.syncTs = mm.ts;
    ST.S.acct = cuid;
    lsw();
    setStat('☁ saved ✓');
  } catch (e) {
    report(e, 'Cloud save failed');
    setStat('☁ sync error: ' + (e && e.code || 'unknown'));
  }
}
async function pull(m, merge) {
  ST.pulling = true;
  try {
    const old = ST.S.nbs,
      q = await ST.cdb.get(),
      raw = {},
      pg = {};
    q.docs.forEach(d => {
      const x = /^p_([a-z0-9]+)(?:_(\d+))?$/.exec(d.id);
      if (!x) return;
      const r = raw[x[1]] = raw[x[1]] || {
        c: []
      };
      if (x[2] === undefined) r.l = d.data().d;else r.c[+x[2]] = d.data().d;
    });
    const damaged = [];
    for (const id in raw) {
      const r = raw[id];
      try {
        pg[id] = JSON.parse(r.c.length ? r.c.join('') : r.l).els;
      } catch (e) {
        damaged.push(id);
      }
    }
    if (damaged.length) {
      // Replacing local data with an empty page would wipe it from the cloud on the next save.
      const names = m.nbs.flatMap(n => n.pages).filter(p => damaged.includes(p.id)).map(p => p.name);
      throw new Error('The cloud copy of ' + (names.join(', ') || 'a page') + ' is damaged. Nothing was replaced.');
    }
    ST.known = new Map(Object.keys(raw).map(id => [id, raw[id].c.length]));
    const ov = {},
      op = {},
      localEls = {};
    ST.S.nbs.forEach(n => {
      op[n.id] = n.open;
      n.pages.forEach(p => {
        ov[p.id] = p.v;
        localEls[p.id] = p.els;
      });
    });
    ST.S.nbs = m.nbs.map(n => ({
      ...n,
      open: op[n.id] !== false,
      pages: n.pages.map(p => ({
        ...p,
        els: pg[p.id] || localEls[p.id] || [],
        v: ov[p.id] || {
          x: 0,
          y: 0,
          z: 1
        }
      }))
    }));
    if (merge) {
      const ids = new Set(ST.S.nbs.map(n => n.id));
      old.forEach(n => {
        if (!ids.has(n.id) && !pristineNb(n)) ST.S.nbs.push(n);
      });
    }
    if (!P()) {
      ST.S.cur = ST.S.nbs[0].pages[0].id;
      ST.S.view = 'shelf';
    }
    if (ST.S.view === 'book' && !ST.S.nbs.find(n => n.id === ST.S.book)) ST.S.view = 'shelf';
    THC.clear();
    ST.S.ts = merge ? Date.now() : m.ts;
    ST.S.syncTs = m.ts;
    ST.S.acct = cuid;
    ST.curMeta = JSON.stringify(metaOf(0));
    dirty.clear();
    ST.hist = [JSON.stringify(P().els)];
    ST.hi = 0;
    ST.sel = null;
    render();
    draw();
    setStat('☁ synced');
  } finally {
    ST.pulling = false;
  }
}
let cuid = '';
let lastWrite = 0;
const pristineNb = n => n.pages.length === 1 && !n.pages[0].els.length && /^(My notebook|Notebook \d+)$/.test(n.name);
let asking = false;
async function resolveConflict(m) {
  asking = true;
  try {
    const pick = await askChoice(
      'Cloud and this device both changed',
      'This notebook was edited on another device and also here since the last sync. Which version do you want to keep?',
      [
        { label: 'Keep both (local notebooks saved as copies)', value: 'both' },
        { label: 'Use the cloud version', value: 'cloud' },
        { label: 'Keep this device (overwrites cloud on next save)', value: 'local' }
      ]
    );
    if (pick === 'local') {
      ST.S.syncTs = m.ts;
      ST.S.ts = Date.now();
    } else {
      const mine = pick === 'both' ? JSON.parse(JSON.stringify(ST.S.nbs.filter(n => !pristineNb(n)))) : [];
      await pull(m, false);
      mine.forEach(n => {
        n.id = uid();
        n.name += ' (this device)';
        n.pages.forEach(p => p.id = uid());
        ST.S.nbs.push(n);
      });
      if (mine.length) {
        ST.S.ts = Date.now();
        render();
      }
    }
  } finally {
    asking = false;
  }
}
async function onMeta(sn) {
  if (asking) return;
  if (ST.pulling || ST.act) {
    setTimeout(() => onMeta(sn), 400);
    return;
  }
  try {
    const m = sn.exists ? JSON.parse(sn.data().d) : null,
      same = ST.S.acct === cuid,
      changed = same ? (ST.S.ts || 0) > (ST.S.syncTs || 0) : !ST.S.nbs.every(pristineNb);
    if (!m) {
      ST.S.acct = cuid;
      ST.S.syncTs = 0;
      if (!ST.S.nbs.every(pristineNb)) ST.S.ts = Date.now();
    } else {
      const act = syncAction({ m, same, changed, lastWrite, syncTs: ST.S.syncTs });
      if (act === 'conflict') await resolveConflict(m);
      else if (act !== 'none') await pull(m, act === 'merge');
    }
    ST.ready = true;
    if (!ST.cstat.includes('error')) setStat(unsaved() ? '☁ unsaved changes · Ctrl+S to save' : '☁ saved ✓');
  } catch (e) {
    ST.ready = true;
    report(e, 'Cloud sync failed');
    setStat('☁ ' + (e && e.code || 'sync error'));
  }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ST.cdb && ST.ready && !unsaved()) ST.cdb.doc('meta').get().then(onMeta).catch(e => report(e, 'Cloud check failed', { quiet: true }));
});
export async function doSave() {
  if (!ST.cdb) {
    setStat(cuid ? '☁ connecting…' : 'Sign in with Google to save to the cloud');
    return;
  }
  if (!ST.ready) return;
  setStat('☁ saving…');
  clearTimeout(ST.lt);
  lsw();
  await flush(!ST.S.syncTs);
  if (!unsaved()) $('#svbar').hidden = true;
}
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    doSave();
  }
});
addEventListener('beforeunload', e => {
  if (!unsaved()) return;
  e.preventDefault();
  e.returnValue = '';
  setTimeout(() => {
    if (unsaved()) $('#svbar').hidden = false;
  }, 300);
});
$('#svnow').onclick = () => doSave();
$('#svx').onclick = () => {
  $('#svbar').hidden = true;
};
export const saveBtn = () => '<button class="ib' + (unsaved() ? ' on' : '') + '" data-a="save" title="Save to cloud (Ctrl+S)" aria-label="Save to cloud (Ctrl+S)">' + I.deviceFloppy + '</button>';
let fbAuth = null;
let fbUnsub = null;
export async function cloudInit() {
  ST.curMeta = JSON.stringify(metaOf(0));
  try {
    firebase.initializeApp(FB_CONFIG);
    fbAuth = firebase.auth();
    const fs = firebase.firestore();
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-si],[data-so],[data-sy],[data-sv]');
      if (!b) return;
      if (b.dataset.sv !== undefined) {
        doSave();
        return;
      }
      if (b.dataset.sy !== undefined) {
        if (unsaved() && !confirm('You have unsaved changes. Load from cloud anyway?')) return;
        if (ST.cdb) ST.cdb.doc('meta').get().then(sn => sn.exists ? pull(JSON.parse(sn.data().d), false) : setStat('☁ nothing in the cloud yet')).catch(er => {
          report(er, 'Load from cloud failed');
          setStat('☁ ' + (er && er.code || 'error'));
        });
        return;
      }
      if (b.dataset.so !== undefined) return fbAuth.signOut();
      const pr = new firebase.auth.GoogleAuthProvider();
      fbAuth.signInWithPopup(pr).catch(er => {
        if (/popup/.test(er.code)) fbAuth.signInWithRedirect(pr);else setStat('Sign-in failed: ' + er.code + (er.code === 'auth/unauthorized-domain' ? ' · add "' + (location.hostname || 'file:// is not allowed, host the file') + '" to Authorized domains' : ''));
      });
    });
    fbAuth.onAuthStateChanged(u => {
      fbUnsub = null;
      if (!u) {
        ST.cdb = null;
        cuid = '';
        ST.ready = true;
        setStat('Local only');
        setAcct('<button class="gbtn" data-si>Sign in with Google</button>');
        return;
      }
      setAcct('<span>' + esc(u.displayName || u.email || 'Signed in') + '</span><button class="gbtn" data-sv title="Save to cloud (Ctrl+S)" aria-label="Save to cloud (Ctrl+S)">' + I.deviceFloppy + 'Save</button><button class="gbtn" data-sy title="Replace this device with the cloud copy" aria-label="Replace this device with the cloud copy">Load from cloud</button><button class="gbtn" data-so>Sign out</button>');
      cuid = u.uid;
      ST.ready = false;
      ST.cdb = fs.collection('users').doc(u.uid).collection('sketchbooks');
      setStat('☁ connecting…');
      fbUnsub = ST.cdb.doc('meta').get().then(onMeta).catch(er => {
        ST.ready = true;
        setStat('☁ ' + (er && er.code || 'offline'));
      });
    });
  } catch (e) {
    ST.ready = true;
    setStat('Local only');
  }
}
