import { expect, test } from 'vitest';
import { tautanIjazah, tokenDariJalur } from '../src/lib/jalur';

test('nomor token dari jalur /i/*', () => {
  expect(tokenDariJalur('/i/1284')).toBe(1284n);
  expect(tokenDariJalur('/i/7/')).toBe(7n);
  for (const salah of ['/i/', '/i/abc', '/i/1/2', '/periksa', `/i/${'9'.repeat(21)}`]) expect(tokenDariJalur(salah)).toBeNull();
});

test('QR hanya diikuti bila tautan ijazah di asal yang sama', () => {
  const asal = 'https://pusaka.rahmateka.my.id';
  expect(tautanIjazah(`${asal}/i/5#k=abc`, asal)).toBe(`${asal}/i/5#k=abc`);
  expect(tautanIjazah('https://penipu.example/i/5', asal)).toBeNull();
  expect(tautanIjazah(`${asal}/periksa`, asal)).toBeNull();
  expect(tautanIjazah('teks biasa', asal)).toBeNull();
});
