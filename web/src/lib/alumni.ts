import type { Ijazah } from './jenis';
import { STATUS, type Tampilan } from './tampilan';
import { statusIjazah } from './verifikasi';

/** Status di blockchain untuk satu kartu: `null` = kontrak menjawab tidak ada, `'galat'` = belum terbaca. */
export type StatusRantai = Ijazah | null | 'galat';

export function tampilanKartu(s: StatusRantai): Tampilan {
  if (s === 'galat') return { kata: 'Status belum terbaca', simbol: '…', nada: 'tunggu' };
  if (s === null) return STATUS.TIDAK_ADA;
  return STATUS[statusIjazah(s)];
}

export function pesanUnduh(i: Ijazah): { teks: string; nada: 'ok' | 'bad' } {
  return statusIjazah(i) === 'DICABUT'
    ? { teks: 'PDF diunduh. Sidik jarinya cocok, tetapi ijazah ini DICABUT dan tidak berlaku lagi.', nada: 'bad' }
    : { teks: 'PDF diunduh (sidik jari cocok dengan blockchain)', nada: 'ok' };
}
