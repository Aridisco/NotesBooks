import { ST } from './state.js';
import { invalidateAll } from './scene.js';
import { $, uid } from './util.js';
import { save, setStat } from './cloud.js';
import { loadScript } from './env.js';
import { A4W, draw } from './render.js';
import { home } from './notebooks.js';
import { idbp } from './platform.js';

/* books (PDF) */
let pdfP = null;
const BKD = new Map();
export const BKC = new Map();
function loadPdfJs() {
  if (!pdfP) pdfP = loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js').then(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }).catch(e => {
    pdfP = null;
    throw e;
  });
  return pdfP;
}
function bkDoc(id) {
  if (!BKD.has(id)) BKD.set(id, idbp('books', 'readonly', s => s.get(id)).then(async rec => {
    if (!rec) return null;
    await loadPdfJs();
    return pdfjsLib.getDocument({
      data: await rec.blob.arrayBuffer()
    }).promise;
  }).catch(() => null));
  return BKD.get(id);
}
export function bkBmp(p) {
  const k = p.bk.id + ':' + p.bk.i,
    c = BKC.get(k);
  if (c) return c.ok ? c.cv : null;
  const ent = {
    ok: false,
    cv: null
  };
  BKC.set(k, ent);
  if (BKC.size > 6) BKC.delete(BKC.keys().next().value);
  bkDoc(p.bk.id).then(async doc => {
    if (!doc) {
      ent.miss = true;
      invalidateAll();
      draw();
      return;
    }
    const pg = await doc.getPage(p.bk.i),
      v0 = pg.getViewport({
        scale: 1
      }),
      vp = pg.getViewport({
        scale: (ST.LT ? 1.2 : 2) * A4W / v0.width
      }),
      c2 = document.createElement('canvas');
    c2.width = vp.width;
    c2.height = vp.height;
    await pg.render({
      canvasContext: c2.getContext('2d'),
      viewport: vp
    }).promise;
    ent.cv = c2;
    ent.ok = true;
    invalidateAll();
    draw();
  }).catch(() => {
    ent.miss = true;
  });
  return null;
}
async function importBook(file, n) {
  try {
    await loadPdfJs();
  } catch (e) {
    alert('Could not load the PDF reader (are you offline?)');
    return;
  }
  const ex = ST.S.nbs.flatMap(x => x.pages).find(p => p.bk && p.bk.name === file.name);
  if (ex) {
    const have = await idbp('books', 'readonly', s => s.get(ex.bk.id)).catch(() => null);
    if (have) {
      alert('This book is already in your notebooks');
      return;
    }
    await idbp('books', 'readwrite', s => s.put({
      id: ex.bk.id,
      name: file.name,
      blob: file
    }, ex.bk.id));
    BKD.delete(ex.bk.id);
    BKC.clear();
    invalidateAll();
    draw();
    setStat('Book file attached again');
    return;
  }
  const id = uid(),
    doc = await pdfjsLib.getDocument({
      data: await file.arrayBuffer()
    }).promise,
    N = Math.min(doc.numPages, 400),
    nm = file.name.replace(/\.pdf$/i, '');
  await idbp('books', 'readwrite', s => s.put({
    id,
    name: file.name,
    blob: file
  }, id));
  for (let i = 1; i <= N; i++) n.pages.push({
    id: uid(),
    name: nm + ' · ' + i,
    els: [],
    v: {
      x: 0,
      y: 0,
      z: 1
    },
    mode: 'a4',
    bk: {
      id,
      i,
      name: file.name
    }
  });
  save();
  home();
}
$('#bkf').onchange = e => {
  const f = e.target.files[0];
  e.target.value = '';
  const n = ST.S.nbs.find(x => x.id === ST.S.book);
  if (f && n) importBook(f, n);
};
/* live transcription + audio */
