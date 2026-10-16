import { readFileSync } from 'node:fs';
import type { Hex } from 'viem';
import { beforeAll, describe, expect, test } from 'vitest';
import type { Ijazah, Sumber } from '../src/lib/jenis';
import { cekBerkas, cekToken, statusIjazah } from '../src/lib/verifikasi';
import { buka_amplop, initSync, keccak256_hex, segel_amplop } from '../src/wasm/pusaka_core.js';

const KUNCI = new Uint8Array(32).fill(4);
const NONCE = new Uint8Array(12).fill(1);
const PDF = new TextEncoder().encode('%PDF-1.4 ijazah uji');
const DATA = {
  nama: 'Dewi Lestari',
  nim: '231011400001',
  prodi: 'Teknik Informatika',
  gelar: 'S.Kom.',
  nomor_ijazah: 'UNPAM/2026/0001',
  tanggal_lulus: '2026-08-30',
};

beforeAll(() => {
  initSync({ module: readFileSync(new URL('../src/wasm/pusaka_core_bg.wasm', import.meta.url)) });
});

function ijazah(docHash: Hex, waktuCabut = 0): Ijazah {
  return { docHash, penandaTangan: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', waktuTerbit: 1793000000, waktuCabut };
}

/** Sumber tiruan: satu token (#1) dengan amplop asli di "IPFS". */
function tiruan(ubah: Partial<Sumber> = {}, docHash?: Hex): Sumber & { diambil: string[] } {
  const amplop = segel_amplop(KUNCI, NONCE, JSON.stringify(DATA), PDF);
  const hash = docHash ?? (keccak256_hex(PDF) as Hex);
  const ipfs: Record<string, Uint8Array> = {
    'ipfs://meta': new TextEncoder().encode(JSON.stringify({ pusaka: { versi: 2, berkas: 'ipfs://amplop' } })),
    'ipfs://amplop': amplop,
  };
  const diambil: string[] = [];
  return {
    diambil,
    periksa: async (h) =>
      h === hash ? { status: 1, tokenId: 1n, data: ijazah(hash) } : { status: 0, tokenId: 0n, data: ijazah(h) },
    ijazah: async (id) => (id === 1n ? ijazah(hash) : null),
    tokenUri: async () => 'ipfs://meta',
    ambil: async (uri) => {
      diambil.push(uri);
      const isi = ipfs[uri];
      if (!isi) throw new Error(`tidak ada ${uri}`);
      return isi;
    },
    keccak: (isi) => keccak256_hex(isi) as Hex,
    buka: (kunci, a) => {
      const h = buka_amplop(kunci, a);
      try {
        return { data: JSON.parse(h.data_json), pdf: h.pdf };
      } finally {
        h.free();
      }
    },
    ...ubah,
  };
}

describe('cekBerkas', () => {
  test('PDF asli tercatat VALID', async () => {
    const h = await cekBerkas(PDF, tiruan());
    expect(h).toMatchObject({ jenis: 'ada', status: 'VALID', tokenId: 1n });
  });

  test('PDF diubah satu bita tidak tercatat', async () => {
    const palsu = PDF.slice();
    palsu[5] = (palsu[5] ?? 0) ^ 1;
    const h = await cekBerkas(palsu, tiruan());
    expect(h).toEqual({ jenis: 'tidak-ada', docHash: keccak256_hex(palsu) });
  });

  test('status 2 dari kontrak berarti DICABUT', async () => {
    const s = tiruan({ periksa: async (h) => ({ status: 2, tokenId: 7n, data: ijazah(h, 1793100000) }) });
    expect(await cekBerkas(PDF, s)).toMatchObject({ jenis: 'ada', status: 'DICABUT', tokenId: 7n });
  });
});

describe('cekToken', () => {
  test('token tidak ada', async () => {
    expect(await cekToken(9n, KUNCI, tiruan())).toEqual({ jenis: 'tidak-ada', tokenId: 9n });
  });

  test('tanpa kunci hanya status, tidak mengambil apa pun dari IPFS', async () => {
    const s = tiruan();
    expect(await cekToken(1n, null, s)).toMatchObject({ jenis: 'terkunci', tokenId: 1n });
    expect(s.diambil).toEqual([]);
  });

  test('kunci benar membuka data dan PDF yang cocok dengan docHash', async () => {
    const h = await cekToken(1n, KUNCI, tiruan());
    expect(h.jenis).toBe('lengkap');
    if (h.jenis !== 'lengkap') return;
    expect(h.data).toEqual(DATA);
    expect(h.pdf).toEqual(PDF);
  });

  test('kunci salah', async () => {
    expect(await cekToken(1n, new Uint8Array(32).fill(5), tiruan())).toMatchObject({ jenis: 'kunci-salah' });
  });

  test('berkas IPFS tidak cocok dengan sidik jari on-chain', async () => {
    const lain = keccak256_hex(new TextEncoder().encode('lain')) as Hex;
    const h = await cekToken(1n, KUNCI, tiruan({}, lain));
    expect(h).toMatchObject({ jenis: 'berkas-tidak-cocok', hashBerkas: keccak256_hex(PDF) });
  });

  test('metadata tanpa alamat berkas melempar galat', async () => {
    const s = tiruan({ ambil: async () => new TextEncoder().encode('{"name":"x"}') });
    await expect(cekToken(1n, KUNCI, s)).rejects.toThrow(/alamat berkas/);
  });
});

test('statusIjazah dari waktuCabut', () => {
  expect(statusIjazah(ijazah('0x01'))).toBe('VALID');
  expect(statusIjazah(ijazah('0x01', 5))).toBe('DICABUT');
});

describe('isi amplop yang cacat', () => {
  test('amplop sampah dari gateway → tidak terbuka', async () => {
    const s = tiruan({ ambil: async (uri) => (uri === 'ipfs://meta' ? new TextEncoder().encode(JSON.stringify({ pusaka: { berkas: 'ipfs://amplop' } })) : new Uint8Array(64).fill(3)) });
    expect(await cekToken(1n, KUNCI, s)).toMatchObject({ jenis: 'kunci-salah' });
  });

  test.each([
    ['tanpa nomor_ijazah', { ...DATA, nomor_ijazah: undefined }],
    ['nama bukan teks', { ...DATA, nama: { x: 1 } }],
    ['tanggal tidak sah', { ...DATA, tanggal_lulus: '2026-13-45' }],
  ])('header %s → tidak ditampilkan', async (_n, data) => {
    // pusaka-core menolak header bertipe salah; lapisan ini tetap dijaga untuk Sumber lain.
    const s = tiruan({ buka: () => ({ data, pdf: PDF }) });
    expect(await cekToken(1n, KUNCI, s)).toMatchObject({ jenis: 'kunci-salah' });
  });
});
