import { ST } from './state.js';
import { resize } from './env.js';

/* full screen */
export function toggleFS() {
  const d = document,
    el = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  } catch (e) {}
}
['fullscreenchange', 'webkitfullscreenchange'].forEach(n => document.addEventListener(n, () => {
  setTimeout(resize, 80);
}));
/* battery */
try {
  navigator.getBattery && navigator.getBattery().then(b => {
    const u = () => {
      const v = !b.charging && b.level < .25;
      if (v !== ST.BATLOW) {
        ST.BATLOW = v;
        resize();
      }
    };
    u();
    b.addEventListener('levelchange', u);
    b.addEventListener('chargingchange', u);
  });
} catch (e) {}
/* local storage for books and audio */
const IDB = new Promise((ok, no) => {
  try {
    const r = indexedDB.open('sketchbooks-db', 2);
    r.onupgradeneeded = () => {
      for (const n of ['books', 'audio', 'versions']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n);
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  } catch (e) {
    no(e);
  }
});
IDB.catch(() => {});
export const idbp = (st, mode, fn) => IDB.then(db => new Promise((ok, no) => {
  const t = db.transaction(st, mode),
    q = fn(t.objectStore(st));
  t.oncomplete = () => ok(q && q.result);
  t.onerror = () => no(t.error);
}));
