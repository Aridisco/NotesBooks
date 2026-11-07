export const $ = s => document.querySelector(s);
export const uid = () => Math.random().toString(36).slice(2, 9);
export const esc = s => s.replace(/[&<>"]/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
})[c]);
export const cv = $('#cv');
// Spoken names for the preset colors, so assistive tech and tooltips don't read hex codes.
const CN = { auto: 'Auto', none: 'None', '#e03131': 'Red', '#f08c00': 'Orange', '#2f9e44': 'Green', '#1971c2': 'Blue', '#74c0fc': 'Light blue', '#c2255c': 'Pink', '#7048e8': 'Purple',
  '#ffc9c9': 'Light red', '#b2f2bb': 'Light green', '#a5d8ff': 'Light blue', '#ffec99': 'Light yellow',
  '#d9534f': 'Red', '#e8913a': 'Orange', '#d8b02e': 'Yellow', '#3fa56f': 'Green', '#3b82c4': 'Blue', '#7c5cc4': 'Purple', '#c4527a': 'Pink', '#3d4a5c': 'Slate' };
export const cname = c => CN[c] || c;
// Keyboard hints follow the platform: ⌘ on Apple devices, Ctrl elsewhere.
const APPLE = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const mod = t => APPLE ? t.replace('Ctrl+Shift+', '⇧⌘').replace(/Ctrl[+ ]/g, '⌘') : t.replace('Ctrl K', 'Ctrl+K');
