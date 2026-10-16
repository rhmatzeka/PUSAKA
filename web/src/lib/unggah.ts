//! Menyiapkan draf dari data lulusan + PDF (spec 9 langkah 2): sidik jari, kunci, amplop, unggah IPFS.

import type { Hex } from 'viem';
import type { DrafBaru } from './api';
import type { DataLulusan } from './jenis';

export interface BarisCsv {
  nomor_baris: number;
  data: DataLulusan;
  email: string;
  file_pdf: string;
}

export interface HasilCsv {
  baris: BarisCsv[];
  galat: { nomor_baris: number; pesan: string }[];
}

export interface BerkasPdf {
  nama: string;
  isi: Uint8Array;
}

export interface AlatUnggah {
  keccak(isi: Uint8Array): Hex;
  segel(kunci: Uint8Array, nonce: Uint8Array, dataJson: string, pdf: Uint8Array): Uint8Array;
  acak(n: number): Uint8Array;
  unggah(nama: string, isi: Uint8Array): Promise<{ cid: string; uri: string }>;
  /** Alamat gambar segel untuk metadata publik. */
  gambar: string;
}

export function keHex(b: Uint8Array): Hex {
  return `0x${Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** Metadata ERC-721 publik (spec 6.2): tanpa data pribadi apa pun. */
export function metadataPublik(cidAmplop: string, docHash: Hex, gambar: string) {
  return {
    name: 'Ijazah Universitas Pamulang',
    description: 'Ijazah digital PUSAKA. Data lulusan terenkripsi; periksa lewat tautan atau QR berkunci.',
    image: gambar,
    attributes: [{ trait_type: 'Institusi', value: 'Universitas Pamulang' }],
    pusaka: { versi: 2, berkas: `ipfs://${cidAmplop}`, doc_keccak256: docHash, enkripsi: 'AES-256-GCM' },
  };
}

/** Nama berkas IPFS yang aman (huruf, angka, titik, strip) dari NIM. */
function namaBerkas(awalan: string, nim: string, akhiran: string): string {
  return `${awalan}-${nim.replace(/[^0-9A-Za-z]/g, '') || 'x'}.${akhiran}`;
}

/** Segel amplop dan unggah amplop + metadata; hasilnya siap dikirim sebagai draf. */
export async function siapkanDraf(data: DataLulusan, email: string, pdf: Uint8Array, alat: AlatUnggah): Promise<DrafBaru> {
  const docHash = alat.keccak(pdf);
  const kunci = alat.acak(32);
  const amplop = alat.segel(kunci, alat.acak(12), JSON.stringify(data), pdf);
  const { cid } = await alat.unggah(namaBerkas('amplop', data.nim, 'bin'), amplop);
  const meta = new TextEncoder().encode(JSON.stringify(metadataPublik(cid, docHash, alat.gambar)));
  const { uri } = await alat.unggah(namaBerkas('meta', data.nim, 'json'), meta);
  return { ...data, email, doc_hash: docHash, uri, cid_amplop: cid, kunci: keHex(kunci) };
}

/** Pasangkan baris CSV dengan PDF berdasarkan kolom `file_pdf` (tanpa membedakan huruf besar/kecil). */
export function cocokkanPdf(baris: BarisCsv[], berkas: BerkasPdf[]): { baris: BarisCsv; pdf: BerkasPdf | null }[] {
  const peta = new Map(berkas.map((b) => [b.nama.toLowerCase(), b]));
  return baris.map((b) => ({ baris: b, pdf: peta.get(b.file_pdf.toLowerCase()) ?? null }));
}
