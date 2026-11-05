// Minimal PDF writer: one JPEG image per page, no dependencies.
// pages: [{ jpg: Uint8Array, pw, ph (pixels), wpt, hpt (page size in points) }]
export function buildPdf(pages) {
  const enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const push = b => {
    const u = typeof b === 'string' ? enc.encode(b) : b;
    parts.push(u);
    len += u.length;
  };
  const obj = (n, body) => {
    offs[n] = len;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };
  const n = pages.length, total = 3 + 3 * n;
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pages.map((_, k) => `${3 + 3 * k} 0 R`).join(' ')}] /Count ${n} >>`);
  pages.forEach((p, k) => {
    const pg = 3 + 3 * k, ct = 4 + 3 * k, im = 5 + 3 * k;
    const w = +p.wpt.toFixed(2), h = +p.hpt.toFixed(2);
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    const c = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    obj(ct, `<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
    offs[im] = len;
    push(`${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.pw} /Height ${p.ph} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`);
    push(p.jpg);
    push('\nendstream\nendobj\n');
  });
  const xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n` + offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join(''));
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len);
  let at = 0;
  parts.forEach(u => {
    out.set(u, at);
    at += u.length;
  });
  return out;
}
