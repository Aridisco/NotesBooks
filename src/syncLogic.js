// Pure helpers for cloud sync (no DOM, no Firebase) so they can be unit-tested.

export const CH = 300000;

// Split a JSON string into Firestore-sized pieces without cutting a surrogate pair in half.
export function chunks(j) {
  const o = [];
  let p = 0;
  while (p < j.length) {
    let e = Math.min(p + CH, j.length);
    if (e < j.length) {
      const c = j.charCodeAt(e - 1);
      if (c >= 0xD800 && c <= 0xDBFF) e--;
    }
    o.push(j.slice(p, e));
    p = e;
  }
  return o.length ? o : [''];
}

// Group write ops into batches under Firestore's limits. `last` (the meta write) always goes in
// the final batch, so other devices only see the new version once every page chunk is stored.
// shortcut: a flush bigger than one batch is not atomic across batches, only the meta-last order protects it.
export function planBatches(ops, last, maxOps = 400, maxBytes = 8e6) {
  const size = o => ((o.data && o.data.d) || '').length * 3; // UTF-16 length x3 covers worst-case UTF-8
  const out = [];
  let cur = [], bytes = 0;
  for (const o of [...ops, last]) {
    if (cur.length && (cur.length >= maxOps || bytes + size(o) > maxBytes)) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(o);
    bytes += size(o);
  }
  out.push(cur);
  return out;
}

// Decide what to do when the cloud `meta` document is newer than what this device last synced.
// m: parsed cloud meta ({ts}), same: this device last synced with this account,
// changed: this device has local edits not yet saved.
export function syncAction({ m, same, changed, lastWrite, syncTs }) {
  if (m.ts === lastWrite) return 'none'; // our own write
  if (same && m.ts <= (syncTs || 0)) return 'none'; // nothing new in the cloud
  if (same && changed) return 'conflict'; // both sides edited since the last sync
  return changed ? 'merge' : 'pull'; // 'merge' keeps local notebooks that the cloud lacks
}
