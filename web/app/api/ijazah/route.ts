// Daftar semua ijazah (data publik on-chain) untuk dasbor dan daftar admin
import { semuaIjazah } from "@/lib/server/ijazah";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await semuaIjazah());
}
