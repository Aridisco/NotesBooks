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

// Only write immutable page versions before `last` publishes their references in meta.
// Putting meta last is not sufficient if earlier batches overwrite published chunks.
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

export const pageDoc = (id, revision, i) => 'p_' + id + '_' + revision + '_' + i;

// Decode only pages referenced by this meta snapshot; incomplete, unpublished versions are ignored.
export function decodePages(meta, docs) {
  if (!meta || !Array.isArray(meta.nbs) || !meta.nbs.length) throw new Error('Invalid cloud notebooks');
  const pages = new Map(), known = new Map();
  for (const n of meta.nbs) {
    if (!n || !Array.isArray(n.pages) || !n.pages.length) throw new Error('Invalid cloud pages');
    for (const p of n.pages) {
      try {
        if (!p || typeof p.id !== 'string' || !p.id || pages.has(p.id)) throw new Error('Invalid page identity');
        let parts = [], version;
        if (p.revision !== undefined || p.chunks !== undefined) {
          if (typeof p.revision !== 'string' || !/^[a-z0-9-]+$/.test(p.revision) ||
              !Number.isInteger(p.chunks) || p.chunks < 1 || p.chunks > docs.size) throw new Error('Invalid page version');
          for (let i = 0; i < p.chunks; i++) parts.push(docs.get(pageDoc(p.id, p.revision, i)));
          version = { revision: p.revision, chunks: p.chunks };
        } else {
          const prefix = 'p_' + p.id + '_';
          for (const [id, d] of docs) {
            const suffix = id.slice(prefix.length);
            if (id.startsWith(prefix) && /^\d+$/.test(suffix)) {
              const i = Number(suffix);
              if (!Number.isSafeInteger(i) || i >= docs.size) throw new Error('Invalid chunk index');
              parts[i] = d;
            }
          }
          version = { chunks: parts.length };
          if (!parts.length) parts = [docs.get('p_' + p.id)];
        }
        for (let i = 0; i < parts.length; i++) if (typeof parts[i] !== 'string') throw new Error('Missing chunk');
        const els = JSON.parse(parts.join('')).els;
        if (!Array.isArray(els)) throw new Error('Invalid page contents');
        pages.set(p.id, els);
        known.set(p.id, version);
      } catch (e) {
        throw new Error('The cloud copy of ' + (p?.name || p?.id || 'a page') + ' is damaged. Nothing was replaced.', { cause: e });
      }
    }
  }
  return { pages, known };
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
