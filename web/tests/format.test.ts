import { expect, test } from 'vitest';
import { angka, ringkas, tanggal } from '../src/lib/format';

test('ringkas hash dan alamat', () => {
  expect(ringkas('0x7c1e00000000000000000000000000000000a94f')).toBe('7c1e…a94f');
  expect(ringkas('0xabcd')).toBe('abcd');
});

test('tanggal dan angka gaya Indonesia', () => {
  expect(tanggal(1793000000)).toBe('26 Oktober 2026');
  expect(angka(18204551n)).toBe('18.204.551');
});
