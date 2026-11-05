// Central error sink: always log, and tell the user unless the failure is harmless.
let timer = 0;

export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { el.hidden = true; }, 8000);
}

export function report(err, where, { quiet = false } = {}) {
  console.error('[sketchbooks] ' + where, err);
  if (!quiet) toast(where + ': ' + ((err && (err.message || err.code)) || err));
}
