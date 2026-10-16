import { expect, test } from 'vitest';
import { labelHari, tampilanDraf } from '../src/lib/buku-induk';

test('setiap status punya kata, simbol, dan nada', () => {
  expect(tampilanDraf({ status: 'TERBIT', token_id: 12, alasan_tolak: null })).toEqual({ ikon: '⬢', ket: '↑ Tercatat #12', nada: 'ok', coret: false });
  expect(tampilanDraf({ status: 'DICABUT', token_id: 3, alasan_tolak: null })).toMatchObject({ ket: '↓ Dicabut #3', coret: true });
  expect(tampilanDraf({ status: 'DITOLAK', token_id: null, alasan_tolak: 'nama ibu salah' }).ket).toBe('✕ Ditolak: nama ibu salah');
  expect(tampilanDraf({ status: 'MENUNGGU_TTD', token_id: null, alasan_tolak: null }).nada).toBe('tunggu');
});

test('label hari dalam WIB', () => {
  const kini = new Date('2026-10-16T05:00:00Z');
  expect(labelHari('2026-10-16T01:00:00Z', kini)).toBe('Hari ini');
  expect(labelHari('2026-10-15T10:00:00Z', kini)).toBe('Kemarin');
  expect(labelHari('2026-10-13T10:00:00Z', kini)).toBe('Selasa, 13 Oktober');
});
