import { describe, expect, it } from 'vitest';
import { CH, chunks, planBatches, syncAction } from '../src/syncLogic.js';

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
