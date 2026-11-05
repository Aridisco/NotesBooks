// Number helpers for the math panel: list parsing, GCD and descriptive statistics (as LaTeX).
const r4 = v => +Number(v).toFixed(4);
export const nums = pl => pl.split(/[,;]/).map(Number).filter(isFinite);
export const gcd2 = (a, b) => b ? gcd2(b, a % b) : Math.abs(a);
export function stats(a) {
  const n = a.length, s = [...a].sort((x, y) => x - y), mean = a.reduce((x, y) => x + y, 0) / n;
  const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  const ss = a.reduce((x, y) => x + (y - mean) ** 2, 0), cnt = {};
  a.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
  const top = Math.max(...Object.values(cnt)), mode = top > 1 ? Object.keys(cnt).filter(k => cnt[k] === top).join(',\\ ') : '—';
  const rows = [['n', n], ['\\text{mean } \\bar{x}', r4(mean)], ['\\text{median}', r4(med)], ['\\text{mode}', mode], ['\\min', s[0]], ['\\max', s[n - 1]], ['\\text{range}', r4(s[n - 1] - s[0])],
    ['\\sigma\\ (\\text{population})', r4(Math.sqrt(ss / n))], ['s\\ (\\text{sample})', n > 1 ? r4(Math.sqrt(ss / (n - 1))) : '—'], ['\\sigma^2', r4(ss / n)]];
  return '\\begin{array}{ll}' + rows.map(r => r[0] + ' & ' + r[1]).join('\\\\') + '\\end{array}';
}
