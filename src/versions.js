// Local page history: occasional snapshots of a page's objects, kept in IndexedDB (this device only).
import { P } from './state.js';
import { idbp } from './platform.js';
import { report } from './report.js';

export const MIN_GAP = 5 * 60e3; // at most one automatic snapshot per page every 5 minutes
export const KEEP = 20;
const last = new Map(); // page id -> time of its latest snapshot
const range = pid => IDBKeyRange.bound(pid + '|', pid + '|￿');

export async function snapshot(p, force = false) {
  const now = Date.now();
  if (!p || !p.els.length || (!force && now - (last.get(p.id) || 0) < MIN_GAP)) return;
  last.set(p.id, now);
  try {
    await idbp('versions', 'readwrite', s => s.put({ pid: p.id, ts: now, n: p.els.length, els: JSON.stringify(p.els) }, p.id + '|' + now));
    const keys = await idbp('versions', 'readonly', s => s.getAllKeys(range(p.id)));
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) await idbp('versions', 'readwrite', s => s.delete(k));
  } catch (e) {
    report(e, 'Page history could not be saved', { quiet: true });
  }
}
let timer = 0;
// Called after every edit: waits for a pause, then snapshots if the gap has passed.
export function snapshotSoon() {
  clearTimeout(timer);
  const p = P();
  timer = setTimeout(() => snapshot(p), 20e3);
}
export async function listVersions(pid) {
  const all = await idbp('versions', 'readonly', s => s.getAll(range(pid)));
  return all.map(v => ({ ts: v.ts, n: v.n })).sort((a, b) => b.ts - a.ts);
}
export async function getVersion(pid, ts) {
  const v = await idbp('versions', 'readonly', s => s.get(pid + '|' + ts));
  return v ? JSON.parse(v.els) : null;
}
