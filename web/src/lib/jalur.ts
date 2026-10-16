/** `/i/1284` → 1284n. Halaman `/i/` dilayani untuk semua `/i/*` lewat rewrite. */
export function tokenDariJalur(jalur: string): bigint | null {
  const m = /^\/i\/(\d{1,20})\/?$/.exec(jalur);
  return m?.[1] ? BigInt(m[1]) : null;
}

/** Isi QR → alamat ijazah PUSAKA di asal yang sama, atau `null` (QR lain tidak diikuti). */
export function tautanIjazah(teks: string, asal: string): string | null {
  try {
    const u = new URL(teks, asal);
    return u.origin === asal && tokenDariJalur(u.pathname) !== null ? u.href : null;
  } catch {
    return null;
  }
}
