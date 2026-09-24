// HANYA server: unggah dan baca berkas IPFS.
// Tanpa PINATA_JWT, berkas disimpan di folder .ipfs-lokal (untuk uji di laptop, bukan untuk Vercel).
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PinataSDK } from "pinata";
import { cidDari } from "../ipfs";

const DIR_LOKAL = path.join(process.cwd(), ".ipfs-lokal");
const modeLokal = () => !process.env.PINATA_JWT;

let pinata: PinataSDK | null = null;
const sdk = () =>
  (pinata ??= new PinataSDK({ pinataJwt: process.env.PINATA_JWT!, pinataGateway: process.env.NEXT_PUBLIC_GATEWAY_URL }));

async function simpanLokal(isi: Buffer) {
  const cid = "lokal" + crypto.createHash("sha256").update(isi).digest("hex");
  await fs.mkdir(DIR_LOKAL, { recursive: true });
  await fs.writeFile(path.join(DIR_LOKAL, cid), isi);
  return cid;
}

export async function bacaLokal(cid: string) {
  if (!/^lokal[0-9a-f]{64}$/.test(cid)) return null;
  try { return await fs.readFile(path.join(DIR_LOKAL, cid)); } catch { return null; }
}

export async function unggahBerkas(file: File) {
  if (modeLokal()) return simpanLokal(Buffer.from(await file.arrayBuffer()));
  return (await sdk().upload.public.file(file)).cid;
}

export async function unggahJson(data: object) {
  if (modeLokal()) return simpanLokal(Buffer.from(JSON.stringify(data)));
  return (await sdk().upload.public.json(data)).cid;
}

// Ambil metadata JSON: gateway Pinata dulu, lalu gateway cadangan ipfs.io (timeout 10 detik)
export async function ambilJson<T>(uri: string): Promise<T | null> {
  const cid = cidDari(uri);
  if (cid.startsWith("lokal")) {
    const isi = await bacaLokal(cid);
    return isi ? JSON.parse(isi.toString()) : null;
  }
  const gateway = process.env.NEXT_PUBLIC_GATEWAY_URL;
  const urls = [gateway && `https://${gateway}/ipfs/${cid}`, `https://ipfs.io/ipfs/${cid}`].filter(Boolean) as string[];
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (r.ok) return await r.json();
    } catch {}
  }
  return null;
}
