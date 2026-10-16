//! Klien `pusaka-api` (spec 7.2). Semua panggilan membawa token akses Privy.

import type { Address, Hex } from 'viem';

export interface Peran {
  admin: boolean;
  operator: boolean;
  penandatangan: boolean;
}

export interface InfoSesi {
  did: string;
  wallet: Address[];
  peran: Peran;
}

export type StatusDraf = 'MENUNGGU_TTD' | 'DITANDATANGANI' | 'DITOLAK' | 'TERBIT' | 'DICABUT';

export interface Ttd {
  penanda_tangan: Address;
  sig: Hex;
  batas_waktu: number;
}

export interface Draf {
  id: string;
  dibuat: string;
  diubah: string;
  status: StatusDraf;
  nama: string;
  nim: string;
  prodi: string;
  gelar: string;
  nomor_ijazah: string;
  tanggal_lulus: string;
  email: string;
  penerima: Address;
  doc_hash: Hex;
  metadata_hash: Hex;
  uri: string;
  cid_amplop: string;
  alasan_tolak: string | null;
  token_id: number | null;
  dibuat_oleh: string;
  ttd: Ttd | null;
}

export type DrafBerkunci = Draf & { kunci: Hex };

export interface DrafBaru {
  nama: string;
  nim: string;
  prodi: string;
  gelar: string;
  nomor_ijazah: string;
  tanggal_lulus: string;
  email: string;
  doc_hash: Hex;
  uri: string;
  cid_amplop: string;
  kunci: Hex;
}

export interface HalamanDraf {
  data: Draf[];
  halaman: number;
  per_halaman: number;
  total: number;
}

export type StatusCabut = 'MENUNGGU_TTD' | 'DITANDATANGANI' | 'SELESAI';

export interface PermintaanCabut {
  id: string;
  token_id: number;
  alasan: string;
  alasan_hash: Hex;
  status: StatusCabut;
  dibuat_oleh: string;
  dibuat: string;
  nama: string;
  nim: string;
  nomor_ijazah: string;
  ttd: Ttd | null;
}

/** Galat dari API (`{kode, pesan}`), pesannya sudah bahasa Indonesia dan bisa ditampilkan apa adanya. */
export class GalatApi extends Error {
  constructor(
    readonly status: number,
    readonly kode: string,
    pesan: string,
  ) {
    super(pesan);
    this.name = 'GalatApi';
  }
}

export interface KueriDraf {
  status?: StatusDraf;
  cari?: string;
  halaman?: number;
}

export interface Api {
  sesi(): Promise<InfoSesi>;
  unggahIpfs(nama: string, isi: Uint8Array): Promise<{ cid: string; uri: string }>;
  buatDraf(draf: DrafBaru[]): Promise<{ draf: { id: string; penerima: Address }[] }>;
  daftarDraf(q?: KueriDraf): Promise<HalamanDraf>;
  detailDraf(id: string): Promise<DrafBerkunci>;
  setujui(id: string, sig: Hex, batasWaktu: bigint): Promise<{ id: string; status: StatusDraf }>;
  tolak(id: string, alasan: string): Promise<{ id: string; status: StatusDraf }>;
  kirimUlang(id: string, draf: DrafBaru): Promise<{ id: string; status: StatusDraf }>;
  terbit(txHash: Hex): Promise<{ terbit: { id: string; token_id: number }[]; tidak_dikenal: number }>;
  mintaCabut(tokenId: number, alasan: string): Promise<{ id: string }>;
  daftarCabut(status?: StatusCabut): Promise<{ data: PermintaanCabut[] }>;
  setujuiCabut(id: string, sig: Hex, batasWaktu: bigint): Promise<{ id: string; status: StatusCabut }>;
  selesaiCabut(id: string, txHash: Hex): Promise<{ id: string; status: StatusCabut }>;
  kunci(tokenId: number): Promise<{ token_id: number; status: StatusDraf; kunci: Hex }>;
}

export function buatApi(token: () => Promise<string>, dasar = ''): Api {
  async function minta<T>(metode: string, jalur: string, badan?: BodyInit, jenis?: string): Promise<T> {
    const headers: Record<string, string> = { authorization: `Bearer ${await token()}` };
    if (jenis) headers['content-type'] = jenis;
    const r = await fetch(`${dasar}${jalur}`, { method: metode, headers, ...(badan === undefined ? {} : { body: badan }) });
    const teks = await r.text();
    let isi: unknown = null;
    try {
      isi = teks ? JSON.parse(teks) : null;
    } catch {
      // badan bukan JSON (mis. halaman galat proxy)
    }
    if (!r.ok) {
      const g = isi as { kode?: unknown; pesan?: unknown } | null;
      throw new GalatApi(
        r.status,
        typeof g?.kode === 'string' ? g.kode : 'GALAT',
        typeof g?.pesan === 'string' ? g.pesan : `Server menjawab ${r.status}`,
      );
    }
    return isi as T;
  }
  const json = <T,>(metode: string, jalur: string, badan: unknown) =>
    minta<T>(metode, jalur, JSON.stringify(badan), 'application/json');
  const kueri = (q: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') p.set(k, String(v));
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  return {
    sesi: () => minta('GET', '/api/sesi'),
    unggahIpfs: (nama, isi) =>
      minta('POST', `/api/ipfs${kueri({ nama })}`, isi.slice(), 'application/octet-stream'),
    buatDraf: (draf) => json('POST', '/api/draf', { draf }),
    daftarDraf: (q = {}) => minta('GET', `/api/draf${kueri({ status: q.status, cari: q.cari, halaman: q.halaman })}`),
    detailDraf: (id) => minta('GET', `/api/draf/${encodeURIComponent(id)}`),
    setujui: (id, sig, batasWaktu) =>
      json('POST', `/api/draf/${encodeURIComponent(id)}/setujui`, { sig, batas_waktu: Number(batasWaktu) }),
    tolak: (id, alasan) => json('POST', `/api/draf/${encodeURIComponent(id)}/tolak`, { alasan }),
    kirimUlang: (id, draf) => json('POST', `/api/draf/${encodeURIComponent(id)}/kirim-ulang`, draf),
    terbit: (txHash) => json('POST', '/api/terbit', { tx_hash: txHash }),
    mintaCabut: (tokenId, alasan) => json('POST', '/api/cabut', { token_id: tokenId, alasan }),
    daftarCabut: (status) => minta('GET', `/api/cabut${kueri({ status })}`),
    setujuiCabut: (id, sig, batasWaktu) =>
      json('POST', `/api/cabut/${encodeURIComponent(id)}/setujui`, { sig, batas_waktu: Number(batasWaktu) }),
    selesaiCabut: (id, txHash) => json('POST', `/api/cabut/${encodeURIComponent(id)}/selesai`, { tx_hash: txHash }),
    kunci: (tokenId) => minta('GET', `/api/kunci/${tokenId}`),
  };
}
