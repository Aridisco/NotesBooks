import { cv, uid } from './util.js';
import { report } from './report.js';

// Shared mutable state: every top-level variable that is reassigned and used by more than one module.
export const ST = {
  S: undefined,
  tool: undefined,
  stroke: undefined,
  fill: undefined,
  sw: undefined,
  sel: undefined,
  hist: undefined,
  hi: undefined,
  act: undefined,
  space: undefined,
  ren: undefined,
  INK: undefined,
  ed: undefined,
  ready: undefined,
  pulling: undefined,
  cdb: undefined,
  known: undefined,
  curMeta: undefined,
  cstat: undefined,
  acctHTML: undefined,
  ctx: undefined,
  snap: undefined,
  guide: undefined,
  tfs: undefined,
  rough: undefined,
  msel: undefined,
  tff: undefined,
  tds: undefined,
  tah: undefined,
  ck: undefined,
  PERF: undefined,
  BATLOW: undefined,
  LT: undefined,
  rq: undefined,
  nerdTried: undefined,
  lt: undefined,
  boot: undefined,
  bkForm: undefined,
};

ST.S = null;
try {
  ST.S = JSON.parse(localStorage.getItem('sketchbooks1'));
} catch (e) {
  // The next save would overwrite the unreadable data, so keep a copy of it first.
  try {
    localStorage.setItem('sketchbooks1-corrupt', localStorage.getItem('sketchbooks1'));
  } catch (e2) {}
  report(e, 'Saved notebooks could not be read (a copy was kept)');
}
if (!ST.S || !ST.S.nbs || !ST.S.nbs.length) ST.S = {
  nbs: [{
    id: uid(),
    name: 'My notebook',
    open: true,
    pages: [{
      id: uid(),
      name: 'Page 1',
      els: [],
      v: {
        x: 0,
        y: 0,
        z: 1
      }
    }]
  }]
};
if (!ST.S.cur) ST.S.cur = ST.S.nbs[0].pages[0].id;
ST.tool = 'select';
ST.stroke = 'auto';
ST.fill = 'none';
ST.sw = 2;
ST.sel = null;
ST.hist = [];
ST.hi = 0;
ST.act = null;
ST.space = false;
ST.ren = null;
ST.INK = '#000';
ST.ed = null;
export const P = () => {
  for (const n of ST.S.nbs) for (const p of n.pages) if (p.id === ST.S.cur) return p;
};
export const dirty = new Set();
ST.ready = false;
ST.pulling = false;
ST.cdb = null;
ST.known = new Map();
ST.curMeta = '';
ST.cstat = 'Local only';
let ft = null;
ST.ctx = cv.getContext('2d');
