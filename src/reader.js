import { ST } from './state.js';
import { $, esc } from './util.js';
import { resize } from './env.js';
import { nbOf } from './notebooks.js';
import { I } from './icons.js';

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
  return (ST.bkForm ? '<div class="bkf"><input id="bkt" placeholder="Book title" aria-label="Book title"><input id="bku" type="url" placeholder="https://… link to the book" aria-label="Link to the book"><button class="pill pri" data-a="bkok">Add</button><button class="pill" data-a="bklink">Cancel</button></div>' : '') + (L.length ? '<div class="bks">' + L.map(b => `<div class="bkc"><span class="bi">${I.book}</span><div class="nm"><b>${esc(b.title)}</b><small>${esc(hostOf(b.url))}</small></div><button class="pill" data-a="bkside" data-id="${b.id}" title="Read it next to your notes">Read beside notes</button><button class="pill" data-a="bkopen" data-id="${b.id}">Open</button><button class="ib sm" data-a="bkdel" data-id="${b.id}" title="Remove book" aria-label="Remove book ${esc(b.title)}">${I.x}</button></div>`).join('') + '</div>' : '');
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
$('#bkpop').onclick = e => {
  const b = e.target.closest('[data-bk]');
  if (!b) return;
  const bk = (nbOf(ST.S.cur).books || []).find(x => x.id === b.dataset.bk);
  $('#bkpop').hidden = true;
  if (bk) openReader(bk);
};
/* math */
