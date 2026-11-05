import { describe, expect, it } from 'vitest';
import { covered, delCol, delRow, insCol, insRow, merge, mergeAt, tgeo } from '../src/tableOps.js';
import { gcd2, nums, stats } from '../src/stats.js';

const table = () => ({ x: 0, y: 0, w: 300, h: 90, nr: 3, nc: 3, cells: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']] });

describe('table geometry', () => {
  it('splits an old table evenly and keeps per-column widths after a resize', () => {
    const e = table(), g = tgeo(e);
    expect(g.cw).toEqual([100, 100, 100]);
    e.w = 600;
    expect(tgeo(e).xs).toEqual([0, 200, 400, 600]);
  });
});

describe('table edits', () => {
  it('inserts and deletes rows and columns anywhere', () => {
    const e = table();
    insRow(e, 1, 0);
    expect(e.nr).toBe(4);
    expect(e.cells.map(r => r[0])).toEqual(['a', '', 'd', 'g']);
    expect(e.h).toBe(120);
    insCol(e, 0, 0);
    expect(e.cells[0]).toEqual(['', 'a', 'b', 'c']);
    delRow(e, 1);
    delCol(e, 0);
    expect(e.cells).toEqual(table().cells);
    expect(e.w).toBe(300);
  });
  it('merges right and down, keeping the text of absorbed cells', () => {
    const e = table();
    expect(merge(e, 0, 0, false)).toBeUndefined();
    expect(merge(e, 0, 0, true)).toBeUndefined();
    expect(mergeAt(e, 1, 1)).toEqual({ r: 0, c: 0, rs: 2, cs: 2 });
    expect(covered(e, 1, 1)).toBe(true);
    expect(covered(e, 0, 0)).toBe(false);
    expect(e.cells[0][0]).toBe('a\nb\nd\ne');
  });
  it('shrinks a merge when a row inside it is deleted, and moves its text when the top row goes', () => {
    const e = table();
    merge(e, 0, 0, true);
    delRow(e, 0);
    expect(e.mg).toEqual([]);
    expect(e.cells[0][0]).toBe('a\nd');
  });
  it('refuses to absorb a merged block that sticks out of the new area', () => {
    const e = table();
    merge(e, 1, 1, true);
    expect(merge(e, 1, 0, false)).toMatch(/Unmerge/);
  });
  it('moves cell styles along with inserted rows', () => {
    const e = table();
    e.cs = { '1,1': { bg: '#fff' } };
    insRow(e, 0, 0);
    expect(e.cs).toEqual({ '2,1': { bg: '#fff' } });
  });
});

describe('statistics', () => {
  it('parses lists and computes descriptive statistics', () => {
    expect(nums('3,5;5,8,10')).toEqual([3, 5, 5, 8, 10]);
    const t = stats([3, 5, 5, 8, 10]);
    expect(t).toContain('\\bar{x} & 6.2');
    expect(t).toContain('\\text{median} & 5');
    expect(t).toContain('\\text{mode} & 5');
    expect(t).toContain('(\\text{sample}) & 2.7749');
  });
  it('computes the greatest common divisor', () => {
    expect([12, 18, 30].reduce(gcd2)).toBe(6);
  });
});
