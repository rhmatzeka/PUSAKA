// Upload PDF/JSON ke IPFS, hanya untuk admin yang sudah login (6.5)
import { periksaAdmin } from "@/lib/server/auth";
import { unggahBerkas, unggahJson } from "@/lib/server/ipfs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await periksaAdmin(req.headers))) return Response.json({ error: "Harus login sebagai admin BAAK" }, { status: 401 });
  const form = await req.formData();
  if (form.get("kind") === "json") {
    return Response.json({ cid: await unggahJson(JSON.parse(String(form.get("data")))) });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.type !== "application/pdf" || file.size > 4_000_000)
    return Response.json({ error: "Berkas harus PDF, maksimal 4 MB" }, { status: 400 });
  return Response.json({ cid: await unggahBerkas(file) });
}
