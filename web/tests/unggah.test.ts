import { readFileSync } from 'node:fs';
import type { Hex } from 'viem';
import { beforeAll, expect, test } from 'vitest';
import { tautanBerkunci } from '../src/lib/tautan';
import { cocokkanPdf, siapkanDraf, type AlatUnggah } from '../src/lib/unggah';
import { buka_amplop, initSync, keccak256_hex, segel_amplop } from '../src/wasm/pusaka_core.js';

beforeAll(() => {
  initSync({ module: readFileSync(new URL('../src/wasm/pusaka_core_bg.wasm', import.meta.url)) });
});

const DATA = { nama: 'Dewi', nim: '2310/114', prodi: 'TI', gelar: 'S.Kom.', nomor_ijazah: 'N1', tanggal_lulus: '2026-08-30' };

function alat() {
  const ipfs = new Map<string, Uint8Array>();
  const a: AlatUnggah & { ipfs: Map<string, Uint8Array>; nama: string[] } = {
    ipfs,
    nama: [],
    keccak: (b) => keccak256_hex(b) as Hex,
    segel: segel_amplop,
    acak: (n) => crypto.getRandomValues(new Uint8Array(n)),
    gambar: 'https://pusaka.example/segel.svg',
    async unggah(nama, isi) {
      const cid = `cid${ipfs.size}`;
      ipfs.set(cid, isi);
      a.nama.push(nama);
      return { cid, uri: `ipfs://${cid}` };
    },
  };
  return a;
}

test('draf siap: sidik jari, amplop yang bisa dibuka dengan kunci, metadata tanpa data pribadi', async () => {
  const pdf = new TextEncoder().encode('%PDF ijazah Dewi');
  const a = alat();
  const d = await siapkanDraf(DATA, 'dewi@unpam.ac.id', pdf, a);
  expect(d.doc_hash).toBe(keccak256_hex(pdf));
  expect(d.kunci).toMatch(/^0x[0-9a-f]{64}$/);
  expect(a.nama).toEqual(['amplop-2310114.bin', 'meta-2310114.json']);

  const kunci = Uint8Array.from(Buffer.from(d.kunci.slice(2), 'hex'));
  const h = buka_amplop(kunci, a.ipfs.get(d.cid_amplop) ?? new Uint8Array());
  expect(JSON.parse(h.data_json)).toEqual(DATA);
  expect(h.pdf).toEqual(pdf);
  h.free();

  const meta = new TextDecoder().decode(a.ipfs.get(d.uri.slice(7)));
  expect(JSON.parse(meta).pusaka).toEqual({ versi: 2, berkas: `ipfs://${d.cid_amplop}`, doc_keccak256: d.doc_hash, enkripsi: 'AES-256-GCM' });
  expect(meta).not.toContain('Dewi');
  expect(meta).not.toContain('2310');
});

test('PDF dipasangkan dengan baris CSV tanpa membedakan huruf besar/kecil', () => {
  const baris = [
    { nomor_baris: 2, data: DATA, email: 'a@b.id', file_pdf: 'Dewi.PDF' },
    { nomor_baris: 3, data: DATA, email: 'c@d.id', file_pdf: 'hilang.pdf' },
  ];
  const hasil = cocokkanPdf(baris, [{ nama: 'dewi.pdf', isi: new Uint8Array([1]) }]);
  expect(hasil.map((h) => h.pdf?.nama ?? null)).toEqual(['dewi.pdf', null]);
});

test('tautan berkunci untuk QR', () => {
  const t = tautanBerkunci('https://pusaka.rahmateka.my.id', 12, `0x${'ff'.repeat(32)}`);
  expect(t).toBe(`https://pusaka.rahmateka.my.id/i/12#k=${'_'.repeat(42)}8`);
});
