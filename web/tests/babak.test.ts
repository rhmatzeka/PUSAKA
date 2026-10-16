import { describe, expect, test } from 'vitest';
import { BABAK, babakAktif, campur, lokal, warnaLatar } from '../src/beranda/babak';

describe('babak beranda', () => {
  test('enam babak berurutan menutup 0..1', () => {
    expect(BABAK).toHaveLength(6);
    expect(BABAK[0]?.mulai).toBe(0);
    expect(BABAK.at(-1)?.selesai).toBe(1);
    for (let i = 1; i < BABAK.length; i++) expect(BABAK[i]?.mulai).toBe(BABAK[i - 1]?.selesai);
  });

  test('babak aktif dari progres scroll', () => {
    expect(babakAktif(0)).toBe(0);
    expect(babakAktif(0.2)).toBe(1);
    expect(babakAktif(0.999)).toBe(5);
    expect(babakAktif(1)).toBe(5);
    expect(babakAktif(-1)).toBe(0);
  });

  test('progres lokal dijepit 0..1', () => {
    const b = BABAK[1]!;
    expect(lokal(b.mulai, 1)).toBe(0);
    expect(lokal(b.selesai, 1)).toBe(1);
    expect(lokal((b.mulai + b.selesai) / 2, 1)).toBeCloseTo(0.5);
    expect(lokal(0, 3)).toBe(0);
    expect(lokal(1, 3)).toBe(1);
  });

  test('warna latar mengikuti babak: gelap, kertas, gelap, merah, gelap, putih', () => {
    expect(warnaLatar(0.05)).toBe('#03060c');
    expect(warnaLatar((BABAK[1]!.mulai + BABAK[1]!.selesai) / 2)).toBe('#eef1f6');
    expect(warnaLatar(0.995)).toBe('#f7f8fb');
    expect(campur('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('warna teks mengikuti terang latar campuran', () => {
  test('latar terang → teks gelap, juga di tengah peralihan', async () => {
    const { latarTerang } = await import('../src/beranda/babak');
    expect(latarTerang('#03060c')).toBe(false);
    expect(latarTerang('#eef1f6')).toBe(true);
    expect(latarTerang('#2a0509')).toBe(false);
    expect(latarTerang('#808080')).toBe(false);
    expect(latarTerang('#a0a0a0')).toBe(true);
  });
});
