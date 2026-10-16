import type { Peran } from './api';

/** Halaman awal sesuai peran on-chain. Operator lebih dulu (satu wallet tidak boleh memegang keduanya di kontrak). */
export function tujuanPeran(p: Peran): '/op' | '/meja' | '/alumni' {
  if (p.operator) return '/op';
  if (p.penandatangan) return '/meja';
  return '/alumni';
}

/** Hanya jalur internal yang boleh jadi tujuan setelah masuk (mencegah open redirect). */
export function tujuanAman(ke: string | null): string | null {
  return ke && /^\/(op|meja|alumni)(\/[a-z-]*)?$/.test(ke) ? ke : null;
}
