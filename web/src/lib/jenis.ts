import type { Address, Hex } from 'viem';

/** Isi struct `Ijazah` di kontrak (waktu dalam detik Unix; 0 = belum terjadi). */
export interface Ijazah {
  docHash: Hex;
  penandaTangan: Address;
  waktuTerbit: number;
  waktuCabut: number;
}

/** Header amplop terenkripsi (spec 6.1). */
export interface DataLulusan {
  nama: string;
  nim: string;
  prodi: string;
  gelar: string;
  nomor_ijazah: string;
  tanggal_lulus: string;
}

/** Semua yang dibutuhkan verifikasi; implementasi asli di `sumber.ts`, tiruan di tes. */
export interface Sumber {
  periksa(docHash: Hex): Promise<{ status: number; tokenId: bigint; data: Ijazah }>;
  /** `null` bila kontrak menolak dengan `IjazahTidakAda`. */
  ijazah(tokenId: bigint): Promise<Ijazah | null>;
  tokenUri(tokenId: bigint): Promise<string>;
  ambil(uri: string): Promise<Uint8Array>;
  keccak(isi: Uint8Array): Hex;
  /** Melempar galat bila kunci salah atau amplop rusak. `data` divalidasi pemanggil. */
  buka(kunci: Uint8Array, amplop: Uint8Array): { data: unknown; pdf: Uint8Array };
}

export type HasilBerkas =
  | { jenis: 'tidak-ada'; docHash: Hex }
  | { jenis: 'ada'; status: 'VALID' | 'DICABUT'; tokenId: bigint; docHash: Hex; ijazah: Ijazah };

export type HasilToken =
  | { jenis: 'tidak-ada'; tokenId: bigint }
  | { jenis: 'terkunci'; tokenId: bigint; ijazah: Ijazah }
  | { jenis: 'lengkap'; tokenId: bigint; ijazah: Ijazah; data: DataLulusan; pdf: Uint8Array }
  | { jenis: 'kunci-salah'; tokenId: bigint; ijazah: Ijazah }
  | { jenis: 'berkas-tidak-cocok'; tokenId: bigint; ijazah: Ijazah; hashBerkas: Hex };
