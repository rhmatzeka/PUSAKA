// Langkah penerbitan di browser admin (Bab III 3.4.1): hash -> cek duplikat -> tanda tangan -> IPFS
import { getBytes, isAddress, type ContractTransactionReceipt } from "ethers";
import type { Sesi } from "@/components/SesiAdmin";
import { hashPdf } from "./hash";

export type DataLulusan = {
  nama: string;
  nim: string;
  prodi: string;
  nomor_ijazah: string;
  tanggal_lulus: string;
  wallet: string;
};

export const KOLOM = ["nama", "nim", "prodi", "nomor_ijazah", "tanggal_lulus", "wallet", "file_pdf"] as const;

export function cekData(d: DataLulusan): string | null {
  if (!d.nama || !d.nim || !d.prodi || !d.nomor_ijazah || !d.tanggal_lulus) return "Data lulusan belum lengkap.";
  if (!isAddress(d.wallet)) return "Alamat wallet alumni tidak valid (0x + 40 karakter heksadesimal).";
  return null;
}

async function unggah(sesi: Sesi, body: FormData): Promise<string> {
  const r = await fetch("/api/ipfs", { method: "POST", headers: sesi.headers, body });
  if (r.status === 401) throw new Error("LOGIN_KEDALUWARSA");
  const j = await r.json();
  if (!r.ok) throw new Error(j.error);
  return j.cid;
}

export async function hashBaru(sesi: Sesi, file: File) {
  const hash = await hashPdf(file);
  if ((await sesi.kontrak.tokenOfHash(hash)) !== 0n) throw new Error("Ijazah ini sudah pernah diterbitkan.");
  return hash;
}

// Tanda tangan ECDSA atas hash, lalu unggah PDF dan metadata. Mengembalikan argumen untuk issue/batchIssue.
export async function tandatanganiDanUnggah(sesi: Sesi, file: File, hash: string, d: DataLulusan, lapor: (l: string) => void) {
  lapor("tanda tangan");
  const sig = await sesi.signer.signMessage(getBytes(hash));
  lapor("IPFS");
  const fPdf = new FormData();
  fPdf.append("file", file);
  const cidPdf = await unggah(sesi, fPdf);
  const metadata = {
    name: `Ijazah - ${d.nama}`,
    description: "Ijazah Universitas Pamulang",
    attributes: [
      { trait_type: "NIM", value: d.nim },
      { trait_type: "Program Studi", value: d.prodi },
      { trait_type: "Nomor Ijazah", value: d.nomor_ijazah },
      { trait_type: "Tanggal Lulus", value: d.tanggal_lulus },
    ],
    document: `ipfs://${cidPdf}`,
    document_keccak256: hash,
    issuer_signature: sig,
  };
  const fMeta = new FormData();
  fMeta.append("kind", "json");
  fMeta.append("data", JSON.stringify(metadata));
  const cidMeta = await unggah(sesi, fMeta);
  return { to: d.wallet, uri: `ipfs://${cidMeta}`, hash, sig };
}

export function tokenDariReceipt(sesi: Sesi, r: ContractTransactionReceipt): number[] {
  return r.logs
    .map((log) => { try { return sesi.kontrak.interface.parseLog(log); } catch { return null; } })
    .filter((e) => e?.name === "CertificateIssued")
    .map((e) => Number(e!.args.tokenId));
}

// CSV sederhana tanpa tanda kutip (sesuai templat-lulusan.csv)
export function bacaCsv(teks: string): { baris: (DataLulusan & { file_pdf: string })[]; error?: string } {
  const [kepala, ...isi] = teks.trim().split(/\r?\n/).filter((b) => b.trim());
  const kolom = (kepala ?? "").split(",").map((k) => k.trim());
  if (KOLOM.some((k, i) => kolom[i] !== k)) return { baris: [], error: `Kolom CSV harus: ${KOLOM.join(",")}` };
  return {
    baris: isi.map((b) => {
      const v = b.split(",").map((x) => x.trim());
      return Object.fromEntries(KOLOM.map((k, i) => [k, v[i] ?? ""])) as DataLulusan & { file_pdf: string };
    }),
  };
}
