import { ST } from './state.js';
import { $, esc } from './util.js';
import { resize } from './env.js';
import { nbOf } from './notebooks.js';

ST.bkForm = false;
export const hostOf = u => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch (e) {
    return u;
  }
};
export const bkHTML = n => {
  const L = n.books || [];
  return (ST.bkForm ? '<div class="hd bkf"><input id="bkt" placeholder="Book title"><input id="bku" placeholder="https://… link to the book"><button class="b" data-a="bkok">Add</button><button class="b" data-a="bklink">Cancel</button></div>' : '') + (L.length ? '<div class="bks">' + L.map(b => `<div class="bkc"><span class="bi">📖</span><div class="nm"><b>${esc(b.title)}</b><small>${esc(hostOf(b.url))}</small></div><button class="b" data-a="bkopen" data-id="${b.id}">Open ↗</button><button class="b" data-a="bkside" data-id="${b.id}" title="Read it next to your notes" aria-label="Read it next to your notes">Side panel</button><button class="b" data-a="bkdel" data-id="${b.id}">×</button></div>`).join('') + '</div>' : '');
};
export function openReader(b) {
  $('#rt').textContent = b.title;
  $('#ro').href = b.url;
  $('#rf').src = b.url;
  $('#reader').hidden = false;
  setTimeout(resize, 30);
}
$('#rx').onclick = () => {
  $('#reader').hidden = true;
  $('#rf').src = 'about:blank';
  setTimeout(resize, 30);
};
export const booksBtn = () => {
  const n = nbOf(ST.S.cur);
  return n && (n.books || []).length ? '<button class="wb" data-a="books" title="Linked books" aria-label="Linked books">📖</button>' : '';
};
$('#bkpop').onclick = e => {
  const b = e.target.closest('[data-bk]');
  if (!b) return;
  const bk = (nbOf(ST.S.cur).books || []).find(x => x.id === b.dataset.bk);
  $('#bkpop').hidden = true;
  if (bk) openReader(bk);
};
/* math */
