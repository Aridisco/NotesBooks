// Command palette (Ctrl/Cmd+K): search tools, actions and pages from one box.
import { P, ST, dirty } from './state.js';
import { $, uid } from './util.js';
import { askChoice } from './dialog.js';
import { commit, undo } from './render.js';
import { exportPDF, exportPNG, fitAll } from './edit.js';
import { load, nbOf, newNotebook, render } from './notebooks.js';
import { props, setTool, toggleTheme } from './toolbar.js';
import { snapshot, listVersions, getVersion } from './versions.js';
import { toast } from './report.js';

const fmt = ts => new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export async function pageHistory() {
  const p = P();
  let list = [];
  try {
    list = await listVersions(p.id);
  } catch (e) {
    return toast('Page history is not available in this browser.');
  }
  if (!list.length) return toast('No saved versions yet. They are kept automatically while you work.');
  const pick = await askChoice('Page history', 'Restore "' + p.name + '" to an earlier version. The current version is saved first.',
    list.map(v => ({ label: fmt(v.ts) + ' · ' + v.n + ' objects', value: String(v.ts) })).concat([{ label: 'Cancel', value: '' }]), '');
  if (!pick) return;
  const els = await getVersion(p.id, +pick);
  if (!els) return toast('That version could not be read.');
  await snapshot(p, true);
  p.els = els;
  ST.sel = null;
  ST.msel = [];
  dirty.add(p.id);
  commit();
  props();
}
export const exportPagePDF = () => exportPDF([P()], P().name || 'page');
export const exportBookPDF = () => {
  const nb = nbOf(P().id);
  return exportPDF(nb.pages, nb.name || 'notebook');
};

function newPage() {
  const n = nbOf(P().id),
    p = { id: uid(), name: 'Page ' + (n.pages.length + 1), els: [], v: { x: 0, y: 0, z: 1 } };
  n.pages.push(p);
  ST.S.cur = p.id;
  load();
}
const TOOLS = [['select', 'Select'], ['free', 'Pen'], ['hl', 'Highlighter'], ['rect', 'Rectangle'], ['diamond', 'Diamond'], ['ellipse', 'Ellipse'], ['poly', 'Polygon'], ['arrow', 'Arrow'], ['curve', 'Curved arrow'], ['line', 'Line'], ['text', 'Text'], ['code', 'Code block'], ['math', 'Formula and graph'], ['table', 'Table'], ['eraser', 'Eraser'], ['hand', 'Pan']];
function commands() {
  const c = TOOLS.map(([t, n]) => ({ label: 'Tool: ' + n, run: () => setTool(t) }));
  c.push(
    { label: 'Undo', run: () => undo(-1) },
    { label: 'Redo', run: () => undo(1) },
    { label: 'Fit page to screen', run: () => { fitAll(); props(); } },
    { label: 'Toggle properties panel', run: () => { ST.panel = !ST.panel; props(); } },
    { label: 'Toggle light / dark', run: () => { toggleTheme(); props(); } },
    { label: 'Go to notebook pages', run: () => { ST.S.view = 'book'; ST.S.book = nbOf(ST.S.cur).id; render(); } },
    { label: 'Go to all notebooks', run: () => { ST.S.view = 'shelf'; render(); } },
    { label: 'New page', run: newPage },
    { label: 'New notebook', run: newNotebook },
    { label: 'Export page as PNG', run: exportPNG },
    { label: 'Export page as PDF', run: exportPagePDF },
    { label: 'Export notebook as PDF', run: exportBookPDF },
    { label: 'Page history', run: pageHistory },
    { label: 'Download backup', run: () => $('#bak').click() },
    { label: 'Import backup', run: () => $('#imp').click() }
  );
  ST.S.nbs.forEach(n => n.pages.forEach(p => c.push({ label: 'Go to: ' + n.name + ' › ' + p.name, run: () => { ST.S.cur = p.id; load(); } })));
  return c;
}
export function openPalette() {
  if (document.getElementById('pal')) return;
  const d = document.createElement('dialog'),
    all = commands();
  d.id = 'pal';
  d.className = 'pal';
  d.setAttribute('aria-label', 'Command palette');
  d.innerHTML = '<input type="text" placeholder="Type a command or page name" aria-label="Search commands" autocomplete="off" spellcheck="false"><div class="pl" role="listbox"></div>';
  const inp = d.querySelector('input'),
    list = d.querySelector('.pl');
  let shown = [], at = 0;
  const paint = () => {
    const q = inp.value.toLowerCase().split(/\s+/).filter(Boolean);
    shown = all.filter(x => q.every(w => x.label.toLowerCase().includes(w))).slice(0, 30);
    at = Math.min(at, Math.max(0, shown.length - 1));
    list.innerHTML = shown.map((x, i) => `<button type="button" role="option" aria-selected="${i === at}" class="${i === at ? 'on' : ''}" data-i="${i}"></button>`).join('') || '<small>No matches</small>';
    list.querySelectorAll('button').forEach((b, i) => b.textContent = shown[i].label);
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  const run = i => {
    const x = shown[i];
    d.close();
    if (x) setTimeout(x.run, 0);
  };
  inp.addEventListener('input', () => { at = 0; paint(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      at = Math.max(0, Math.min(shown.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)));
      paint();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(at);
    }
  });
  list.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) run(+b.dataset.i);
  });
  d.addEventListener('click', e => {
    if (e.target === d) d.close();
  });
  d.addEventListener('close', () => setTimeout(() => d.remove(), 250)); // stays in the DOM while its fade-out plays
  document.body.append(d);
  paint();
  d.showModal();
  inp.focus();
}
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !ST.ed) {
    e.preventDefault();
    openPalette();
  }
});
