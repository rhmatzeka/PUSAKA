//! `Sumber` asli: kontrak lewat RPC publik (viem), berkas lewat gateway IPFS, kripto lewat WASM.

import { BaseError, ContractFunctionRevertedError, createPublicClient, http, type Address, type Hex } from 'viem';
import { abiPusaka } from './abi';
import { muatCore } from './core';
import { ambilTerbatas, keUrlGateway } from './ipfs';
import type { Ijazah, Sumber } from './jenis';
import type { Jaringan } from './konfigurasi';

/** Amplop maksimal 4 MiB (batas API); metadata jauh lebih kecil. */
export const MAKS_UNDUH = 8 * 1024 * 1024;
export const BATAS_UNDUH_MS = 15_000;

interface IjazahMentah {
  docHash: Hex;
  penandaTangan: Address;
  waktuTerbit: bigint;
  waktuCabut: bigint;
}

function keIjazah(d: IjazahMentah): Ijazah {
  return {
    docHash: d.docHash,
    penandaTangan: d.penandaTangan,
    waktuTerbit: Number(d.waktuTerbit),
    waktuCabut: Number(d.waktuCabut),
  };
}

function namaGalatKontrak(e: unknown): string | undefined {
  if (!(e instanceof BaseError)) return undefined;
  const r = e.walk((x) => x instanceof ContractFunctionRevertedError);
  return r instanceof ContractFunctionRevertedError ? r.data?.errorName : undefined;
}

export type SumberRantai = Sumber & { blok(): Promise<bigint> };

export async function buatSumber(j: Jaringan): Promise<SumberRantai> {
  const core = await muatCore();
  const klien = createPublicClient({ transport: http(j.rpcUrl) });
  const kontrak = { address: j.kontrak, abi: abiPusaka } as const;
  return {
    async periksa(docHash) {
      const [status, tokenId, data] = await klien.readContract({ ...kontrak, functionName: 'periksa', args: [docHash] });
      return { status, tokenId, data: keIjazah(data) };
    },
    async ijazah(tokenId) {
      try {
        return keIjazah(await klien.readContract({ ...kontrak, functionName: 'ijazah', args: [tokenId] }));
      } catch (e) {
        if (namaGalatKontrak(e) === 'IjazahTidakAda') return null;
        throw e;
      }
    },
    tokenUri: (tokenId) => klien.readContract({ ...kontrak, functionName: 'tokenURI', args: [tokenId] }),
    ambil: (uri) => ambilTerbatas(keUrlGateway(uri, j.gateway), { batasMs: BATAS_UNDUH_MS, maks: MAKS_UNDUH }),
    keccak: (isi) => core.keccak256_hex(isi) as Hex,
    buka(kunci, amplop) {
      const h = core.buka_amplop(kunci, amplop);
      try {
        return { data: JSON.parse(h.data_json), pdf: h.pdf };
      } finally {
        h.free();
      }
    },
    blok: () => klien.getBlockNumber(),
  };
}
