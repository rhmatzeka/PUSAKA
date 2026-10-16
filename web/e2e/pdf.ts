/** PDF satu halaman yang sah (dibaca penampil PDF biasa), cukup untuk data uji. */
export function buatPdf(baris: string[]): Uint8Array {
  const teks = baris
    .map((b, i) => `BT /F1 16 Tf 72 ${760 - i * 26} Td (${b.replace(/[()\\]/g, '\\$&')}) Tj ET`)
    .join('\n');
  const objek = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${teks.length} >>\nstream\n${teks}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let isi = '%PDF-1.4\n';
  const posisi: number[] = [];
  objek.forEach((o, i) => {
    posisi.push(isi.length);
    isi += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = isi.length;
  isi += `xref\n0 ${objek.length + 1}\n0000000000 65535 f \n`;
  isi += posisi.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  isi += `trailer\n<< /Size ${objek.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(isi);
}
