//! Data EIP-712 yang ditandatangani pejabat. Harus identik dengan kontrak dan `pusaka-core::eip712`.

import { keccak256, toBytes, type Address, type Hex } from 'viem';
import type { Draf, PermintaanCabut } from './api';
import type { Jaringan } from './konfigurasi';

export const TIPE_EIP712 = {
  Penerbitan: [
    { name: 'penerima', type: 'address' },
    { name: 'docHash', type: 'bytes32' },
    { name: 'metadataHash', type: 'bytes32' },
    { name: 'batasWaktu', type: 'uint64' },
  ],
  Pencabutan: [
    { name: 'tokenId', type: 'uint256' },
    { name: 'alasanHash', type: 'bytes32' },
    { name: 'batasWaktu', type: 'uint64' },
  ],
} as const;

/** Masa berlaku tanda tangan bawaan (spec 7.2): 7 hari. */
export const MASA_TTD_DETIK = 7 * 24 * 60 * 60;

export interface PesanPenerbitan {
  penerima: Address;
  docHash: Hex;
  metadataHash: Hex;
  batasWaktu: bigint;
}

export interface PesanPencabutan {
  tokenId: bigint;
  alasanHash: Hex;
  batasWaktu: bigint;
}

export type DataTtd =
  | { primaryType: 'Penerbitan'; message: PesanPenerbitan }
  | { primaryType: 'Pencabutan'; message: PesanPencabutan };

export function domainPusaka(j: Jaringan) {
  return { name: 'PUSAKA', version: '2', chainId: j.chainId, verifyingContract: j.kontrak } as const;
}

export function batasBaru(kiniMs = Date.now()): bigint {
  return BigInt(Math.floor(kiniMs / 1000) + MASA_TTD_DETIK);
}

export function ttdPenerbitan(d: Pick<Draf, 'penerima' | 'doc_hash' | 'metadata_hash'>, batasWaktu: bigint): DataTtd {
  return {
    primaryType: 'Penerbitan',
    message: { penerima: d.penerima, docHash: d.doc_hash, metadataHash: d.metadata_hash, batasWaktu },
  };
}

export function ttdPencabutan(c: Pick<PermintaanCabut, 'token_id' | 'alasan'>, batasWaktu: bigint): DataTtd {
  return {
    primaryType: 'Pencabutan',
    message: { tokenId: BigInt(c.token_id), alasanHash: keccak256(toBytes(c.alasan)), batasWaktu },
  };
}
