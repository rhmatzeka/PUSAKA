// Keccak-256 PDF di browser
import { keccak256 } from "ethers";

export const MAKS_PDF = 4_000_000;

export async function hashPdf(file: File) {
  return keccak256(new Uint8Array(await file.arrayBuffer())); // "0x" + 64 hex
}

export function cekPdf(file: File): string | null {
  if (file.type !== "application/pdf") return "Berkas harus PDF.";
  if (file.size > MAKS_PDF) return "Ukuran PDF maksimal 4 MB.";
  return null;
}
