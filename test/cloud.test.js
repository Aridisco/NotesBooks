import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CH, decodePages, pageDoc } from '../src/syncLogic.js';

const { ST, dirty, nodes, listeners, report, lsw } = vi.hoisted(() => ({
  ST: {}, dirty: new Set(), nodes: {}, listeners: {}, report: vi.fn(), lsw: vi.fn()
}));
vi.mock('../src/state.js', () => ({ ST, dirty, P: () => ST.S.nbs.flatMap(n => n.pages).find(p => p.id === ST.S.cur) }));
vi.mock('../src/util.js', () => ({ $: s => nodes[s] ||= {}, esc: s => s, mod: s => s, uid: () => 'copy' }));
vi.mock('../src/report.js', () => ({ report }));
vi.mock('../src/dialog.js', () => ({ askChoice: vi.fn() }));
vi.mock('../src/icons.js', () => ({ I: {} }));
vi.mock('../src/config.js', () => ({ FB_CONFIG: {} }));
vi.mock('../src/env.js', () => ({ THC: new Map(), lsw }));
vi.mock('../src/render.js', () => ({ draw: vi.fn() }));
vi.mock('../src/notebooks.js', () => ({ render: vi.fn() }));

vi.stubGlobal('document', {
  querySelectorAll: () => [],
  addEventListener: (name, fn) => { listeners[name] = fn; }
});
vi.stubGlobal('addEventListener', () => {});
const { doSave, save, cloudInit } = await import('../src/cloud.js');

function database(docs = new Map()) {
  const db = {
    docs, commits: 0, failAt: 0, beforeCommit: null, afterCommit: null,
    doc: id => ({ id, get: async () => ({ exists: docs.has(id), data: () => ({ d: docs.get(id) }) }) }),
    get: async () => ({ docs: [...docs].map(([id, d]) => ({ id, data: () => ({ d }) })) }),
    firestore: {
      batch() {
        const writes = [];
        return {
          set(ref, data) { writes.push([ref.id, data.d]); },
          delete() { throw new Error('Published versions must not be deleted'); },
          async commit() {
            const index = ++db.commits;
            await db.beforeCommit?.(index);
            if (index === db.failAt) throw new Error('Simulated interrupted save');
            for (const [id, d] of writes) docs.set(id, d);
            await db.afterCommit?.(index);
          }
        };
      }
    }
  };
  return db;
}

function setup(count = 1, legacy = false) {
  const pages = Array.from({ length: count }, (_, i) => ({ id: 'p' + i, name: 'Page ' + i, els: [{ t: 'text', text: 'new' }] }));
  ST.S = { ts: 200, syncTs: 100, acct: '', cur: 'p0', nbs: [{ id: 'nb', name: 'Notebook', pages }] };
  ST.known = new Map(pages.map(p => [p.id, legacy ? { chunks: 1 } : { revision: 'old', chunks: 1 }]));
  const oldMeta = { ts: 100, nbs: [{ id: 'nb', name: 'Notebook', pages: pages.map(p => ({ id: p.id, name: p.name, ...(!legacy && ST.known.get(p.id)) })) }] };
  const docs = new Map([['meta', JSON.stringify(oldMeta)]]);
  for (const p of pages) {
    dirty.add(p.id);
    docs.set(legacy ? 'p_' + p.id + '_0' : pageDoc(p.id, 'old', 0), JSON.stringify({ els: [{ t: 'text', text: 'old' }] }));
  }
  ST.cdb = database(docs);
  return ST.cdb;
}
const read = db => decodePages(JSON.parse(db.docs.get('meta')), db.docs).pages;

beforeEach(() => {
  vi.clearAllMocks();
  dirty.clear();
  Object.assign(ST, { ready: true, pulling: false, act: null, curMeta: '', cstat: '', lt: null });
});
afterEach(() => { clearTimeout(ST.lt); });

