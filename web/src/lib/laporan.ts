//! Pelaporan transaksi ke API setelah tercatat di blockchain. Hash disimpan dulu supaya tidak hilang
//! bila API tertinggal dari node RPC peramban atau jaringan putus; `/api/terbit` dan `/selesai` idempoten.

import type { Hex } from 'viem';
import { GalatApi } from './api';

export interface Penyimpan {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export type TxTertunda = { jenis: 'terbit'; hash: Hex } | { jenis: 'cabut'; id: string; hash: Hex };

const KUNCI = 'pusaka:tx-tertunda';

export function simpanTertunda(s: Penyimpan, t: TxTertunda): void {
  s.setItem(KUNCI, JSON.stringify(t));
}

export function ambilTertunda(s: Penyimpan): TxTertunda | null {
  try {
    const t = JSON.parse(s.getItem(KUNCI) ?? 'null') as TxTertunda | null;
    return t && typeof t.hash === 'string' ? t : null;
  } catch {
    return null;
  }
}

export function hapusTertunda(s: Penyimpan): void {
  s.removeItem(KUNCI);
}

/** Ulangi laporan selama API menjawab 409 (transaksi belum terlihat oleh RPC server). */
export async function ulangiLaporan<T>(kerja: () => Promise<T>, { coba = 6, jedaMs = 2000 } = {}): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await kerja();
    } catch (e) {
      if (!(e instanceof GalatApi && e.status === 409) || i >= coba) throw e;
      await new Promise((r) => setTimeout(r, jedaMs * i));
    }
  }
}
