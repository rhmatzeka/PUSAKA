import { expect, test } from 'vitest';
import { GalatApi } from '../src/lib/api';
import { simpanTertunda, ambilTertunda, hapusTertunda, ulangiLaporan, type Penyimpan } from '../src/lib/laporan';

test('laporan diulang saat API belum melihat transaksi (409), lalu berhasil', async () => {
  let coba = 0;
  const hasil = await ulangiLaporan(async () => {
    coba++;
    if (coba < 3) throw new GalatApi(409, 'STATUS_TIDAK_SESUAI', 'transaksi belum dikonfirmasi');
    return 'ok';
  }, { coba: 4, jedaMs: 1 });
  expect(hasil).toBe('ok');
  expect(coba).toBe(3);
});

test('galat selain 409 tidak diulang', async () => {
  let coba = 0;
  await expect(
    ulangiLaporan(async () => {
      coba++;
      throw new GalatApi(400, 'INPUT_TIDAK_VALID', 'revert');
    }, { coba: 4, jedaMs: 1 }),
  ).rejects.toThrow('revert');
  expect(coba).toBe(1);
});

test('hash transaksi tertunda disimpan sampai laporannya berhasil', () => {
  const isi = new Map<string, string>();
  const s: Penyimpan = { getItem: (k) => isi.get(k) ?? null, setItem: (k, v) => void isi.set(k, v), removeItem: (k) => void isi.delete(k) };
  expect(ambilTertunda(s)).toBeNull();
  simpanTertunda(s, { jenis: 'terbit', hash: '0xab' });
  expect(ambilTertunda(s)).toEqual({ jenis: 'terbit', hash: '0xab' });
  hapusTertunda(s);
  expect(ambilTertunda(s)).toBeNull();
  isi.set('pusaka:tx-tertunda', '{rusak');
  expect(ambilTertunda(s)).toBeNull();
});
