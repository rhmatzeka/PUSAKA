//! Pembagian halaman beranda menjadi enam babak (spec 8.2). Semua keadaan adegan dihitung dari
//! satu angka progres scroll 0..1, sehingga bisa diuji dan dirender ulang di titik mana pun.

export interface Babak {
  nama: string;
  mulai: number;
  selesai: number;
  /** Warna latar halaman saat babak ini penuh. */
  latar: string;
  /** Teks gelap di atas latar terang. */
  terang: boolean;
}

export const BABAK: readonly Babak[] = [
  { nama: 'pembuka', mulai: 0, selesai: 0.17, latar: '#03060c', terang: false },
  { nama: 'cetak-biru', mulai: 0.17, selesai: 0.35, latar: '#eef1f6', terang: true },
  { nama: 'ponsel', mulai: 0.35, selesai: 0.53, latar: '#05101f', terang: false },
  { nama: 'pemalsuan', mulai: 0.53, selesai: 0.7, latar: '#2a0509', terang: false },
  { nama: 'inti', mulai: 0.7, selesai: 0.86, latar: '#03060c', terang: false },
  { nama: 'penutup', mulai: 0.86, selesai: 1, latar: '#f7f8fb', terang: true },
];

/** Porsi awal tiap babak yang dipakai untuk peralihan warna dari babak sebelumnya. */
const PERALIHAN = 0.3;

export const jepit = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export function babakAktif(p: number): number {
  const q = jepit(p);
  const i = BABAK.findIndex((b) => q < b.selesai);
  return i === -1 ? BABAK.length - 1 : i;
}

/** Progres di dalam babak `i` (0 di awal, 1 di akhir), dijepit. */
export function lokal(p: number, i: number): number {
  const b = BABAK[i];
  if (!b) return 0;
  return jepit((p - b.mulai) / (b.selesai - b.mulai));
}

const keRgb = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));

export function campur(a: string, b: string, t: number): string {
  const x = keRgb(a);
  const y = keRgb(b);
  return `#${x.map((v, i) => Math.round(v + ((y[i] ?? v) - v) * jepit(t)).toString(16).padStart(2, '0')).join('')}`;
}

export function warnaLatar(p: number): string {
  const i = babakAktif(p);
  const kini = BABAK[i]!;
  const lalu = BABAK[i - 1];
  if (!lalu) return kini.latar;
  return campur(lalu.latar, kini.latar, lokal(p, i) / PERALIHAN);
}

/** Kurva halus untuk gerak di dalam babak. */
export const halus = (t: number) => {
  const x = jepit(t);
  return x * x * (3 - 2 * x);
};

/** Latar cukup terang untuk teks gelap (luminans relatif sRGB). */
export function latarTerang(hex: string): boolean {
  const [r, g, b] = keRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3;
}
