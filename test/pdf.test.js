import { describe, expect, it } from 'vitest';
import { buildPdf } from '../src/pdf.js';

const page = n => ({ jpg: new Uint8Array(n).fill(7), pw: 100, ph: 140, wpt: 595.28, hpt: 841.89 });
const text = u => new TextDecoder('latin1').decode(u);

describe('buildPdf', () => {
  it('writes a header, one page object per page and an end marker', () => {
    const t = text(buildPdf([page(10), page(20)]));
    expect(t.startsWith('%PDF-1.4')).toBe(true);
    expect(t.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(t.trimEnd().endsWith('%%EOF')).toBe(true);
  });
  it('points startxref at the xref table and lists every object offset', () => {
    const t = text(buildPdf([page(30)]));
    const at = +t.match(/startxref\n(\d+)/)[1];
    expect(t.slice(at, at + 4)).toBe('xref');
    const offs = [...t.slice(at).matchAll(/(\d{10}) 00000 n/g)].map(m => +m[1]);
    expect(offs).toHaveLength(5);
    offs.forEach((o, i) => expect(t.slice(o, o + 8)).toBe(`${i + 1} 0 obj\n`));
  });
  it('keeps the image bytes intact and declares their length', () => {
    const out = buildPdf([page(25)]);
    const t = text(out);
    expect(t).toContain('/Length 25 >>');
    expect(t).toContain('/Filter /DCTDecode');
    const i = t.indexOf('stream\n', t.indexOf('/Subtype /Image')) + 7;
    expect([...out.slice(i, i + 25)].every(b => b === 7)).toBe(true);
  });
});
