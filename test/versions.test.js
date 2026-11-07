import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state, records, idbp, report } = vi.hoisted(() => ({ state: {}, records: new Map(), idbp: vi.fn(), report: vi.fn() }));
vi.mock('../src/state.js', () => ({ P: () => state.page }));
vi.mock('../src/platform.js', () => ({ idbp }));
vi.mock('../src/report.js', () => ({ report }));
vi.stubGlobal('IDBKeyRange', { bound: (lower, upper) => ({ lower, upper }) });
const { snapshot, snapshotSoon, listVersions, getVersion, MIN_GAP, KEEP } = await import('../src/versions.js');

const keysIn = range => [...records.keys()].filter(k => k >= range.lower && k <= range.upper).sort();
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
  vi.clearAllMocks();
  records.clear();
  state.page = { id: crypto.randomUUID(), els: [{ t: 'text', text: 'original' }] };
  idbp.mockImplementation(async (store, mode, fn) => fn({
    put: (value, key) => records.set(key, structuredClone(value)),
    delete: key => records.delete(key),
    getAllKeys: keysIn,
    getAll: range => keysIn(range).map(key => records.get(key)),
    get: key => records.get(key)
  }));
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('page history', () => {
  it('skips absent and empty pages', async () => {
    await snapshot(null);
    await snapshot({ id: 'empty', els: [] });
    expect(idbp).not.toHaveBeenCalled();
  });
  it('stores an independent snapshot, enforces the five-minute gap, and allows a forced snapshot', async () => {
    const p = state.page, start = Date.now();
    await snapshot(p);
    p.els[0].text = 'edited';
    vi.setSystemTime(start + MIN_GAP - 1);
    await snapshot(p);
    expect(records.size).toBe(1);
    expect(await getVersion(p.id, start)).toEqual([{ t: 'text', text: 'original' }]);
    await snapshot(p, true);
    expect(records.size).toBe(2);
    vi.setSystemTime(start + 2 * MIN_GAP);
    await snapshot(p);
    expect(records.size).toBe(3);
  });
  it('keeps only the latest 20 snapshots per page without deleting another page’s history', async () => {
    const p = state.page, other = { ...p, id: 'other-page' }, start = Date.now();
    await snapshot(other);
    for (let i = 0; i < KEEP + 5; i++) {
      vi.setSystemTime(start + i * 1000);
      await snapshot(p, true);
    }
    const versions = await listVersions(p.id);
    expect(versions).toHaveLength(KEEP);
    expect(versions[0].ts).toBe(start + (KEEP + 4) * 1000);
    expect(versions.at(-1).ts).toBe(start + 5000);
    expect(await listVersions(other.id)).toHaveLength(1);
    expect(await getVersion(p.id, start)).toBeNull();
  });
  it('reports a storage failure quietly instead of rejecting the edit', async () => {
    const error = new Error('Storage unavailable');
    idbp.mockRejectedValueOnce(error);
    await expect(snapshot(state.page)).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledWith(error, 'Page history could not be saved', { quiet: true });
  });
  it('debounces edits and snapshots the page that was edited even after switching pages', async () => {
    const edited = state.page;
    snapshotSoon();
    await vi.advanceTimersByTimeAsync(10000);
    snapshotSoon();
    state.page = { id: 'different-page', els: [{ t: 'rect' }] };
    await vi.advanceTimersByTimeAsync(19999);
    expect(records.size).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(await listVersions(edited.id)).toHaveLength(1);
    expect(await listVersions(state.page.id)).toHaveLength(0);
  });
});
