import { expect, test } from 'vitest';
import { tujuanAman, tujuanPeran } from '../src/lib/peran';

test('halaman awal mengikuti peran', () => {
  expect(tujuanPeran({ admin: false, operator: true, penandatangan: false })).toBe('/op');
  expect(tujuanPeran({ admin: false, operator: false, penandatangan: true })).toBe('/meja');
  expect(tujuanPeran({ admin: true, operator: false, penandatangan: false })).toBe('/alumni');
});

test('tujuan setelah masuk hanya jalur internal yang dikenal', () => {
  expect(tujuanAman('/op/unggah')).toBe('/op/unggah');
  expect(tujuanAman('/meja')).toBe('/meja');
  for (const salah of ['https://penipu.example', '//penipu.example', '/op/../x', '/periksa', null, '']) {
    expect(tujuanAman(salah)).toBeNull();
  }
});
