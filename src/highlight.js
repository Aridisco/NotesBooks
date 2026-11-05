// Regex-based syntax highlighter (no dependencies, no DOM): returns token ranges per language.
const kw = (s, f = '') => new RegExp('\\b(?:' + s.split(' ').join('|') + ')\\b', 'y' + f);
const CSTYLE = ['com', /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y];
const NUM = ['num', /\b0x[\da-f]+\b|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?[fFdDmMuUlL]*\b/iy];
const DQ = ['str', /"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/y];
const FN = ['fn', /[A-Za-z_$][\w$]*(?=\()/y];
const TY = ['ty', /\b[A-Z][\w$]*\b/y];
const XML = [
  ['com', /<!--[\s\S]*?(?:-->|$)/y],
  ['str', /"[^"]*"?|'[^']*'?/y],
  ['tag', /<\/?[A-Za-z][\w:.-]*|\/?>/y],
  ['attr', /[\w:.-]+(?==)/y],
];
export const LANGS = {
  js: ['JavaScript / TypeScript', [CSTYLE, ['str', /`(?:\\[\s\S]|[^`\\])*`?|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/y], NUM, ['kw', kw('const let var function return if else for while do switch case break continue new class extends import export from default async await try catch finally throw typeof instanceof in of this super null undefined true false interface type enum implements public private protected readonly static yield void as is keyof namespace declare abstract')], FN, TY]],
  py: ['Python', [['com', /#[^\n]*/y], ['str', /"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/y], NUM, ['fn', /@[\w.]+/y], ['kw', kw('def class return if elif else for while in not and or is import from as with try except finally raise lambda yield pass break continue None True False async await global nonlocal assert del self')], FN, TY]],
  cs: ['C#', [CSTYLE, ['str', /@"(?:""|[^"])*"?|\$?"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/y], NUM, ['kw', /#\s*\w+/y], ['kw', kw('abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile while async await get set record init value')], FN, TY]],
  xaml: ['XAML', XML.concat([['fn', /\{[A-Za-z]+/y], ['kw', /[{}]/y]])],
  html: ['HTML', XML],
  css: ['CSS', [['com', /\/\*[\s\S]*?(?:\*\/|$)/y], DQ, ['kw', /@[\w-]+/y], ['num', /#[\da-f]{3,8}\b|-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg)?/iy], ['attr', /[a-z-]+(?=\s*:)/y], ['ty', /[.#][\w-]+/y], ['fn', /[\w-]+(?=\()/y]]],
  c: ['C / C++', [CSTYLE, DQ, NUM, ['kw', /^[ \t]*#\s*\w+/my], ['kw', kw('auto break case char const continue default do double else enum extern float for goto if inline int long register return short signed sizeof static struct switch typedef union unsigned void volatile while class namespace template typename public private protected virtual new delete nullptr true false bool using this operator constexpr')], FN, TY]],
  java: ['Java / Kotlin', [CSTYLE, ['str', /"""[\s\S]*?(?:"""|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/y], NUM, ['fn', /@\w+/y], ['kw', kw('abstract boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws true false try void volatile while fun val var when object companion data sealed override open internal lateinit suspend in is as')], FN, TY]],
  sql: ['SQL', [['com', /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/y], ['str', /'(?:''|[^'])*'?/y], NUM, ['kw', kw('select from where insert into values update set delete create table alter drop join left right inner outer on group by order having limit offset as and or not null is in like between distinct union all primary key foreign references default index view begin commit rollback case when then else end count sum avg min max asc desc exists', 'i')], FN]],
  json: ['JSON', [['attr', /"(?:\\.|[^"\\\n])*"(?=\s*:)/y], ['str', /"(?:\\.|[^"\\\n])*"?/y], NUM, ['kw', kw('true false null')]]],
};
export const DARK = { kw: '#c792ea', str: '#c3e88d', com: '#7f8c9a', num: '#f78c6c', fn: '#82aaff', ty: '#ffcb6b', tag: '#f07178', attr: '#ffcb6b' };
export const LIGHT = { kw: '#7c3aed', str: '#2f7d32', com: '#6b7280', num: '#c2410c', fn: '#1d4ed8', ty: '#b45309', tag: '#be123c', attr: '#b45309' };

// Returns [{a, b, k}] token ranges; plain text is simply not covered.
export function tokenize(lang, text) {
  const rules = (LANGS[lang] || LANGS.js)[1],
    out = [];
  let i = 0;
  while (i < text.length) {
    let hit = null;
    for (const [k, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(text);
      if (m && m[0].length) {
        hit = [k, m[0].length];
        break;
      }
    }
    if (hit) {
      out.push({ a: i, b: i + hit[1], k: hit[0] });
      i += hit[1];
    } else i++;
  }
  return out;
}
