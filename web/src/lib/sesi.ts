//! Sesi masuk dan wallet penanda tangan/pengirim, terlepas dari penyedianya (Privy atau akun uji).

import { createPublicClient, createWalletClient, custom, defineChain, http, type Account, type Address, type Chain, type Hex } from 'viem';
import { foundry, polygonAmoy } from 'viem/chains';
import { domainPusaka, TIPE_EIP712, type DataTtd } from './eip712';
import type { Jaringan } from './konfigurasi';

export interface Penanda {
  alamat: Address;
  /** Tanda tangan EIP-712 domain PUSAKA. */
  tandaTangani(d: DataTtd): Promise<Hex>;
  /** Kirim transaksi ke kontrak lalu tunggu sampai tercatat di blok. */
  kirim(tx: { to: Address; data: Hex }): Promise<Hex>;
}

export interface Sesi {
  status: 'memuat' | 'keluar' | 'masuk';
  token(): Promise<string>;
  penanda(): Promise<Penanda>;
  keluar(): Promise<void>;
}

export function rantaiViem(j: Jaringan): Chain {
  if (j.chainId === foundry.id) return { ...foundry, rpcUrls: { default: { http: [j.rpcUrl] } } };
  if (j.chainId === polygonAmoy.id) return { ...polygonAmoy, rpcUrls: { default: { http: [j.rpcUrl] } } };
  return defineChain({
    id: j.chainId,
    name: `Chain ${j.chainId}`,
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: { default: { http: [j.rpcUrl] } },
  });
}

/** Bagian EIP-1193 yang dipakai viem `custom()`; Privy dan EIP-6963 sama-sama memenuhinya. */
export interface ProviderEip1193 {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
}

/** Penanda dari akun lokal (uji) atau dari provider EIP-1193 (Privy tertanam / wallet luar). */
export function buatPenanda(j: Jaringan, akun: Account | Address, provider?: ProviderEip1193): Penanda {
  const chain = rantaiViem(j);
  const klien = createWalletClient({ account: akun, chain, transport: provider ? custom(provider) : http(j.rpcUrl) });
  const publik = createPublicClient({ chain, transport: http(j.rpcUrl) });
  const alamat = typeof akun === 'string' ? akun : akun.address;
  return {
    alamat,
    tandaTangani: (d) =>
      d.primaryType === 'Penerbitan'
        ? klien.signTypedData({ domain: domainPusaka(j), types: TIPE_EIP712, primaryType: 'Penerbitan', message: d.message })
        : klien.signTypedData({ domain: domainPusaka(j), types: TIPE_EIP712, primaryType: 'Pencabutan', message: d.message }),
    async kirim(tx) {
      const hash = await klien.sendTransaction({ to: tx.to, data: tx.data });
      const r = await publik.waitForTransactionReceipt({ hash });
      if (r.status !== 'success') throw new Error('Transaksi ditolak kontrak (revert). Periksa tanda tangan dan batas waktunya.');
      return hash;
    },
  };
}
