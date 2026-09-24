// Menyajikan berkas mode lokal (tanpa Pinata). Di Vercel dengan PINATA_JWT, rute ini tidak dipakai.
import { bacaLokal } from "@/lib/server/ipfs";

export async function GET(_req: Request, ctx: RouteContext<"/api/ipfs/lokal/[cid]">) {
  const { cid } = await ctx.params;
  const isi = await bacaLokal(cid);
  if (!isi) return new Response("Tidak ditemukan", { status: 404 });
  const pdf = isi.subarray(0, 5).toString() === "%PDF-";
  return new Response(new Uint8Array(isi), {
    headers: { "content-type": pdf ? "application/pdf" : "application/json", "cache-control": "public, max-age=31536000, immutable" },
  });
}
