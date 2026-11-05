import './util.js';
import './state.js';
import './cloud.js';
import './env.js';
import './render.js';
import './notebooks.js';
import './input.js';
import './edit.js';
import './circuit.js';
import './objects.js';
import './platform.js';
import './books.js';
import './voice.js';
import './reader.js';
import './math.js';
import './toolbar.js';
import './a11y.js';
import './versions.js';
import './palette.js';
import { P, ST } from './state.js';
import { cloudInit } from './cloud.js';
import { CC, FF, resize } from './env.js';
import { draw, renderNow, tfit } from './render.js';
import { load } from './notebooks.js';
import { props, setTool } from './toolbar.js';

setTool('select');
props();
resize();
load();
ST.boot = false;
cloudInit();
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => {
  for (const k in CC) delete CC[k];
  draw();
});
document.fonts && Promise.all([FF.hand, FF.sans].map(f => document.fonts.load('500 20px ' + f))).then(() => {
  P().els.forEach(e => e.t === 'text' && tfit(e));
  draw();
});
// dev-only handle for benchmarks and debugging from the console
if (import.meta.env.DEV) import('./scene.js').then(m => window.__sk = { ST, P, draw, renderNow, load, setRenderer: m.setRenderer });