describe('cloud saves', () => {
  it('keeps the previous snapshot readable between batches and publishes all pages together', async () => {
    const db = setup(401);
    const previous = JSON.parse(db.docs.get('meta'));
    db.afterCommit = index => {
      const texts = [...read(db).values()].map(els => els[0].text);
      expect(new Set(texts)).toEqual(new Set([index === 1 ? 'old' : 'new']));
    };
    await doSave();
    expect(db.commits).toBe(2);
    expect(ST.S.syncTs).toBe(200);
    expect(dirty.size).toBe(0);
    expect(report).not.toHaveBeenCalled();
    expect([...decodePages(previous, db.docs).pages.values()].every(els => els[0].text === 'old')).toBe(true);
  });
  it('keeps metadata, known versions and dirty pages intact after an interrupted save, then retries safely', async () => {
    const db = setup(401), known = new Map(ST.known);
    db.failAt = 2;
    await doSave();
    expect([...read(db).values()].every(els => els[0].text === 'old')).toBe(true);
    expect(ST.S.syncTs).toBe(100);
    expect(ST.known).toEqual(known);
    expect(dirty.size).toBe(401);
    expect(report).toHaveBeenCalledWith(expect.any(Error), 'Cloud save failed');
    db.failAt = 0;
    await doSave();
    expect([...read(db).values()].every(els => els[0].text === 'new')).toBe(true);
    expect(dirty.size).toBe(0);
  });
  it('migrates legacy pages on save without overwriting their old chunks', async () => {
    const db = setup(1, true), old = db.docs.get('p_p0_0');
    dirty.clear();
    await doSave();
    expect(db.docs.get('p_p0_0')).toBe(old);
    expect(ST.known.get('p0').revision).toBeTruthy();
    expect(read(db).get('p0')[0].text).toBe('new');
  });
  it('retains references to unchanged pages and only removes deleted pages from metadata', async () => {
    const db = setup(3);
    dirty.delete('p1');
    ST.S.nbs[0].pages.pop();
    await doSave();
    const result = read(db);
    expect(result.get('p0')[0].text).toBe('new');
    expect(result.get('p1')[0].text).toBe('old');
    expect(result.has('p2')).toBe(false);
    expect(db.docs.has(pageDoc('p2', 'old', 0))).toBe(true);
    expect(dirty.size).toBe(0);
  });
  it('publishes a page split across size-limited batches and can then shrink it safely', async () => {
    const db = setup(), page = ST.S.nbs[0].pages[0];
    page.els[0].text = 'x'.repeat(CH * 10);
    db.afterCommit = index => {
      const text = read(db).get('p0')[0].text;
      expect(text.length).toBe(index === 1 ? 3 : CH * 10);
    };
    await doSave();
    expect(db.commits).toBe(2);
    expect(ST.known.get('p0').chunks).toBeGreaterThan(1);
    db.afterCommit = null;
    page.els = [];
    dirty.add(page.id);
    save();
    await doSave();
    expect(read(db).get('p0')).toEqual([]);
    expect(ST.known.get('p0').chunks).toBe(1);
  });
  it('keeps edits made during a save dirty, including edits in the same millisecond', async () => {
    const db = setup();
    vi.spyOn(Date, 'now').mockReturnValue(200);
    db.beforeCommit = () => {
      ST.S.nbs[0].pages[0].els[0].text = 'edited while saving';
      save();
    };
    try {
      await doSave();
      expect(read(db).get('p0')[0].text).toBe('new');
      expect(ST.S.ts).toBe(201);
      expect(ST.S.syncTs).toBe(200);
      expect(dirty.has('p0')).toBe(true);
      expect(ST.cstat).toContain('unsaved changes');
    } finally {
      vi.restoreAllMocks();
    }
  });
  it('serializes repeated save requests', async () => {
    const db = setup();
    let resume;
    db.beforeCommit = () => new Promise(resolve => { resume = resolve; });
    const first = doSave(), second = doSave();
    expect(db.commits).toBe(1);
    resume();
    await Promise.all([first, second]);
    expect(db.commits).toBe(1);
  });
  it('does not apply save bookkeeping to a different account', async () => {
    const db = setup();
    db.beforeCommit = () => { ST.cdb = database(); };
    await doSave();
    expect(ST.S.syncTs).toBe(100);
    expect(dirty.has('p0')).toBe(true);
  });
});

describe('cloud loads', () => {
  async function login(db) {
    vi.stubGlobal('firebase', {
      initializeApp: vi.fn(),
      auth: () => ({ onAuthStateChanged: fn => fn({ uid: 'test-user', displayName: 'Test' }) }),
      firestore: () => ({ collection: () => ({ doc: () => ({ collection: () => db }) }) })
    });
    await cloudInit();
    await vi.waitFor(() => expect(ST.ready).toBe(true));
  }
  it('loads versioned contents through the actual cloud initialization flow', async () => {
    const db = setup();
    await login(db);
    expect(ST.S.nbs[0].pages[0].els[0].text).toBe('old');
    expect(ST.known.get('p0')).toEqual({ revision: 'old', chunks: 1 });
  });
  it('does not replace local data when a published chunk is missing', async () => {
    const db = setup(), old = ST.S.nbs;
    db.docs.delete(pageDoc('p0', 'old', 0));
    await login(db);
    expect(ST.S.nbs).toBe(old);
    expect(ST.S.nbs[0].pages[0].els[0].text).toBe('new');
    expect(report).toHaveBeenCalledWith(expect.any(Error), 'Cloud sync failed');
  });
});
