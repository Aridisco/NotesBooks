// A backup file is trusted only if every notebook, page and element has the shape the app reads.
export function isValidBackup(d) {
  return !!d && Array.isArray(d.nbs) && d.nbs.every(n =>
    n && typeof n.name === 'string' && Array.isArray(n.pages) && n.pages.length &&
    n.pages.every(p => p && typeof p.name === 'string' &&
      (p.els == null || (Array.isArray(p.els) && p.els.every(x => x && typeof x.t === 'string')))));
}
