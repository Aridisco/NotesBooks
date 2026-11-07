import { describe, expect, it } from 'vitest';
import { CH, chunks, planBatches, syncAction, pageDoc, decodePages } from '../src/syncLogic.js';

describe('chunks', () => {
  it('returns one empty piece for an empty string', () => {
    expect(chunks('')).toEqual(['']);
  });
  it('splits long text and joins back losslessly', () => {
    const s = 'a'.repeat(CH * 2 + 5);
    const c = chunks(s);
    expect(c).toHaveLength(3);
    expect(c.join('')).toBe(s);
  });
  it('never cuts a surrogate pair in half', () => {
    const s = 'a'.repeat(CH - 1) + '😀' + 'b'.repeat(10);
    const c = chunks(s);
    expect(c.join('')).toBe(s);
    c.forEach(p => expect(/[\uD800-\uDBFF]$/.test(p)).toBe(false));
  });
});

describe('planBatches', () => {
  const op = (i, n = 10) => ({ ref: 'r' + i, data: { d: 'x'.repeat(n) } });
  const meta = { ref: 'meta', data: { d: '{}' } };
  it('puts everything in one batch when it fits, meta last', () => {
    const g = planBatches([op(1), op(2)], meta);
    expect(g).toHaveLength(1);
    expect(g[0].at(-1)).toBe(meta);
  });
  it('splits by operation count and keeps meta in the final batch only', () => {
    const g = planBatches(Array.from({ length: 5 }, (_, i) => op(i)), meta, 2);
    expect(g.length).toBeGreaterThan(1);
    expect(g.flat().filter(o => o === meta)).toHaveLength(1);
    expect(g.at(-1).at(-1)).toBe(meta);
    g.forEach(b => expect(b.length).toBeLessThanOrEqual(2));
  });
  it('splits by size', () => {
    const g = planBatches([op(1, 100), op(2, 100)], meta, 400, 400);
    expect(g.length).toBeGreaterThan(1);
  });
  it('still writes meta when there is nothing else', () => {
    expect(planBatches([], meta)).toEqual([[meta]]);
  });
});

describe('syncAction', () => {
  const base = { m: { ts: 200 }, same: true, changed: false, lastWrite: 0, syncTs: 100 };
  it('ignores our own write', () => {
    expect(syncAction({ ...base, lastWrite: 200 })).toBe('none');
  });
  it('ignores a cloud copy that is not newer', () => {
    expect(syncAction({ ...base, m: { ts: 100 } })).toBe('none');
  });
  it('pulls when only the cloud changed', () => {
    expect(syncAction(base)).toBe('pull');
  });
  it('asks the user when both sides changed', () => {
    expect(syncAction({ ...base, changed: true })).toBe('conflict');
  });
  it('merges when a different account has local, unsynced notebooks', () => {
    expect(syncAction({ ...base, same: false, changed: true })).toBe('merge');
  });
  it('pulls on a fresh device or another account without local data', () => {
    expect(syncAction({ ...base, same: false, changed: false })).toBe('pull');
  });
});

describe('decodePages', () => {
  const meta = p => ({ nbs: [{ pages: [{ id: 'abc', name: 'Notes', ...p }] }] });
  const json = JSON.stringify({ els: [{ t: 'text', text: 'hello' }] });
  const expected = [{ t: 'text', text: 'hello' }];
  it('reads only the published version and ignores partial and damaged orphan versions', () => {
    const docs = new Map([
      [pageDoc('abc', 'old', 0), json.slice(0, 10)],
      [pageDoc('abc', 'old', 1), json.slice(10)],
      [pageDoc('abc', 'new', 0), 'incomplete'],
      ['p_removed_0', 'damaged']
    ]);
    const result = decodePages(meta({ revision: 'old', chunks: 2 }), docs);
    expect(result.pages.get('abc')).toEqual(expected);
    expect(result.known.get('abc')).toEqual({ revision: 'old', chunks: 2 });
  });
  it.each([
    [['p_abc', json]],
    [['p_abc_0', json]],
    [['p_abc_0', json.slice(0, 10)], ['p_abc_1', json.slice(10)]]
  ])('reads the previous cloud format %#', (...entries) => {
    expect(decodePages(meta({}), new Map(entries)).pages.get('abc')).toEqual(expected);
  });
  it.each([
    [{ revision: 'missing', chunks: 1 }, [['p_abc_0', json]]],
    [{ revision: 'old', chunks: 2 }, [[pageDoc('abc', 'old', 0), json]]],
    [{ revision: 'old', chunks: 0 }, []],
    [{ revision: 'old', chunks: -1 }, []],
    [{ revision: 'old', chunks: 1.5 }, []],
    [{ revision: 'old', chunks: Number.MAX_SAFE_INTEGER }, []],
    [{ revision: '../other', chunks: 1 }, []],
    [{ chunks: 1 }, [['p_abc_0', json]]],
    [{}, []],
    [{}, [['p_abc_0', json.slice(0, 10)], ['p_abc_2', json.slice(10)]]],
    [{}, [['p_abc_0', '{"els":null}']]],
    [{}, [['p_abc_0', 'not json']]],
    [{}, [['p_abc_999999999999999', json]]]
  ])('rejects damaged or missing page contents %#', (p, entries) => {
    expect(() => decodePages(meta(p), new Map(entries))).toThrow('Nothing was replaced');
  });
  it.each([null, {}, { nbs: [] }, { nbs: [null] }, { nbs: [{ pages: [] }] }])('rejects invalid cloud metadata %#', m => {
    expect(() => decodePages(m, new Map())).toThrow('Invalid cloud');
  });
  it('rejects duplicate page identities', () => {
    const m = meta({}), p = m.nbs[0].pages[0];
    m.nbs[0].pages.push({ ...p });
    expect(() => decodePages(m, new Map([['p_abc_0', json]]))).toThrow('Nothing was replaced');
  });
});
