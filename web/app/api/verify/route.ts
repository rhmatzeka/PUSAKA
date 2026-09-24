// Verifikasi dengan hash PDF. Browser hanya mengirim hash, PDF-nya tidak ikut terkirim.
import { isHexString } from "ethers";
import { kontrakBaca } from "@/lib/server/kontrak";
import { tentukanStatus } from "@/lib/server/ijazah";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const h = new URL(req.url).searchParams.get("hash") ?? "";
  if (!isHexString(h, 32)) return Response.json({ error: "hash tidak valid" }, { status: 400 });
  const [tokenId, dicabut, signature, penerbit] = await kontrakBaca().verifyByHash(h);
  const status = tokenId === 0n ? "TIDAK VALID" : tentukanStatus(h, signature, penerbit, dicabut);
  return Response.json({ status, tokenId: tokenId.toString(), penerbit });
}
