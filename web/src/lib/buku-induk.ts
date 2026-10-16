//! Pemetaan draf ke baris jendela perintah dan pengelompokan per hari (murni, teruji).

import type { NadaSegel } from '../components/Segel';
import type { Draf, StatusDraf } from './api';

export interface TampilanDraf {
  ikon: string;
  ket: string;
  nada: 'ok' | 'bad' | 'tunggu' | 'biru' | 'redup';
  coret: boolean;
}

export function tampilanDraf(d: Pick<Draf, 'status' | 'token_id' | 'alasan_tolak'>): TampilanDraf {
  switch (d.status) {
    case 'MENUNGGU_TTD':
      return { ikon: '⬡', ket: '○ Menunggu Rektor', nada: 'tunggu', coret: false };
    case 'DITANDATANGANI':
      return { ikon: '◆', ket: '◆ Ditandatangani · siap dicatat', nada: 'biru', coret: false };
    case 'DITOLAK':
      return { ikon: '!', ket: `✕ Ditolak: ${d.alasan_tolak ?? ''}`.trim(), nada: 'bad', coret: false };
    case 'TERBIT':
      return { ikon: '⬢', ket: `↑ Tercatat #${d.token_id ?? '?'}`, nada: 'ok', coret: false };
    case 'DICABUT':
      return { ikon: '✕', ket: `↓ Dicabut #${d.token_id ?? '?'}`, nada: 'bad', coret: true };
  }
}

/** "Hari ini", "Kemarin", atau tanggal; dihitung di zona WIB. */
export function labelHari(iso: string, kini = new Date()): string {
  const f = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
  const hari = f.format(new Date(iso));
  if (hari === f.format(kini)) return 'Hari ini';
  if (hari === f.format(new Date(kini.getTime() - 86_400_000))) return 'Kemarin';
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
}

export const CHIP_STATUS: { id: 'semua' | StatusDraf; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'MENUNGGU_TTD', label: 'Menunggu' },
  { id: 'DITANDATANGANI', label: 'Siap' },
  { id: 'DITOLAK', label: 'Ditolak' },
  { id: 'TERBIT', label: 'Tercatat' },
  { id: 'DICABUT', label: 'Dicabut' },
];

/** Warna pendar segel di panel detail. */
export function nadaSegelDraf(s: StatusDraf): NadaSegel {
  return { MENUNGGU_TTD: 'tunggu', DITANDATANGANI: 'seret', DITOLAK: 'bad', TERBIT: 'ok', DICABUT: 'bad' }[s] as NadaSegel;
}
