//! Penemuan wallet peramban (EIP-6963): MetaMask, Coinbase Wallet, OKX, Rabby, dan lainnya.

import type { ProviderEip1193 } from './sesi';

export interface DompetPeramban {
  uuid: string;
  nama: string;
  ikon: string;
  rdns: string;
  provider: ProviderEip1193;
}

interface DetailUmum {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: ProviderEip1193;
}

export function temukanDompet(tungguMs = 300): Promise<DompetPeramban[]> {
  return new Promise((selesai) => {
    const ketemu = new Map<string, DompetPeramban>();
    const dengar = (e: Event) => {
      const d = (e as CustomEvent<DetailUmum>).detail;
      ketemu.set(d.info.rdns, { uuid: d.info.uuid, nama: d.info.name, ikon: d.info.icon, rdns: d.info.rdns, provider: d.provider });
    };
    window.addEventListener('eip6963:announceProvider', dengar);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', dengar);
      selesai([...ketemu.values()]);
    }, tungguMs);
  });
}

const KUNCI_SIMPAN = 'pusaka:wallet-luar';

/** Wallet luar yang dipakai masuk, supaya halaman lain memakai wallet yang sama. */
export function ingatDompet(rdns: string): void {
  localStorage.setItem(KUNCI_SIMPAN, rdns);
}

export function dompetDiingat(): string | null {
  return localStorage.getItem(KUNCI_SIMPAN);
}

export function lupakanDompet(): void {
  localStorage.removeItem(KUNCI_SIMPAN);
}
