import { expect, test } from 'vitest';
import { alamatTertaut, tujuanAman, tujuanPeran } from '../src/lib/peran';

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

test('wallet yang diingat hanya dipakai bila tertaut ke akun yang login', () => {
  const tertaut = ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8'];
  expect(alamatTertaut('0x70997970c51812dc3a010c7d01b50e0d17dc79c8', tertaut)).toBe(true);
  expect(alamatTertaut('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', tertaut)).toBe(false);
  expect(alamatTertaut(undefined, tertaut)).toBe(false);
});
