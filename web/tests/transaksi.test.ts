import { decodeFunctionData } from 'viem';
import { expect, test } from 'vitest';
import type { Draf, PermintaanCabut } from '../src/lib/api';
import { abiTulis, dataCabut, dataTerbitkan, pilihSiapDicatat } from '../src/lib/transaksi';

const draf = (i: number, ttd = true): Draf => ({
  id: `id-${i}`,
  dibuat: '',
  diubah: '',
  status: 'DITANDATANGANI',
  nama: `Lulusan ${i}`,
  nim: '1',
  prodi: 'TI',
  gelar: 'S.Kom.',
  nomor_ijazah: `N${i}`,
  tanggal_lulus: '2026-08-30',
  email: 'a@b.id',
  penerima: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
  doc_hash: `0x${String(i).repeat(64).slice(0, 64)}`,
  metadata_hash: `0x${'ab'.repeat(32)}`,
  uri: `ipfs://meta${i}`,
  cid_amplop: 'x',
  alasan_tolak: null,
  token_id: null,
  dibuat_oleh: 'did:privy:op',
  ttd: ttd ? { penanda_tangan: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', sig: `0x${'11'.repeat(65)}`, batas_waktu: 1793000000 } : null,
});

test('terbitkanBatch memuat penerbitan, tanda tangan, dan uri sesuai urutan draf', () => {
  const { functionName, args } = decodeFunctionData({ abi: abiTulis, data: dataTerbitkan([draf(1), draf(2)]) });
  expect(functionName).toBe('terbitkanBatch');
  const [p, sig, uri] = args as unknown as [{ docHash: string; batasWaktu: bigint }[], string[], string[]];
  expect(p.map((x) => x.docHash)).toEqual([draf(1).doc_hash, draf(2).doc_hash]);
  expect(p[0]?.batasWaktu).toBe(1793000000n);
  expect(sig).toHaveLength(2);
  expect(uri).toEqual(['ipfs://meta1', 'ipfs://meta2']);
});

test('draf tanpa tanda tangan atau batch kosong/terlalu besar ditolak', () => {
  expect(() => dataTerbitkan([draf(1), draf(2, false)])).toThrow(/belum ditandatangani/);
  expect(() => dataTerbitkan([])).toThrow(/1–50/);
  expect(() => dataTerbitkan(Array.from({ length: 51 }, (_, i) => draf(i)))).toThrow(/1–50/);
});

test('cabut memuat alasan dan tanda tangan pejabat', () => {
  const c: PermintaanCabut = {
    id: 'c1',
    token_id: 7,
    alasan: 'salah nama ibu',
    alasan_hash: '0xb0e811a06cdecac05b2c76b58d65333b5a96d4666441412f169bc50020178302',
    status: 'DITANDATANGANI',
    dibuat_oleh: 'did',
    dibuat: '',
    nama: 'x',
    nim: '1',
    nomor_ijazah: 'N',
    ttd: { penanda_tangan: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', sig: `0x${'22'.repeat(65)}`, batas_waktu: 1793000000 },
  };
  const { functionName, args } = decodeFunctionData({ abi: abiTulis, data: dataCabut(c) });
  expect(functionName).toBe('cabut');
  expect(args?.[2]).toBe('salah nama ibu');
  expect(() => dataCabut({ ...c, ttd: null })).toThrow(/belum ditandatangani/);
});

test('draf yang tanda tangannya kedaluwarsa (atau hampir) tidak ikut batch', () => {
  const kini = 1793000000 - 3600; // 1 jam sebelum batas draf biasa
  const lama = { ...draf(3), ttd: { ...draf(3).ttd!, batas_waktu: kini - 10 } };
  const { siap, kedaluwarsa } = pilihSiapDicatat([draf(1), lama, draf(2, false)], kini);
  expect(siap.map((d) => d.id)).toEqual(['id-1']);
  expect(kedaluwarsa.map((d) => d.id)).toEqual(['id-3']);
  expect(pilihSiapDicatat([draf(1)], 1793000000 - 30).siap).toEqual([]);
});

test('cabut dengan tanda tangan kedaluwarsa ditolak sebelum transaksi', () => {
  const c = { id: 'c', token_id: 1, alasan: 'x', alasan_hash: '0x00' as const, status: 'DITANDATANGANI' as const, dibuat_oleh: '', dibuat: '', nama: '', nim: '', nomor_ijazah: '', ttd: { penanda_tangan: '0x00' as const, sig: '0x00' as const, batas_waktu: 100 } };
  expect(() => dataCabut(c, 200)).toThrow(/kedaluwarsa/);
});
