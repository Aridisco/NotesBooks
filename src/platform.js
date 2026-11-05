import { ST } from './state.js';
import { $ } from './util.js';
import { resize } from './env.js';

/* full screen */
let FSS = false;
export function toggleFS() {
  const d = document,
    el = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  } catch (e) {}
}
['fullscreenchange', 'webkitfullscreenchange'].forEach(n => document.addEventListener(n, () => {
  const f = !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (f) {
    FSS = $('#side').classList.contains('hide');
    $('#side').classList.add('hide');
  } else if (FSS === false) $('#side').classList.remove('hide');
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
    const r = indexedDB.open('sketchbooks-db', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('books');
      r.result.createObjectStore('audio');
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
