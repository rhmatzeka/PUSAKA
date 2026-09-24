// HANYA server: baca satu ijazah atau semua ijazah dari kontrak
import { getBytes, verifyMessage } from "ethers";
import { kontrakBaca } from "./kontrak";
import { ambilJson } from "./ipfs";

export type Status = "VALID" | "DICABUT" | "TIDAK VALID";

export type Metadata = {
  name: string;
  description: string;
  attributes: { trait_type: string; value: string }[];
  document: string;
  document_keccak256: string;
  issuer_signature: string;
};

export type Ijazah = {
  id: number;
  pemilik: string;
  docHash: string;
  penerbit: string;
  diterbitkan: number; // detik unix
  dicabut: boolean;
  alasanCabut: string;
  status: Status;
  tokenURI: string;
  metadata: Metadata | null;
};

// Aturan hasil sama dengan Bab III 3.4.2
export function tentukanStatus(docHash: string, signature: string, penerbit: string, dicabut: boolean): Status {
  if (dicabut) return "DICABUT";
  try {
    if (verifyMessage(getBytes(docHash), signature) !== penerbit) return "TIDAK VALID";
  } catch {
    return "TIDAK VALID";
  }
  return "VALID";
}

export async function ambilIjazah(id: number): Promise<Ijazah | null> {
  const c = kontrakBaca();
  if (!Number.isInteger(id) || id < 1 || id > Number(await c.totalIssued())) return null;
  const [s, pemilik, tokenURI] = await Promise.all([c.getCertificate(id), c.ownerOf(id), c.tokenURI(id)]);
  return {
    id,
    pemilik,
    docHash: s.docHash,
    penerbit: s.penerbit,
    diterbitkan: Number(s.diterbitkan),
    dicabut: s.dicabut,
    alasanCabut: s.alasanCabut,
    status: tentukanStatus(s.docHash, s.signature, s.penerbit, s.dicabut),
    tokenURI,
    metadata: await ambilJson<Metadata>(tokenURI),
  };
}

// Daftar ijazah untuk halaman admin: totalIssued() lalu getCertificate(1..n), tanpa membaca event
export async function semuaIjazah() {
  const c = kontrakBaca();
  const n = Number(await c.totalIssued());
  const ids = Array.from({ length: n }, (_, i) => i + 1);
  return Promise.all(ids.map(async (id) => {
    const [s, pemilik] = await Promise.all([c.getCertificate(id), c.ownerOf(id)]);
    return { id, pemilik, dicabut: s.dicabut as boolean, alasanCabut: s.alasanCabut as string, diterbitkan: Number(s.diterbitkan) };
  }));
}

export const atribut = (m: Metadata | null, nama: string) =>
  m?.attributes.find((a) => a.trait_type === nama)?.value ?? "-";

export const namaLulusan = (m: Metadata | null) => m?.name.replace(/^Ijazah - /, "") ?? "-";
