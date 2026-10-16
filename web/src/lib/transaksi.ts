//! Calldata transaksi yang dikirim wallet operator.

import { encodeFunctionData, parseAbi, type Hex } from 'viem';
import type { Draf, PermintaanCabut } from './api';

export const MAKS_BATCH = 50;

export const abiTulis = parseAbi([
  'struct Penerbitan { address penerima; bytes32 docHash; bytes32 metadataHash; uint64 batasWaktu; }',
  'struct Pencabutan { uint256 tokenId; bytes32 alasanHash; uint64 batasWaktu; }',
  'function terbitkanBatch(Penerbitan[] p, bytes[] sig, string[] uri)',
  'function cabut(Pencabutan c, bytes sig, string alasan)',
]);

/** `terbitkanBatch` untuk draf yang sudah ditandatangani dan tanda tangannya masih berlaku. */
export function dataTerbitkan(daftar: Draf[]): Hex {
  if (daftar.length === 0 || daftar.length > MAKS_BATCH) {
    throw new Error(`Satu transaksi memuat 1–${MAKS_BATCH} ijazah`);
  }
  const p = [];
  const sig: Hex[] = [];
  const uri: string[] = [];
  for (const d of daftar) {
    if (!d.ttd) throw new Error(`Draf ${d.nama} belum ditandatangani`);
    p.push({ penerima: d.penerima, docHash: d.doc_hash, metadataHash: d.metadata_hash, batasWaktu: BigInt(d.ttd.batas_waktu) });
    sig.push(d.ttd.sig);
    uri.push(d.uri);
  }
  return encodeFunctionData({ abi: abiTulis, functionName: 'terbitkanBatch', args: [p, sig, uri] });
}

export function dataCabut(c: PermintaanCabut): Hex {
  if (!c.ttd) throw new Error('Permintaan cabut belum ditandatangani pejabat');
  return encodeFunctionData({
    abi: abiTulis,
    functionName: 'cabut',
    args: [{ tokenId: BigInt(c.token_id), alasanHash: c.alasan_hash, batasWaktu: BigInt(c.ttd.batas_waktu) }, c.ttd.sig, c.alasan],
  });
}
