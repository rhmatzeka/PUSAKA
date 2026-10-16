import { expect, test } from 'vitest';
import { pesanUnduh, tampilanKartu } from '../src/lib/alumni';

const ijazah = (waktuCabut = 0) => ({ docHash: '0x01' as const, penandaTangan: '0x02' as const, waktuTerbit: 1793000000, waktuCabut });

test('status kartu alumni: gagal baca bukan "tidak tercatat"', () => {
  expect(tampilanKartu('galat')).toEqual({ kata: 'Status belum terbaca', simbol: '…', nada: 'tunggu' });
  expect(tampilanKartu(null).kata).toBe('Tidak tercatat');
  expect(tampilanKartu(ijazah()).kata).toBe('Asli · tercatat');
  expect(tampilanKartu(ijazah(5)).kata).toBe('Dicabut');
});

test('unduhan ijazah dicabut diberi peringatan', () => {
  expect(pesanUnduh(ijazah())).toEqual({ teks: 'PDF diunduh (sidik jari cocok dengan blockchain)', nada: 'ok' });
  expect(pesanUnduh(ijazah(5))).toEqual({ teks: 'PDF diunduh. Sidik jarinya cocok, tetapi ijazah ini DICABUT dan tidak berlaku lagi.', nada: 'bad' });
});
