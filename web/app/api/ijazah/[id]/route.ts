// Detail satu ijazah (dipakai portal alumni)
import { ambilIjazah } from "@/lib/server/ijazah";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/ijazah/[id]">) {
  const ijazah = await ambilIjazah(Number((await ctx.params).id));
  if (!ijazah) return Response.json({ error: "Ijazah tidak ditemukan" }, { status: 404 });
  return Response.json(ijazah);
}
