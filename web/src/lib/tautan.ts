import type { Hex } from 'viem';
import { kunciKeFragmen } from './kunci';

export function dariHex(h: Hex): Uint8Array {
  const s = h.slice(2);
  return Uint8Array.from({ length: s.length / 2 }, (_, i) => Number.parseInt(s.slice(i * 2, i * 2 + 2), 16));
}

/** Tautan berkunci yang dicetak di QR (spec 6.1): `/i/{token}#k={kunci}`. */
export function tautanBerkunci(asal: string, tokenId: number, kunci: Hex): string {
  return `${asal}/i/${tokenId}#k=${kunciKeFragmen(dariHex(kunci))}`;
}
