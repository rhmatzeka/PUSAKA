//! Tiga jalur verifikasi (spec 9). Murni: semua I/O lewat `Sumber`.

import type { Hex } from 'viem';
import type { DataLulusan, HasilBerkas, HasilToken, Ijazah, Sumber } from './jenis';

const STATUS_TIDAK_ADA = 0;
const STATUS_DICABUT = 2;

export function statusIjazah(i: Ijazah): 'VALID' | 'DICABUT' {
  return i.waktuCabut > 0 ? 'DICABUT' : 'VALID';
}

/** Jalur unggah PDF: sidik jari dihitung lokal lalu dicocokkan dengan `periksa()`. */
export async function cekBerkas(pdf: Uint8Array, s: Sumber): Promise<HasilBerkas> {
  const docHash = s.keccak(pdf);
  const r = await s.periksa(docHash);
  if (r.status === STATUS_TIDAK_ADA) return { jenis: 'tidak-ada', docHash };
  return {
    jenis: 'ada',
    status: r.status === STATUS_DICABUT ? 'DICABUT' : 'VALID',
    tokenId: r.tokenId,
    docHash,
    ijazah: r.data,
  };
}

const KOLOM_DATA = ['nama', 'nim', 'prodi', 'gelar', 'nomor_ijazah', 'tanggal_lulus'] as const;

/** Header amplop hanya dipakai bila keenam kolomnya teks dan tanggalnya sah. */
export function sahkanData(x: unknown): DataLulusan | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (!KOLOM_DATA.every((k) => typeof o[k] === 'string' && o[k] !== '')) return null;
  const t = o['tanggal_lulus'] as string;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(`${t}T00:00:00Z`))) return null;
  return o as unknown as DataLulusan;
}

function alamatBerkas(metadata: unknown): string {
  const berkas = (metadata as { pusaka?: { berkas?: unknown } } | null)?.pusaka?.berkas;
  if (typeof berkas !== 'string') throw new Error('Metadata ijazah tidak memuat alamat berkas');
  return berkas;
}

/**
 * Jalur nomor token (dan QR berkunci). Tanpa kunci hanya status on-chain; dengan kunci,
 * amplop dari IPFS didekripsi dan Keccak PDF-nya wajib sama dengan `docHash` on-chain.
 */
export async function cekToken(tokenId: bigint, kunci: Uint8Array | null, s: Sumber): Promise<HasilToken> {
  const ijazah = await s.ijazah(tokenId);
  if (!ijazah) return { jenis: 'tidak-ada', tokenId };
  if (!kunci) return { jenis: 'terkunci', tokenId, ijazah };

  const metadata: unknown = JSON.parse(new TextDecoder().decode(await s.ambil(await s.tokenUri(tokenId))));
  const amplop = await s.ambil(alamatBerkas(metadata));
  let isi: ReturnType<Sumber['buka']>;
  try {
    isi = s.buka(kunci, amplop);
  } catch {
    return { jenis: 'kunci-salah', tokenId, ijazah };
  }
  const data = sahkanData(isi.data);
  if (!data) return { jenis: 'kunci-salah', tokenId, ijazah };
  const hashBerkas: Hex = s.keccak(isi.pdf);
  if (hashBerkas.toLowerCase() !== ijazah.docHash.toLowerCase()) {
    return { jenis: 'berkas-tidak-cocok', tokenId, ijazah, hashBerkas };
  }
  return { jenis: 'lengkap', tokenId, ijazah, data, pdf: isi.pdf };
}
