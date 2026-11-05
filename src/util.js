export const $ = s => document.querySelector(s);
export const uid = () => Math.random().toString(36).slice(2, 9);
export const esc = s => s.replace(/[&<>"]/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
})[c]);
export const cv = $('#cv');
