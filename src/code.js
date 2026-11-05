// Code blocks: a small regex highlighter, canvas drawing, and an editor overlay with Tab and auto-indent.
import { P, ST } from './state.js';
import { $, esc, uid } from './util.js';
import { FF, needX } from './env.js';
import { OX, commit } from './render.js';
import { props } from './toolbar.js';
import { DARK, LANGS, LIGHT, tokenize } from './highlight.js';

/* ---------- highlighter lives in highlight.js ---------- */
const isDark = () => {
  const n = parseInt((ST.INK || '#000').slice(1), 16);
  return (.299 * (n >> 16) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255 > .5;
};
const palette = () => isDark() ? DARK : LIGHT;
const kindAt = (toks, i) => {
  for (const t of toks) {
    if (i < t.a) return null;
    if (i < t.b) return t.k;
  }
  return null;
};

/* ---------- geometry shared by canvas drawing and the editor ---------- */
export const PAD = 12;
const LH = 1.5;
// A new block opens as a window of this size; the user can resize it, long lines wrap inside it.
export const CODE_W = 560, CODE_H = 320;
const mono = fs => `${fs}px ${FF.mono}`;
export function codeMetrics(e) {
  const fs = e.fs || 18, ctx = ST.ctx;
  ctx.font = mono(fs);
  const lines = (e.text || '').split('\n'),
    cw = ctx.measureText('M').width,
    digits = String(lines.length).length,
    gut = e.nums === false ? 0 : Math.ceil(cw * Math.max(2, digits) + 14),
    per = Math.max(8, Math.floor((Math.abs(e.w || CODE_W) - gut - PAD * 2) / cw));
  // wrap by characters (the font is monospaced), so canvas and editor break lines at the same place
  const rows = [];
  let off = 0;
  lines.forEach((l, n) => {
    for (let a = 0; a === 0 || a < l.length; a += per) rows.push({ n, a: off + a, s: l.slice(a, a + per), first: a === 0 });
    off += l.length + 1;
  });
  return { fs, lines, rows, per, cw, gut, lh: fs * LH };
}
// Keeps the chosen size, but grows the window down when the wrapped code needs more room.
export function codeFit(e) {
  if (!e.w) e.w = CODE_W;
  e.w = Math.max(200, Math.abs(e.w));
  const m = codeMetrics(e);
  e.h = Math.max(Math.abs(e.h) || CODE_H, 60, m.rows.length * m.lh + PAD * 2);
}

/* ---------- canvas drawing ---------- */
export function drawCode(e) {
  if (e.hide) return;
  needX();
  const ctx = ST.ctx, pal = palette(), dark = isDark(), m = codeMetrics(e);
  const r = 8;
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = dark ? '#1b1f2a' : '#f3f4f7';
  ctx.strokeStyle = dark ? '#343b4d' : '#d5d9e0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(e.x, e.y, e.w, e.h, r);
  ctx.fill();
  ctx.stroke();
  ctx.clip();
  ctx.font = mono(m.fs);
  ctx.textBaseline = 'top';
  const toks = tokenize(e.lang || 'js', e.text || ''), x0 = e.x + PAD + m.gut;
  m.rows.forEach((row, i) => {
    const y = e.y + PAD + i * m.lh + (m.lh - m.fs) / 2;
    if (m.gut && row.first) {
      ctx.fillStyle = dark ? '#5d667a' : '#9aa1ae';
      ctx.textAlign = 'right';
      ctx.fillText(String(row.n + 1), e.x + m.gut - 8, y);
    }
    ctx.textAlign = 'left';
    // draw one run at a time so each token keeps its color
    let a = 0;
    const l = row.s;
    while (a < l.length) {
      const k = kindAt(toks, row.a + a);
      let b = a + 1;
      while (b < l.length && kindAt(toks, row.a + b) === k) b++;
      ctx.fillStyle = (k && pal[k]) || (dark ? '#e6e9ef' : '#1c2230');
      ctx.fillText(l.slice(a, b), x0 + a * m.cw, y);
      a = b;
    }
  });
  if (m.gut) {
    ctx.strokeStyle = dark ? '#343b4d' : '#d5d9e0';
    ctx.beginPath();
    ctx.moveTo(e.x + m.gut, e.y + 6);
    ctx.lineTo(e.x + m.gut, e.y + e.h - 6);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- editor overlay ---------- */
function toHTML(text, lang) {
  const toks = tokenize(lang, text), pal = palette();
  let h = '', i = 0;
  const plain = (a, b) => esc(text.slice(a, b)).replace(/'/g, '&#39;');
  toks.forEach(t => {
    h += plain(i, t.a) + `<span style="color:${pal[t.k] || 'inherit'}">${plain(t.a, t.b)}</span>`;
    i = t.b;
  });
  return h + plain(i, text.length) + '\n';
}
export function openCode(x, y, e0) {
  needX();
  const v = P().v, fs = e0 ? e0.fs || 18 : ST.cfs || 18, W = e0 ? e0.w : CODE_W, H = e0 ? e0.h : CODE_H;
  let lang = e0 ? e0.lang || 'js' : ST.clang || 'js';
  const wrap = document.createElement('div'),
    gut = document.createElement('div'),
    pre = document.createElement('pre'),
    t = document.createElement('textarea'),
    bar = document.createElement('div');
  wrap.className = 'codeed';
  wrap.style.cssText = `left:${x * v.z + v.x + OX() * v.z}px;top:${y * v.z + v.y}px;width:${W * v.z}px;min-height:${H * v.z}px;font:${fs * v.z}px ${FF.mono};line-height:${LH};padding:${PAD * v.z}px`;
  wrap.classList.toggle('dk', isDark());
  gut.className = 'cg';
  pre.className = 'cp';
  pre.setAttribute('aria-hidden', 'true');
  t.className = 'ct';
  t.value = e0 ? e0.text : '';
  t.spellcheck = false;
  t.setAttribute('autocapitalize', 'off');
  t.setAttribute('aria-label', 'Code editor');
  t.wrap = 'soft';
  bar.className = 'cb';
  bar.innerHTML = '<select aria-label="Language">' + Object.keys(LANGS).map(k => `<option value="${k}"${k === lang ? ' selected' : ''}>${LANGS[k][0]}</option>`).join('') + '</select><label><input type="checkbox" class="nums"' + (!e0 || e0.nums !== false ? ' checked' : '') + '> Line numbers</label><button class="b" type="button">Done</button>';
  const box = document.createElement('div');
  box.className = 'cbox';
  box.append(pre, t);
  wrap.append(bar, gut, box);
  $('#main').append(wrap);
  ST.ed = t;
  if (e0) {
    e0.hide = true;
  }
  // same wrapping as the canvas: numbers only on the first row of each line, blank rows for its continuations
  const sync = () => {
    const nums = bar.querySelector('.nums').checked, m = codeMetrics({ text: t.value, fs, w: W, nums });
    gut.hidden = !nums;
    gut.style.width = m.gut * v.z + 'px';
    gut.textContent = nums ? m.rows.map(r => r.first ? r.n + 1 : '').join('\n') : '';
    pre.innerHTML = toHTML(t.value, lang);
    const cw = m.per * m.cw * v.z;
    t.style.width = pre.style.width = cw + 1 + 'px';
    t.style.height = pre.style.height = Math.max(m.rows.length * fs * LH, H - PAD * 2) * v.z + 'px';
  };
  sync();
  setTimeout(() => {
    t.focus();
    t.selectionStart = t.selectionEnd = t.value.length;
  }, 0);
  const ins = (s, a = t.selectionStart, b = t.selectionEnd) => {
    t.setRangeText(s, a, b, 'end');
    sync();
  };
  t.addEventListener('input', sync);
  bar.addEventListener('change', e => {
    if (e.target.tagName === 'SELECT') {
      lang = e.target.value;
      ST.clang = lang;
    }
    sync();
  });
  t.addEventListener('keydown', k => {
    k.stopPropagation();
    if (k.key === 'Escape') {
      t.blur();
      return;
    }
    if (k.key === 'Tab') {
      k.preventDefault();
      const s = t.selectionStart, en = t.selectionEnd, v0 = t.value;
      const ls = v0.lastIndexOf('\n', s - 1) + 1;
      if (s === en && !k.shiftKey) return ins('    ');
      const block = v0.slice(ls, en), lines = block.split('\n');
      t.setRangeText(lines.map(l => k.shiftKey ? l.replace(/^( {1,4}|\t)/, '') : '    ' + l).join('\n'), ls, en, 'select');
      sync();
      return;
    }
    if (k.key === 'Enter' && !k.shiftKey && !k.metaKey && !k.ctrlKey) {
      k.preventDefault();
      const s = t.selectionStart, line = t.value.slice(t.value.lastIndexOf('\n', s - 1) + 1, s);
      const indent = (line.match(/^[ \t]*/) || [''])[0];
      const more = /[{(\[:]\s*$/.test(line) ? '    ' : '';
      ins('\n' + indent + more);
    }
  });
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    ST.ed = null;
    const s = t.value, nums = bar.querySelector('.nums').checked;
    wrap.remove();
    if (e0) {
      delete e0.hide;
      if (s.trim()) {
        Object.assign(e0, { text: s, lang, nums });
        codeFit(e0);
      } else {
        P().els = P().els.filter(q => q !== e0);
        ST.sel = null;
      }
      commit();
      props();
    } else if (s.trim()) {
      const e = { id: uid(), t: 'code', x, y, w: CODE_W, h: CODE_H, stroke: ST.stroke, fill: 'none', sw: 1, seed: 1, text: s, lang, fs, nums };
      codeFit(e);
      P().els.push(e);
      ST.sel = e.id;
      commit();
      props();
    }
  };
  wrap.addEventListener('focusout', ev => {
    if (!wrap.contains(ev.relatedTarget)) done();
  });
  bar.querySelector('button').onclick = () => done();
}
